namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;

// STEP 11 Phase B, Batch 3, option (a): shells out to academy-brain/scripts/swarm/
// nblm_prompt_template.py to render the immutable template's `$FIELD` placeholders to a
// separate per-session output file (never in place — see INblmPromptRenderer's doc comment).
public sealed class PythonNblmPromptRenderer : INblmPromptRenderer
{
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;

    public PythonNblmPromptRenderer()
    {
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_NBLM_RENDER_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_NBLM_RENDER_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/nblm_prompt_template.py.");
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
    }

    internal PythonNblmPromptRenderer(string scriptPath, string pythonExecutable)
    {
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
    }

    public async Task<NblmPromptRenderResult> RenderAsync(
        string templatePath,
        string renderedPath,
        string durationMinutesText,
        string audienceDescriptor,
        string orgDisplayName,
        string brandingClause,
        CancellationToken ct)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(renderedPath)!);

        var startInfo = new ProcessStartInfo
        {
            FileName = _pythonExecutable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        startInfo.ArgumentList.Add(_scriptPath);
        startInfo.ArgumentList.Add(templatePath);
        startInfo.ArgumentList.Add("--output");
        startInfo.ArgumentList.Add(renderedPath);
        startInfo.ArgumentList.Add("--duration-minutes");
        startInfo.ArgumentList.Add(durationMinutesText);
        startInfo.ArgumentList.Add("--audience");
        startInfo.ArgumentList.Add(audienceDescriptor);
        startInfo.ArgumentList.Add("--org-name");
        startInfo.ArgumentList.Add(orgDisplayName);
        startInfo.ArgumentList.Add("--branding-clause");
        startInfo.ArgumentList.Add(brandingClause);

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
                $"nblm_prompt_template.py exited {process.ExitCode} for '{templatePath}' -> '{renderedPath}'. stderr: {stderr}");
        }

        using var doc = JsonDocument.Parse(stdout.ToString().Trim());
        var root = doc.RootElement;
        return new NblmPromptRenderResult(
            root.GetProperty("renderedPath").GetString()!,
            root.GetProperty("renderedSha256").GetString()!,
            root.GetProperty("templateVersion").GetInt32());
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
