namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

// STEP 11 Phase B, Batch 1. Origin of a would-be cascade violation. This is deliberately
// a closed enum, not "any QualityGateResult" or "any GateResult" — see
// ContentQualityViolation.IsCascadeEligible for why CLR type alone was rejected as the
// exception boundary (docs/tickets/handoffs/step11-nblm-prompt-authoring.md Part 2).
public enum ContentQualityOrigin
{
    StudioQualityReceipt,
    AcademyBrainRegistryGate,
}

// The closed allowlist of gate codes the repair cascade (Standing Rule 10a) may ever
// touch. STEP 8b's user-input validation and STEP 12's fail-closed org-config check
// must never appear here — see ContentQualityCascadeTests for the negative contract
// tests proving an excluded flow cannot enter by acquiring a matching origin/code.
public static class ContentQualityGateCodes
{
    public const string ArabicRatio = "language_ratio";
    public const string Boundary = "boundary_check";
    public const string BrandPalette = "brand_palette";
    public const string CitationFiltering = "cite-filter";
    public const string PedagogyCoverage = "pedagogy-coverage";
    public const string AssetReconciliation = "asset_reconciliation";
    public const string NblmPromptPreflight = "nblm-prompt-preflight";

    public static readonly IReadOnlyCollection<string> Allowlisted = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ArabicRatio, Boundary, BrandPalette, CitationFiltering, PedagogyCoverage, AssetReconciliation, NblmPromptPreflight,
    };

    public static bool IsAllowlisted(string gateCode) => Allowlisted.Contains(gateCode);
}

// One blocking gate finding being considered for the repair cascade. Adapters that sit
// in front of Studio's GateRunnerService and academy-brain's registry gates are the only
// two places allowed to construct this type with a real Origin — never construct one
// speculatively from an unrelated failure just to "make retries happen."
public sealed class ContentQualityViolation
{
    public required ContentQualityOrigin Origin { get; init; }
    public required string GateCode { get; init; }
    public required string ArtifactLineageId { get; init; }
    public required int ArtifactVersion { get; init; }

    // deck-a / deck-b / summary where the violation is attributable to one NotebookLM
    // pass. Null when the evidence cannot attribute a single pass (e.g. a pre-generation
    // check) — a null Pass means tier 3 (regeneration) cannot run for this violation,
    // per the handoff: "must not default to regenerating all passes."
    public string? Pass { get; init; }

    // The smallest unit the gate's own evidence can name (an issue id, a citation span,
    // a template field) — used by targeted patchers to know exactly what to touch.
    public string? EvidenceUnit { get; init; }

    public required GateVerdict Verdict { get; init; }
    public required bool IsBlocking { get; init; }
    public string? Detail { get; init; }
    public Dictionary<string, object> Evidence { get; init; } = new();

    // The structural exception boundary: BOTH an allowed origin AND an allowlisted gate
    // code are required. Changing only Origin's value, or only GateCode, is never
    // sufficient by itself to become eligible.
    public bool IsCascadeEligible =>
        (Origin == ContentQualityOrigin.StudioQualityReceipt || Origin == ContentQualityOrigin.AcademyBrainRegistryGate)
        && ContentQualityGateCodes.IsAllowlisted(GateCode)
        && IsBlocking
        && Verdict == GateVerdict.FAIL;
}

// Per-finding repair history within one cascade cycle. FactCorrectionUsed/TargetedPatchUsed
// each cap at one attempt per finding — see the handoff's "Concrete cascade numbers" table.
public sealed class ContentQualityFinding
{
    public required string GateCode { get; init; }
    public string? EvidenceUnit { get; set; }
    public bool FactCorrectionUsed { get; set; }
    public bool TargetedPatchUsed { get; set; }
    public GateVerdict Verdict { get; set; }
}

// The repair-cycle ledger, persisted at GenerationJob.Progress["contentQualityCascade"]
// (no new column — Standing Rule 7 / the handoff's explicit "reuse Progress" decision).
// Keyed conceptually by (job, ArtifactLineageId, Pass, Cycle); FullOperationAttemptsUsed
// is the shared cross-gate last-resort budget and must never be reset by a gate-code
// change, a new ArtifactVersion, a worker restart, or an ordinary re-claim — only the
// scheduler may open a new Cycle, and only after the prescribed backoff.
public sealed class ContentQualityCascadeState
{
    public string ArtifactLineageId { get; set; } = string.Empty;
    public int CurrentArtifactVersion { get; set; }
    public string? Pass { get; set; }
    public int Cycle { get; set; } = 1;
    public int FullOperationAttemptsUsed { get; set; }
    public List<ContentQualityFinding> Findings { get; set; } = new();
    public List<string> GateSetBefore { get; set; } = new();
    public List<string> GateSetAfter { get; set; } = new();
}
