namespace CourseDeveloper.Worker;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;
using Microsoft.Extensions.Logging;

// STEP 5: real academy-brain invocation, replacing StubGenerationJobExecutor. Per decision 1,
// this is a subprocess adapter only (no HTTP service) — it shells out to the monorepo's
// academy-brain/scripts/swarm/generate_session.py with --root (CoursePaths.for_root), the
// concrete de-hardcoding this step exists to make. See contracts/generation-job/*.schema.json
// for the payload/result shapes this class reads and writes.
public sealed class AcademyBrainSubprocessExecutor : IGenerationJobExecutor
{
    private const string SupportedOperation = "academy-brain.generate-session";
    private const int TailCharLimit = 4000;

    // generate_session.py's documented exit code for a deterministic quality-gate
    // refusal (see result.schema.json's exitCode description).
    private const int HardStopExitCode = 2;

    private readonly ILogger<AcademyBrainSubprocessExecutor> _logger;
    private readonly string _scriptPath;
    private readonly string _dryRunPythonExecutable;
    private readonly string _studioCommitSha;
    private readonly TimeSpan _cancelPollInterval;

    public AcademyBrainSubprocessExecutor(ILogger<AcademyBrainSubprocessExecutor> logger)
    {
        _logger = logger;

        // Fail closed rather than guess a relative path across dev/CI/deploy layouts — STEP 6
        // (devops-automator) sets this explicitly in the worker's runtime environment.
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/generate_session.py.");

        _dryRunPythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
        _studioCommitSha = Environment.GetEnvironmentVariable("STUDIO_COMMIT_SHA") ?? "unknown";
        _cancelPollInterval = TimeSpan.FromSeconds(2);
    }

    internal AcademyBrainSubprocessExecutor(
        ILogger<AcademyBrainSubprocessExecutor> logger,
        string scriptPath,
        string dryRunPythonExecutable,
        string studioCommitSha,
        TimeSpan cancelPollInterval)
    {
        _logger = logger;
        _scriptPath = scriptPath;
        _dryRunPythonExecutable = dryRunPythonExecutable;
        _studioCommitSha = studioCommitSha;
        _cancelPollInterval = cancelPollInterval;
    }

    public async Task<GenerationJobExecutionResult> ExecuteAsync(GenerationJob job, Func<Task<bool>> isCancelRequested, CancellationToken stoppingToken)
    {
        if (job.Operation != SupportedOperation)
        {
            throw new InvalidOperationException(
                $"AcademyBrainSubprocessExecutor cannot run operation '{job.Operation}' — only '{SupportedOperation}' is supported.");
        }

        var payload = job.Payload;
        var contractVersion = ReadInt(payload, "contractVersion");
        if (contractVersion != 1)
        {
            throw new InvalidOperationException(
                $"Job {job.Id} has contractVersion {contractVersion}, but this worker build only understands version 1.");
        }

        var sessionId = ReadString(payload, "sessionId") ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'sessionId'.");
        var courseVaultRoot = ReadString(payload, "courseVaultRoot") ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'courseVaultRoot'.");
        var live = ReadBool(payload, "live") ?? false;

        string interpreter;
        if (live)
        {
            interpreter = ReadString(payload, "pythonExecutable")
                ?? throw new InvalidOperationException(
                    $"Job {job.Id} has live=true but no 'pythonExecutable' — a live run needs the interpreter " +
                    "that has the notebooklm package and this job's NotebookLM account session.");
        }
        else
        {
            interpreter = _dryRunPythonExecutable;
        }

        var arguments = new List<string> { _scriptPath, sessionId, "--root", courseVaultRoot };
        if (live)
        {
            arguments.Add("--live");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = interpreter,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in arguments)
        {
            startInfo.ArgumentList.Add(arg);
        }

        _logger.LogInformation("Job {JobId}: launching {Interpreter} {Args}", job.Id, interpreter, string.Join(' ', arguments));

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        process.OutputDataReceived += (_, e) => { if (e.Data is not null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        var exitedTask = process.WaitForExitAsync();
        try
        {
            while (!exitedTask.IsCompleted)
            {
                var completed = await Task.WhenAny(exitedTask, Task.Delay(_cancelPollInterval, stoppingToken));
                stoppingToken.ThrowIfCancellationRequested();
                if (completed != exitedTask && await isCancelRequested())
                {
                    if (!TryKill(process))
                    {
                        await exitedTask;
                        break;
                    }

                    _logger.LogInformation("Job {JobId}: cancel requested, killing subprocess.", job.Id);
                    await exitedTask;
                    return new GenerationJobExecutionResult(Canceled: true, ResultManifest: new());
                }
            }

            await exitedTask;
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            TryKill(process);
            await exitedTask;
            throw;
        }

        var stdoutText = stdout.ToString();
        var stderrText = stderr.ToString();
        var exitCode = process.ExitCode;

        if (exitCode == HardStopExitCode)
        {
            // A quality gate deterministically refused the content — retrying will fail
            // the same way every time. Signal that so the polling service doesn't retry.
            throw new NonRetryableJobExecutionException(
                $"Job {job.Id}: generate_session.py HardStop (exit {exitCode}) for session {sessionId} — " +
                $"a quality gate refused the content. stderr tail: {Tail(stderrText)}");
        }

        if (exitCode != 0)
        {
            throw new InvalidOperationException(
                $"Job {job.Id}: generate_session.py exited {exitCode} for session {sessionId}. " +
                $"stderr tail: {Tail(stderrText)}");
        }

        var resultLine = ParseResultJsonLine(stdoutText);

        var manifest = new Dictionary<string, object>
        {
            ["contractVersion"] = 1,
            ["studioBuild"] = new Dictionary<string, object> { ["commitSha"] = _studioCommitSha },
            ["sessionId"] = sessionId,
            ["exitCode"] = exitCode,
            ["stdoutTail"] = Tail(stdoutText),
            ["stderrTail"] = Tail(stderrText),
        };
        // receiptPath/pedagogy are genuinely absent for a dry run — Dictionary<string,object>
        // stores a null value fine (nullable reference types are compile-time only), and
        // NpgsqlGenerationJobRepository serializes it through System.Text.Json as JSON null.
        manifest["receiptPath"] = resultLine.ReceiptPath!;
        manifest["pedagogy"] = resultLine.Pedagogy;

        return new GenerationJobExecutionResult(Canceled: false, ResultManifest: manifest);
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

    internal static string Tail(string text) => text.Length <= TailCharLimit ? text : text[^TailCharLimit..];

    internal sealed record ParsedResultLine(string? ReceiptPath, Dictionary<string, object> Pedagogy);

    // generate_session.py prints exactly one "RESULT_JSON:{...}" line as its last line of
    // stdout (both the dry-run and --live paths) — see STEP 5's generate_session.py changes.
    // Screen-scraping the human-readable lines above it would be fragile; this is the one
    // line the contract guarantees.
    internal static ParsedResultLine ParseResultJsonLine(string stdoutText)
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
            string? receiptPath = root.TryGetProperty("receiptPath", out var rp) && rp.ValueKind == JsonValueKind.String
                ? rp.GetString()
                : null;
            var pedagogy = root.TryGetProperty("pedagogy", out var pd) && pd.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(pd.GetRawText())
                : null;
            if (pedagogy is null)
            {
                throw new InvalidOperationException(
                    "generate_session.py RESULT_JSON is missing its required pedagogy summary.");
            }
            return new ParsedResultLine(receiptPath, pedagogy);
        }

        throw new InvalidOperationException(
            "generate_session.py exited successfully without its required RESULT_JSON line.");
    }

    private static string? ReadString(Dictionary<string, object> payload, string key)
        => payload.TryGetValue(key, out var value) ? CoerceString(value) : null;

    private static bool? ReadBool(Dictionary<string, object> payload, string key)
        => payload.TryGetValue(key, out var value) ? CoerceBool(value) : null;

    private static int ReadInt(Dictionary<string, object> payload, string key)
        => payload.TryGetValue(key, out var value) ? CoerceInt(value) : throw new InvalidOperationException($"payload is missing '{key}'.");

    internal static string? CoerceString(object value) => value switch
    {
        JsonElement el when el.ValueKind == JsonValueKind.String => el.GetString(),
        string s => s,
        _ => null,
    };

    internal static bool? CoerceBool(object value) => value switch
    {
        JsonElement el when el.ValueKind is JsonValueKind.True or JsonValueKind.False => el.GetBoolean(),
        bool b => b,
        _ => null,
    };

    internal static int CoerceInt(object value) => value switch
    {
        JsonElement el when el.ValueKind == JsonValueKind.Number => el.GetInt32(),
        int i => i,
        long l => (int)l,
        double d => (int)d,
        _ => throw new InvalidOperationException($"expected a number, got {value?.GetType().Name ?? "null"}."),
    };
}
