namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 3, option (b): shells out to academy-brain/scripts/swarm/
// evaluate_nblm_prompt_preflight.py. Same subprocess shape as PythonPdfTextExtractor.
public sealed class PythonNblmPromptPreflightEvaluator : INblmPromptPreflightEvaluator
{
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;

    public PythonNblmPromptPreflightEvaluator()
    {
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_NBLM_PREFLIGHT_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_NBLM_PREFLIGHT_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/evaluate_nblm_prompt_preflight.py.");
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
    }

    internal PythonNblmPromptPreflightEvaluator(string scriptPath, string pythonExecutable)
    {
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
    }

    public async Task<PythonGateResult> EvaluateAsync(
        string promptPath,
        string? expectedDurationText,
        string? expectedAudienceText,
        string? expectedBrandingText,
        IReadOnlyList<string> forbiddenStrings,
        CancellationToken ct)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _pythonExecutable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        startInfo.ArgumentList.Add(_scriptPath);
        startInfo.ArgumentList.Add(promptPath);
        if (expectedDurationText is not null)
        {
            startInfo.ArgumentList.Add("--expected-duration");
            startInfo.ArgumentList.Add(expectedDurationText);
        }
        if (expectedAudienceText is not null)
        {
            startInfo.ArgumentList.Add("--expected-audience");
            startInfo.ArgumentList.Add(expectedAudienceText);
        }
        if (expectedBrandingText is not null)
        {
            startInfo.ArgumentList.Add("--expected-branding");
            startInfo.ArgumentList.Add(expectedBrandingText);
        }
        foreach (var forbidden in forbiddenStrings)
        {
            startInfo.ArgumentList.Add("--forbidden");
            startInfo.ArgumentList.Add(forbidden);
        }

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
            await process.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            TryKill(process);
            await process.WaitForExitAsync(CancellationToken.None);
            throw;
        }

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"evaluate_nblm_prompt_preflight.py exited {process.ExitCode} for '{promptPath}'. stderr: {stderr}");
        }

        return PythonGateResultParser.Parse(stdout.ToString().Trim());
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (InvalidOperationException)
        {
            // already exited between the check and the kill — fine
        }
    }
}
