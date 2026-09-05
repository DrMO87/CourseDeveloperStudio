namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Diagnostics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 3: shells out to academy-brain/scripts/swarm/
// evaluate_pedagogy_coverage.py (see that file's doc comment). Same subprocess shape as
// PythonPdfTextExtractor — separate env var for the script path, same
// GENERATION_WORKER_PYTHON_EXECUTABLE interpreter (STEP 6, DEC-004).
public sealed class PythonPedagogyCoverageEvaluator : IPedagogyCoverageEvaluator
{
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;

    public PythonPedagogyCoverageEvaluator()
    {
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_PEDAGOGY_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_PEDAGOGY_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/evaluate_pedagogy_coverage.py.");
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
    }

    internal PythonPedagogyCoverageEvaluator(string scriptPath, string pythonExecutable)
    {
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
    }

    public async Task<PythonGateResult> EvaluateAsync(string sessionCode, string courseVaultRoot, CancellationToken ct)
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
        startInfo.ArgumentList.Add(sessionCode);
        startInfo.ArgumentList.Add("--root");
        startInfo.ArgumentList.Add(courseVaultRoot);

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
                $"evaluate_pedagogy_coverage.py exited {process.ExitCode} for session '{sessionCode}'. stderr: {stderr}");
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
