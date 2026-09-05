using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Infrastructure.ContentQuality;
using CourseDeveloper.Infrastructure.QualityGates;
using CourseDeveloper.Infrastructure.Supabase;
using CourseDeveloper.Worker;
using Npgsql;

var builder = Host.CreateApplicationBuilder(args);

// Connects as the narrowly-scoped generation_worker Postgres role (see database/schema.sql),
// not the studio_api role CourseDeveloper.Api uses — the worker has no per-request JWT to
// propagate, so it gets table-level grants on generation_job/generation_job_event instead
// of going through SET LOCAL ROLE authenticated.
var workerConnectionString = Environment.GetEnvironmentVariable("GENERATION_WORKER_CONNECTION_STRING")
    ?? throw new InvalidOperationException(
        "GENERATION_WORKER_CONNECTION_STRING is required and must authenticate as the narrowly scoped generation_worker role.");
var configuredWorkerRole = new NpgsqlConnectionStringBuilder(workerConnectionString).Username;
if (!string.Equals(configuredWorkerRole, "generation_worker", StringComparison.Ordinal))
{
    throw new InvalidOperationException(
        "GENERATION_WORKER_CONNECTION_STRING must authenticate as generation_worker; refusing an unscoped database role.");
}

builder.Services.AddSingleton(_ =>
{
    var dataSourceBuilder = new NpgsqlDataSourceBuilder(workerConnectionString);
    return dataSourceBuilder.Build();
});

builder.Services.AddSingleton<IGenerationJobRepository, NpgsqlGenerationJobRepository>();
builder.Services.AddSingleton<INotebookLmCredentialResolver, NotebookLmCredentialResolver>();
builder.Services.AddHttpClient<IGenerationArtifactStorage, GenerationArtifactStorage>();
builder.Services.AddSingleton<IGenerationJobExecutor, AcademyBrainSubprocessExecutor>();
builder.Services.AddHostedService<GenerationJobPollingService>();

// STEP 11 Phase B, Batch 1: the worker previously had no path to IQualityGateRunner at
// all (see docs/tickets/handoffs/step11-nblm-prompt-authoring.md, "What exists today") —
// GateRunnerService and its repositories only ran behind the frontend-triggered HTTP
// endpoint. WorkerConnectionFactory replaces AuthenticatedConnectionFactory here because
// the worker has no per-request JWT to project; it already connects as its own
// narrowly-scoped `generation_worker` Postgres role, which database/schema.sql now grants
// read/write on organizations, quality_gate_definitions, quality_receipts,
// quality_gate_results, and session_assets. Registered Singleton (not Scoped) because
// this worker has no per-request DI scope — GenerationJobPollingService and
// AcademyBrainSubprocessExecutor above follow the same pattern.
builder.Services.AddSingleton<IAuthenticatedConnectionFactory, WorkerConnectionFactory>();
builder.Services.AddSingleton<IOrganizationRepository, NpgsqlOrganizationRepository>();
builder.Services.AddSingleton<IGateDefinitionRepository, NpgsqlGateDefinitionRepository>();
builder.Services.AddSingleton<IQualityReceiptRepository, NpgsqlQualityReceiptRepository>();

// STEP 11 Phase B, Batch 2: needed to resolve a job's organization (job.ProjectId ->
// CourseProject.OrganizationId -> Organization) and its registered session assets — neither
// had a worker-reachable repository before this batch. database/schema.sql's Batch 1 grants
// already cover course_projects/session_assets select for generation_worker.
builder.Services.AddSingleton<IProjectRepository, NpgsqlProjectRepository>();
builder.Services.AddSingleton<ISessionAssetRepository, NpgsqlSessionAssetRepository>();

// STEP 11 Phase B, Batch 3: nblm-prompt-preflight's fact-corrector needs CourseSession.
// DurationMinutes — no worker-reachable session repository existed before this batch.
// Same generation_worker grant story as course_projects/session_assets above
// (database/schema.sql already grants select on course_sessions).
builder.Services.AddSingleton<ISessionRepository, NpgsqlSessionRepository>();

// STEP 11 Phase B, Batch 2 (PDF-evidence slice): language_ratio/boundary_check evaluate the
// actual generated pass PDF, not source markdown. No PDF library exists in this C# codebase;
// academy-brain already depends on PyMuPDF, so extraction shells out to the small sibling
// script academy-brain/scripts/swarm/extract_pdf_text.py (see PythonPdfTextExtractor.cs).
// brand_palette needs a different kind of PDF evidence (real rendered vector-drawing colors,
// not text — the handoff explicitly rejects hex-in-text scanning as insufficient for
// generated decks), so it gets its own extractor/script pair
// (extract_pdf_colors.py / PythonPdfColorExtractor.cs).
builder.Services.AddSingleton<IPdfTextExtractor, PythonPdfTextExtractor>();
builder.Services.AddSingleton<IPdfColorExtractor, PythonPdfColorExtractor>();

// STEP 11 Phase B, Batch 3: pedagogy-coverage and nblm-prompt-preflight are Python-only
// (academy-brain gates.REGISTRY entries never ported to a Studio IQualityGate) — each
// gets its own side-channel script/adapter pair, exactly like the PDF extractors above.
builder.Services.AddSingleton<IPedagogyCoverageEvaluator, PythonPedagogyCoverageEvaluator>();
builder.Services.AddSingleton<INblmPromptPreflightEvaluator, PythonNblmPromptPreflightEvaluator>();
builder.Services.AddSingleton<INblmPromptRenderer, PythonNblmPromptRenderer>();
builder.Services.AddSingleton<IQualityGate, LanguageRatioGate>();
builder.Services.AddSingleton<IQualityGate, BoundaryCheckGate>();
builder.Services.AddSingleton<IQualityGate, BrandPaletteGate>();
builder.Services.AddSingleton<IQualityGate, AssetReconciliationGate>();
builder.Services.AddSingleton<IQualityGateRunner, GateRunnerService>();

// The repair-cascade orchestrator itself (shared machinery only — see
// ContentQualityCascadeOrchestrator's doc comment). STEP 11 Phase B, Batch 2 ships one real
// targeted-patch adapter (asset_reconciliation — see AssetReconciliationRepair.cs) plus real
// reevaluation evidence for all four STEP-3-ported gates: source markdown for
// asset_reconciliation, per-pass PDF text via IPdfTextExtractor for language_ratio/
// boundary_check, and per-pass rendered vector-drawing colors via IPdfColorExtractor for
// brand_palette. Batch2ContentQualityGateReevaluator still throws honestly (NotSupportedException)
// for any OTHER, still-unsupported gate code an organization enables, rather than silently
// skip it. PassRegenerationAdapter replaces Batch 1's "not implemented yet" placeholder: it
// shells out to generate_session.py's new --regenerate-pass flag, which quarantines the
// rejected pass PDF and fires exactly one fresh NotebookLM task for that pass alone — the
// only lever language_ratio/boundary_check/brand_palette have per the handoff's mapping
// table, since none of the three has a targeted-patch lever today. STEP 11 Phase B,
// Batch 3 adds the NBLM-prompt option's real tier-1 lever (NblmPromptPreflightFactCorrector
// — a deterministic re-render, never a regeneration) plus real reevaluation evidence for
// pedagogy-coverage and nblm-prompt-preflight, both wired into the same reevaluator class
// (see Batch2ContentQualityGateReevaluator's updated doc comment).
builder.Services.AddSingleton<IContentQualityRegenerationAdapter, PassRegenerationAdapter>();
builder.Services.AddSingleton<IContentQualityTargetedPatcher, AssetReconciliationTargetedPatcher>();
// NblmPromptPreflightFactCorrector is tier 1 only (see its doc comment — Codex's review
// caught that also registering it as the tier-2 targeted patcher let the identical re-render
// replay itself and falsely report a "patch" that changed nothing). Tier 2 is a legitimate
// no-op for this gate: the orchestrator's patcher lookup finds none registered for
// "nblm-prompt-preflight" and falls through to tier 3/4, same as every gate with no
// targeted-patch lever.
builder.Services.AddSingleton<IContentQualityFactCorrector, NblmPromptPreflightFactCorrector>();
builder.Services.AddSingleton<IContentQualityGateReevaluator, Batch2ContentQualityGateReevaluator>();
builder.Services.AddSingleton<IContentQualityCascadeOrchestrator, ContentQualityCascadeOrchestrator>();

var host = builder.Build();
host.Run();
