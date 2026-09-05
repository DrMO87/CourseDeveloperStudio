namespace CourseDeveloper.Core.Interfaces;

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// A correction/patch/regeneration adapter's result. NewArtifactVersion must be a real,
// new version the caller can re-evaluate gates against — never the same version
// re-labeled as "fixed."
public sealed record ContentQualityCorrectionResult(int NewArtifactVersion, string Description);

// Tier 1 (Standing Rule 10a-1): apply a deterministic correction using a fact the caller
// already knows to be true from an authoritative source (the job's immutable snapshot,
// org config). Must never compose, translate, summarize, or infer content. Return null
// when no such correction applies to this violation — that is an honest, expected
// outcome for most gates today, not a failure to implement one.
public interface IContentQualityFactCorrector
{
    string GateCode { get; }
    Task<ContentQualityCorrectionResult?> TryCorrectAsync(ContentQualityViolation violation, GenerationJob job, CancellationToken ct);
}

// Tier 2 (Standing Rule 10a-2, "targeted patch"): mechanically transform only the exact
// unit the gate's own evidence names (e.g. relink one citation to an asset already
// uniquely registered, restore one exact approved template field). Must never invent
// replacement prose. Return null when no targeted lever exists for this violation today.
public interface IContentQualityTargetedPatcher
{
    string GateCode { get; }
    Task<ContentQualityCorrectionResult?> TryPatchAsync(ContentQualityViolation violation, GenerationJob job, CancellationToken ct);
}

// Tier 3 (last resort): regenerate exactly one NotebookLM pass through the real
// authoring/generation operation. Implementations MUST refuse (return null) rather than
// guess when they cannot prove no task is already in flight for this pass, or when asked
// to run without pass-level evidence — never fall back to regenerating every pass.
public interface IContentQualityRegenerationAdapter
{
    Task<ContentQualityCorrectionResult?> TryRegeneratePassAsync(
        string artifactLineageId, string pass, GenerationJob job, CancellationToken ct);
}

// Re-evaluates every gate applicable to this artifact lineage/pass after any mutation
// (fact correction, targeted patch, or full regeneration) — "all-applicable-gates
// recheck," not just the gate that originally failed. Batch 2/3/4 supply the real
// per-gate-family implementation; Batch 1 only defines and calls this seam.
public interface IContentQualityGateReevaluator
{
    Task<List<ContentQualityViolation>> ReevaluateAsync(
        GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct);
}

public sealed record ContentQualityCascadeOutcome(
    bool Resolved,
    bool Exhausted,
    List<ContentQualityViolation> RemainingViolations,
    ContentQualityCascadeState State);

// The orchestration machinery itself (STEP 11 Phase B, Batch 1): runs the corrected
// cascade order (fact correction -> targeted patch -> last-resort regeneration -> honest
// exhaustion), enforces the shared cross-gate full-operation budget, and guarantees the
// whack-a-mole containment property (a newly-tripped gate after regeneration spends the
// same budget, never a fresh one).
public interface IContentQualityCascadeOrchestrator
{
    Task<ContentQualityCascadeOutcome> ProcessAsync(
        GenerationJob job,
        string artifactLineageId,
        int artifactVersion,
        string? pass,
        List<ContentQualityViolation> violations,
        CancellationToken ct);
}
