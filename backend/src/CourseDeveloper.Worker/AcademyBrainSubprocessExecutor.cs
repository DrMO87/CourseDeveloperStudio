namespace CourseDeveloper.Worker;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
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

    // STEP 11 Phase B, Batch 3: the content-quality cascade has no prior artifact version to
    // build on the first time a session's content is evaluated (pre-generation) or checked
    // right after its first generation — 1 is simply "the first version," not a meaningful
    // external contract. Correctors/patchers/the regeneration adapter advance it from there.
    private const int InitialArtifactVersion = 1;

    private readonly ILogger<AcademyBrainSubprocessExecutor> _logger;
    private readonly string _scriptPath;
    private readonly string _pythonExecutable;
    private readonly string _studioCommitSha;
    private readonly TimeSpan _cancelPollInterval;
    private readonly INotebookLmCredentialResolver _credentialResolver;
    private readonly IGenerationArtifactStorage _artifactStorage;
    private readonly IContentQualityGateReevaluator _reevaluator;
    private readonly IContentQualityCascadeOrchestrator _cascadeOrchestrator;

    public AcademyBrainSubprocessExecutor(
        ILogger<AcademyBrainSubprocessExecutor> logger,
        INotebookLmCredentialResolver credentialResolver,
        IGenerationArtifactStorage artifactStorage,
        IContentQualityGateReevaluator reevaluator,
        IContentQualityCascadeOrchestrator cascadeOrchestrator)
    {
        _logger = logger;
        _credentialResolver = credentialResolver;
        _artifactStorage = artifactStorage;
        _reevaluator = reevaluator;
        _cascadeOrchestrator = cascadeOrchestrator;

        // Fail closed rather than guess a relative path across dev/CI/deploy layouts — STEP 6
        // (devops-automator) sets this explicitly in the worker's runtime environment.
        _scriptPath = Environment.GetEnvironmentVariable("ACADEMY_BRAIN_SCRIPT_PATH")
            ?? throw new InvalidOperationException(
                "ACADEMY_BRAIN_SCRIPT_PATH is not set. It must point at " +
                "<repo>/academy-brain/scripts/swarm/generate_session.py.");

        // STEP 6 bundles exactly one Python runtime into the worker image (DEC-004) — every
        // job, live or dry-run, uses that same interpreter. NotebookLM accounts no longer
        // differ by interpreter path (a per-account venv never made sense once one image
        // serves every account); they differ by which credential is injected as
        // NOTEBOOKLM_AUTH_JSON at execution time (see _credentialResolver below).
        _pythonExecutable = Environment.GetEnvironmentVariable("GENERATION_WORKER_PYTHON_EXECUTABLE") ?? "python";
        _studioCommitSha = Environment.GetEnvironmentVariable("STUDIO_COMMIT_SHA") ?? "unknown";
        _cancelPollInterval = TimeSpan.FromSeconds(2);
    }

    internal AcademyBrainSubprocessExecutor(
        ILogger<AcademyBrainSubprocessExecutor> logger,
        string scriptPath,
        string pythonExecutable,
        string studioCommitSha,
        TimeSpan cancelPollInterval,
        INotebookLmCredentialResolver credentialResolver,
        IGenerationArtifactStorage artifactStorage,
        IContentQualityGateReevaluator? reevaluator = null,
        IContentQualityCascadeOrchestrator? cascadeOrchestrator = null)
    {
        _logger = logger;
        _scriptPath = scriptPath;
        _pythonExecutable = pythonExecutable;
        _studioCommitSha = studioCommitSha;
        _cancelPollInterval = cancelPollInterval;
        _credentialResolver = credentialResolver;
        _artifactStorage = artifactStorage;
        _reevaluator = reevaluator ?? new NoOpContentQualityGateReevaluator();
        _cascadeOrchestrator = cascadeOrchestrator ?? new ThrowIfReachedContentQualityCascadeOrchestrator();
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

        // STEP 11 Phase B, Batch 3: option (b)'s pre-generation preflight, and the first-ever
        // production call site for the content-quality repair cascade (Batches 1-3 built the
        // machinery; nothing invoked it before this — see Codex's review of Batch 3).
        // Pass=null here: asset_reconciliation, pedagogy-coverage, and nblm-prompt-preflight
        // are all evaluable before any PDF is generated (see Batch2ContentQualityGateReevaluator);
        // this runs — and, on a real defect, repairs or exhausts-and-reschedules — entirely
        // before any NotebookLM quota is spent. An organization with none of these gates
        // enabled gets an empty violations list back and resolves trivially (no behavior
        // change from before this batch).
        string? renderedPromptPath = null;
        if (live)
        {
            var preGenViolations = await _reevaluator.ReevaluateAsync(job, sessionId, InitialArtifactVersion, pass: null, stoppingToken);
            if (preGenViolations.Count > 0)
            {
                var preGenOutcome = await _cascadeOrchestrator.ProcessAsync(job, sessionId, InitialArtifactVersion, null, preGenViolations, stoppingToken);
                if (!preGenOutcome.Resolved)
                {
                    _logger.LogWarning(
                        "Job {JobId}: pre-generation content-quality cascade exhausted for session {SessionId}; " +
                        "rescheduled without spending NotebookLM quota.", job.Id, sessionId);
                    return new GenerationJobExecutionResult(Canceled: false, ResultManifest: new(), QualityCascadeHandled: true);
                }
            }

            // If nblm-prompt-preflight is enabled and just rendered (or a prior attempt for
            // this session already did), hand generate_session.py that resolved file instead
            // of the course's raw template — see NblmPromptFields.RenderedPath's doc comment.
            // Nothing renders it when the gate isn't enabled, so an org that hasn't opted in
            // gets exactly today's behavior (the course's own static file, unchanged).
            var candidateRenderedPath = NblmPromptFields.RenderedPath(courseVaultRoot, sessionId);
            if (File.Exists(candidateRenderedPath))
            {
                renderedPromptPath = candidateRenderedPath;
            }
        }

        // STEP 6: resolved at execution time, not read from the enqueue-time payload — see
        // NotebookLmCredentialResolver's doc comment for why that matters for rotation.
        string? notebookLmAuthJson = null;
        if (live)
        {
            notebookLmAuthJson = await _credentialResolver.ResolveAsync(job.NotebookLmAccountKey, stoppingToken);
            if (string.IsNullOrEmpty(notebookLmAuthJson))
            {
                throw new NonRetryableJobExecutionException(
                    $"Job {job.Id}: live=true but no NotebookLM credential is provisioned for account " +
                    $"'{job.NotebookLmAccountKey}' (see public.notebooklm_auth_json in database/schema.sql). " +
                    "Provision it with vault.create_secret(...) before retrying.");
            }
        }

        var arguments = new List<string> { _scriptPath, sessionId, "--root", courseVaultRoot };
        if (renderedPromptPath is not null)
        {
            arguments.Add("--prompt-file");
            arguments.Add(renderedPromptPath);
        }
        if (live)
        {
            arguments.Add("--live");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = _pythonExecutable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in arguments)
        {
            startInfo.ArgumentList.Add(arg);
        }
        if (notebookLmAuthJson is not null)
        {
            startInfo.Environment["NOTEBOOKLM_AUTH_JSON"] = notebookLmAuthJson;
        }

        _logger.LogInformation("Job {JobId}: launching {Interpreter} {Args}", job.Id, _pythonExecutable, string.Join(' ', arguments));

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

        // Post-generation content-quality cascade: language_ratio/boundary_check/brand_palette
        // each need an actual generated PDF, so they only make sense once generate_session.py
        // has produced one — check every pass this session actually produced, before this
        // job's artifacts get uploaded/completed. Running this BEFORE the upload block below
        // matters: if a violation triggers tier-3 regeneration (PassRegenerationAdapter), the
        // regenerated PDF/bundle on disk must be what gets uploaded, not the pre-repair one.
        if (live)
        {
            foreach (var pass in PdfPassSource.SupportedPasses)
            {
                var pdfPath = PdfPassSource.ResolvePdfPath(courseVaultRoot, sessionId, pass);
                if (!File.Exists(pdfPath))
                {
                    continue; // this session's plan didn't produce this pass
                }

                var postGenViolations = await _reevaluator.ReevaluateAsync(job, sessionId, InitialArtifactVersion, pass, stoppingToken);
                if (postGenViolations.Count == 0)
                {
                    continue;
                }
                var postGenOutcome = await _cascadeOrchestrator.ProcessAsync(job, sessionId, InitialArtifactVersion, pass, postGenViolations, stoppingToken);
                if (!postGenOutcome.Resolved)
                {
                    _logger.LogWarning(
                        "Job {JobId}: post-generation content-quality cascade exhausted for session {SessionId} pass {Pass}; rescheduled.",
                        job.Id, sessionId, pass);
                    return new GenerationJobExecutionResult(Canceled: false, ResultManifest: new(), QualityCascadeHandled: true);
                }
            }
        }

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
        manifest["promptProvenance"] = resultLine.PromptProvenance!;

        // STEP 6: land the artifact somewhere Studio-visible, not just this worker's local
        // disk. Only meaningful when a receipt actually exists (a live run) — a dry run never
        // has one. Storage being unconfigured (local dev) is not an error; a real upload
        // failure is (GenerationArtifactStorage throws, which surfaces as a retryable job
        // failure — a storage hiccup is worth retrying, unlike a HardStop).
        if (resultLine.ReceiptPath is not null)
        {
            var uploaded = await _artifactStorage.UploadAsync(job.Id, resultLine.ReceiptPath, stoppingToken);
            if (uploaded is not null)
            {
                manifest["artifactStorage"] = new Dictionary<string, object>
                {
                    ["bucket"] = uploaded.Bucket,
                    ["path"] = uploaded.StoragePath,
                    ["sha256"] = uploaded.Sha256,
                    ["sizeBytes"] = uploaded.SizeBytes,
                };
            }
        }

        // STEP 6 (fixed after review): the receipt above is a small status file — Codex's
        // review caught that generate_session's actual generated content (slides/assets)
        // lives in a separate directory academy-brain writes independently
        // (VAULT/75-bundle/<sessionId>, see generate_session.py's write_receipt/_demo), which
        // was never getting durably stored. Zip that directory and upload it too, so a live
        // run's real output survives past this worker's local disk, not just its receipt.
        if (live)
        {
            var bundleDir = Path.Combine(courseVaultRoot, "75-bundle", sessionId);
            if (Directory.Exists(bundleDir))
            {
                var zipPath = Path.Combine(Path.GetTempPath(), $"{sessionId}-{job.Id:N}.zip");
                try
                {
                    if (File.Exists(zipPath))
                    {
                        File.Delete(zipPath);
                    }
                    ZipFile.CreateFromDirectory(bundleDir, zipPath);
                    var uploadedBundle = await _artifactStorage.UploadAsync(job.Id, zipPath, stoppingToken);
                    if (uploadedBundle is not null)
                    {
                        manifest["courseBundleStorage"] = new Dictionary<string, object>
                        {
                            ["bucket"] = uploadedBundle.Bucket,
                            ["path"] = uploadedBundle.StoragePath,
                            ["sha256"] = uploadedBundle.Sha256,
                            ["sizeBytes"] = uploadedBundle.SizeBytes,
                        };
                    }
                }
                finally
                {
                    if (File.Exists(zipPath))
                    {
                        File.Delete(zipPath);
                    }
                }
            }
            else
            {
                _logger.LogWarning(
                    "Job {JobId}: live run succeeded but bundle directory {BundleDir} doesn't exist — no course output uploaded.",
                    job.Id, bundleDir);
            }

            // STEP 11 Phase B, Batch 3 follow-up (Codex review): the receipt is a small status
            // file and the 75-bundle zip above is the pre-generation source material — neither
            // one is the actual generated PDF academy-brain produced under 80-generation/<sid>.
            // Upload whichever passes this session actually generated (post-gen cascade may
            // have already regenerated one), keyed by pass so a caller can tell them apart.
            var pdfStorage = new Dictionary<string, object>();
            foreach (var pass in PdfPassSource.SupportedPasses)
            {
                var pdfPath = PdfPassSource.ResolvePdfPath(courseVaultRoot, sessionId, pass);
                if (!File.Exists(pdfPath))
                {
                    continue;
                }

                var uploadedPdf = await _artifactStorage.UploadAsync(job.Id, pdfPath, stoppingToken);
                if (uploadedPdf is not null)
                {
                    pdfStorage[pass] = new Dictionary<string, object>
                    {
                        ["bucket"] = uploadedPdf.Bucket,
                        ["path"] = uploadedPdf.StoragePath,
                        ["sha256"] = uploadedPdf.Sha256,
                        ["sizeBytes"] = uploadedPdf.SizeBytes,
                    };
                }
            }
            if (pdfStorage.Count > 0)
            {
                manifest["generatedPdfStorage"] = pdfStorage;
            }
        }

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

    internal sealed record ParsedResultLine(string? ReceiptPath, Dictionary<string, object> Pedagogy, Dictionary<string, object>? PromptProvenance);

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
            // STEP 11 Phase B, Batch 3 follow-up (Codex review): proof of exactly which prompt
            // file this run used, even when an existing rendered file passed preflight and no
            // correction ran (the correction event alone doesn't cover that case).
            var promptProvenance = root.TryGetProperty("promptProvenance", out var pp) && pp.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(pp.GetRawText())
                : null;
            return new ParsedResultLine(receiptPath, pedagogy, promptProvenance);
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

// Test-only fallback for the internal constructor overload used by
// AcademyBrainSubprocessExecutorTests: those tests exercise subprocess launching/parsing/
// cancellation behavior unrelated to the content-quality cascade, so an omitted reevaluator
// defaults to one that always finds nothing — matching every real organization until it
// enables a gate. ExecuteAsync only ever calls the orchestrator when a reevaluator actually
// returned violations (see its `if (...Count > 0)` / `if (...Count == 0) continue;` guards),
// so pairing this with the default orchestrator below means the orchestrator is never
// reached at all in that (correct, common) case.
internal sealed class NoOpContentQualityGateReevaluator : IContentQualityGateReevaluator
{
    public Task<List<ContentQualityViolation>> ReevaluateAsync(
        GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
        => Task.FromResult(new List<ContentQualityViolation>());
}

// Codex's review (STEP 11 Phase B, Batch 3 follow-up): an "always resolved" fallback here
// would silently mask a real misconfiguration — a caller that supplies a real reevaluator
// (one that can return violations) but forgets to also supply a real orchestrator. Since
// ExecuteAsync never invokes ProcessAsync with an empty violations list, actually reaching
// this class's ProcessAsync means exactly that mismatch occurred; fail loudly instead of
// quietly pretending the cascade resolved something it never evaluated.
internal sealed class ThrowIfReachedContentQualityCascadeOrchestrator : IContentQualityCascadeOrchestrator
{
    public Task<ContentQualityCascadeOutcome> ProcessAsync(
        GenerationJob job, string artifactLineageId, int artifactVersion, string? pass,
        List<ContentQualityViolation> violations, CancellationToken ct)
        => throw new InvalidOperationException(
            $"AcademyBrainSubprocessExecutor's internal test constructor was given a reevaluator that " +
            $"returned {violations.Count} content-quality violation(s) for job {job.Id} (pass '{pass}'), " +
            "but no real IContentQualityCascadeOrchestrator was supplied. Pass one explicitly — this " +
            "fallback only exists to be paired with the default no-op reevaluator.");
}
