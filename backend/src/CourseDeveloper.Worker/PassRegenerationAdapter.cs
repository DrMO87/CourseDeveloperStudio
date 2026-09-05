namespace CourseDeveloper.Worker;

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
using Microsoft.Extensions.Logging;

// STEP 11 Phase B, Batch 2's real last-resort regeneration adapter, replacing
// PassRegenerationNotYetAvailable. Per the handoff's "The new integration point": this must
// (1) preserve/quarantine the rejected artifact, never delete it, (2) prove no NotebookLM
// task is still in flight for the pass, and (3) create a fresh real task for only that one
// pass. generate_session.py's new --regenerate-pass flag owns all three — see
// _prepare_regeneration()'s doc comment there — this adapter is only the same kind of
// subprocess bridge AcademyBrainSubprocessExecutor already is for ordinary generation,
// scoped to that one flag. It shares that script/interpreter/credential-resolution pattern
// deliberately rather than inventing a second one.
public sealed class PassRegenerationAdapter : IContentQualityRegenerationAdapter
{
    private const int HardStopExitCode = 2;
    private const int RegenerationDeclinedExitCode = 3;
    private const int TailCharLimit = 4000;

    private readonly ILogger<PassRegenerationAdapter> _logger;
    private readonly INotebookLmCredentialResolver _credentialResolver;
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;
    private readonly TimeSpan _wallClockLimit;

    public PassRegenerationAdapter(ILogger<PassRegenerationAdapter> logger, INotebookLmCredentialResolver credentialResolver)
    {
        _logger = logger;
        _credentialResolver = credentialResolver;
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/generate_session.py.");
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
        // The handoff's concrete numbers table: "45 minutes wall-clock for each fresh
        // generation invocation; cancellation terminates the subprocess/task wait through
        // the existing cancellation path."
        _wallClockLimit = TimeSpan.FromMinutes(45);
    }

    internal PassRegenerationAdapter(
        ILogger<PassRegenerationAdapter> logger,
        INotebookLmCredentialResolver credentialResolver,
        string scriptPath,
        string pythonExecutable,
        TimeSpan? wallClockLimit = null)
    {
        _logger = logger;
        _credentialResolver = credentialResolver;
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
        _wallClockLimit = wallClockLimit ?? TimeSpan.FromMinutes(45);
    }

    public async Task<ContentQualityCorrectionResult?> TryRegeneratePassAsync(
        string artifactLineageId, string pass, GenerationJob job, CancellationToken ct)
    {
        var courseVaultRoot = ReadString(job.Payload, "courseVaultRoot")
            ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'courseVaultRoot'.");
        var sessionCode = ReadString(job.Payload, "sessionId")
            ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'sessionId'.");

        var notebookLmAuthJson = await _credentialResolver.ResolveAsync(job.NotebookLmAccountKey, ct);
        if (string.IsNullOrEmpty(notebookLmAuthJson))
        {
            throw new NonRetryableJobExecutionException(
                $"Job {job.Id}: last-resort regeneration of pass '{pass}' needs a live NotebookLM " +
                $"credential for account '{job.NotebookLmAccountKey}', but none is provisioned.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = _pythonExecutable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        startInfo.ArgumentList.Add(_scriptPath);
        startInfo.ArgumentList.Add(sessionCode);
        startInfo.ArgumentList.Add("--root");
        startInfo.ArgumentList.Add(courseVaultRoot);
        startInfo.ArgumentList.Add("--live");
        startInfo.ArgumentList.Add("--regenerate-pass");
        startInfo.ArgumentList.Add(pass);
        var renderedPromptPath = NblmPromptFields.RenderedPath(courseVaultRoot, sessionCode);
        if (File.Exists(renderedPromptPath))
        {
            startInfo.ArgumentList.Add("--prompt-file");
            startInfo.ArgumentList.Add(renderedPromptPath);
        }
        startInfo.Environment["NOTEBOOKLM_AUTH_JSON"] = notebookLmAuthJson;

        _logger.LogInformation(
            "Job {JobId}: launching last-resort regeneration for pass {Pass} (session {SessionId}).",
            job.Id, pass, sessionCode);

        using var wallClockCts = new CancellationTokenSource(_wallClockLimit);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, wallClockCts.Token);

        using var process = new Process { StartInfo = startInfo };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        process.OutputDataReceived += (_, e) => { if (e.Data is not null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (linkedCts.IsCancellationRequested)
        {
            TryKill(process);
            await process.WaitForExitAsync(CancellationToken.None);
            if (wallClockCts.IsCancellationRequested && !ct.IsCancellationRequested)
            {
                throw new InvalidOperationException(
                    $"Job {job.Id}: last-resort regeneration of pass '{pass}' exceeded the " +
                    $"{_wallClockLimit.TotalMinutes}-minute wall-clock limit and was killed.");
            }
            throw;
        }

        var exitCode = process.ExitCode;
        var stderrText = stderr.ToString();
        if (exitCode == RegenerationDeclinedExitCode)
        {
            // generate_session.py's --regenerate-pass path itself refused — a task already
            // in flight, another process holding the pass lock, or no rejected artifact to
            // regenerate in the first place. IContentQualityRegenerationAdapter's contract
            // is explicit: refuse (null) rather than guess, never throw for an honest decline.
            _logger.LogWarning(
                "Job {JobId}: last-resort regeneration of pass {Pass} declined. stderr tail: {StderrTail}",
                job.Id, pass, Tail(stderrText));
            return null;
        }

        if (exitCode == HardStopExitCode)
        {
            throw new NonRetryableJobExecutionException(
                $"Job {job.Id}: generate_session.py HardStop (exit {exitCode}) while preparing " +
                $"last-resort regeneration of pass '{pass}'. stderr tail: {Tail(stderrText)}");
        }

        if (exitCode != 0)
        {
            throw new InvalidOperationException(
                $"Job {job.Id}: generate_session.py --regenerate-pass {pass} exited {exitCode}. " +
                $"stderr tail: {Tail(stderrText)}");
        }

        var (newVersion, quarantinedFrom) = ParseResultJsonLine(stdout.ToString(), job.Id, pass);
        return new ContentQualityCorrectionResult(
            newVersion,
            $"Regenerated pass '{pass}' via last-resort NotebookLM retry; quarantined prior artifact to '{quarantinedFrom}'.");
    }

    // generate_session.py's --regenerate-pass path prints the same RESULT_JSON contract as
    // an ordinary run, plus "newArtifactVersion" and "quarantinedFrom" — both required here;
    // their absence means the script did not actually take the regeneration branch, which
    // must never be silently treated as success.
    private static (int NewVersion, string QuarantinedFrom) ParseResultJsonLine(string stdoutText, Guid jobId, string pass)
    {
        const string marker = "RESULT_JSON:";
        var lines = stdoutText.Split('\n');
        for (var i = lines.Length - 1; i >= 0; i--)
        {
            var line = lines[i].TrimEnd('\r');
            if (!line.StartsWith(marker, StringComparison.Ordinal))
            {
                continue;
            }

            using var doc = JsonDocument.Parse(line[marker.Length..]);
            var root = doc.RootElement;
            if (!root.TryGetProperty("newArtifactVersion", out var versionProp) || versionProp.ValueKind != JsonValueKind.Number)
            {
                throw new InvalidOperationException(
                    $"Job {jobId}: --regenerate-pass {pass} RESULT_JSON is missing a numeric 'newArtifactVersion'.");
            }
            if (!root.TryGetProperty("quarantinedFrom", out var quarantinedProp) || quarantinedProp.ValueKind != JsonValueKind.String)
            {
                throw new InvalidOperationException(
                    $"Job {jobId}: --regenerate-pass {pass} RESULT_JSON is missing 'quarantinedFrom'.");
            }

            return (versionProp.GetInt32(), quarantinedProp.GetString()!);
        }

        throw new InvalidOperationException(
            $"Job {jobId}: --regenerate-pass {pass} exited successfully without its required RESULT_JSON line.");
    }

    private static bool TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                return true;
            }
        }
        catch (InvalidOperationException)
        {
            // already exited between the check and the kill — fine
        }
        return false;
    }

    private static string Tail(string text) => text.Length <= TailCharLimit ? text : text[^TailCharLimit..];

    private static string? ReadString(System.Collections.Generic.Dictionary<string, object> payload, string key)
    {
        if (!payload.TryGetValue(key, out var value))
        {
            return null;
        }

        return value switch
        {
            JsonElement el when el.ValueKind == JsonValueKind.String => el.GetString(),
            string s => s,
            _ => null,
        };
    }
}
