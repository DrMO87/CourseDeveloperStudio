namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;

// STEP 11 Phase B, Batch 2: shells out to academy-brain/scripts/swarm/extract_pdf_text.py
// (see that file's doc comment for why extraction lives there, not here). Same subprocess
// shape as AcademyBrainSubprocessExecutor — separate env var for the script path because
// this is a different script, same GENERATION_WORKER_PYTHON_EXECUTABLE interpreter (STEP 6,
// DEC-004: one Python runtime bundled into the worker image; no reason for a second one).
public sealed class PythonPdfTextExtractor : IPdfTextExtractor
{
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;

    public PythonPdfTextExtractor()
    {
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_PDF_TEXT_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_PDF_TEXT_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/extract_pdf_text.py.");
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
    }

    internal PythonPdfTextExtractor(string scriptPath, string pythonExecutable)
    {
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
    }

    public async Task<string> ExtractTextAsync(string pdfPath, CancellationToken ct)
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
        startInfo.ArgumentList.Add(pdfPath);

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
                $"extract_pdf_text.py exited {process.ExitCode} for '{pdfPath}'. stderr: {stderr}");
        }

        using var doc = JsonDocument.Parse(stdout.ToString().Trim());
        return doc.RootElement.TryGetProperty("text", out var textProp) && textProp.ValueKind == JsonValueKind.String
            ? textProp.GetString()!
            : throw new InvalidOperationException($"extract_pdf_text.py returned no 'text' field for '{pdfPath}'.");
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
            // The process exited between HasExited and Kill.
        }
    }
}
