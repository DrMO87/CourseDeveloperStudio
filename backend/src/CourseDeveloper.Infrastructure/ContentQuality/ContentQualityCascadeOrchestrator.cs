namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.Extensions.Logging;

// STEP 11 Phase B, Batch 1: the shared cascade machinery from
// docs/tickets/handoffs/step11-nblm-prompt-authoring.md Part 2 ("Corrected cascade
// order"). This class owns tiering, the shared cross-gate full-operation budget, and the
// whack-a-mole containment property. It does NOT know how to actually correct, patch, or
// regenerate any specific gate's content — those are supplied per gate code by Batch
// 2/3/4 via IContentQualityFactCorrector/IContentQualityTargetedPatcher/
// IContentQualityRegenerationAdapter. An empty adapter set is a legitimate, honest
// starting state: every violation simply falls through to last-resort regeneration (or,
// if that has no lever either, to exhaustion) rather than being silently dropped.
public sealed class ContentQualityCascadeOrchestrator : IContentQualityCascadeOrchestrator
{
    // "At most 2 fresh authoring/generation invocations total for one artifact-lineage/
    // pass repair cycle, shared across every gate code encountered in that cycle" — see
    // the handoff's numbers table. This is initial operating policy, not a derived
    // constant; review after telemetry per the handoff's own note.
    public const int MaxFullOperationAttemptsPerCycle = 2;
    private const string ProgressKey = "contentQualityCascade";

    private readonly IReadOnlyDictionary<string, IContentQualityFactCorrector> _correctors;
    private readonly IReadOnlyDictionary<string, IContentQualityTargetedPatcher> _patchers;
    private readonly IContentQualityRegenerationAdapter _regenerationAdapter;
    private readonly IContentQualityGateReevaluator _reevaluator;
    private readonly IGenerationJobRepository _jobRepository;
    private readonly ILogger<ContentQualityCascadeOrchestrator> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ContentQualityCascadeOrchestrator(
        IEnumerable<IContentQualityFactCorrector> correctors,
        IEnumerable<IContentQualityTargetedPatcher> patchers,
        IContentQualityRegenerationAdapter regenerationAdapter,
        IContentQualityGateReevaluator reevaluator,
        IGenerationJobRepository jobRepository,
        ILogger<ContentQualityCascadeOrchestrator> logger)
    {
        _correctors = correctors.ToDictionary(c => c.GateCode, StringComparer.OrdinalIgnoreCase);
        _patchers = patchers.ToDictionary(p => p.GateCode, StringComparer.OrdinalIgnoreCase);
        _regenerationAdapter = regenerationAdapter;
        _reevaluator = reevaluator;
        _jobRepository = jobRepository;
        _logger = logger;
    }

    public async Task<ContentQualityCascadeOutcome> ProcessAsync(
        GenerationJob job,
        string artifactLineageId,
        int artifactVersion,
        string? pass,
        List<ContentQualityViolation> violations,
        CancellationToken ct)
    {
        var ineligible = violations.Where(v => !v.IsCascadeEligible).ToList();
        if (ineligible.Count > 0)
        {
            // Defensive: callers must filter to cascade-eligible violations before
            // reaching the orchestrator. Reaching this line means an excluded flow
            // (STEP 8b, STEP 12, or an unknown gate code) almost got routed through the
            // repair cascade — fail loudly rather than silently drop or silently accept it.
            throw new InvalidOperationException(
                $"Job {job.Id}: {ineligible.Count} violation(s) reached the content-quality cascade without " +
                "cascade eligibility (origin/gateCode not on the allowlist). Refusing to process any violations " +
                "for this call rather than risk one excluded flow slipping through alongside the eligible ones.");
        }

        var state = LoadState(job, artifactLineageId, pass, artifactVersion);
        var current = violations;

        if (current.Count == 0)
        {
            state.GateSetAfter = new List<string>();
            SaveState(job, state);
            return new ContentQualityCascadeOutcome(Resolved: true, Exhausted: false, RemainingViolations: current, state);
        }

        state.GateSetBefore = current.Select(v => v.GateCode).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        while (true)
        {
            // Tier 1: deterministic fact correction, at most one attempt per finding.
            foreach (var violation in current)
            {
                var finding = GetOrAddFinding(state, violation);
                if (finding.FactCorrectionUsed)
                {
                    continue;
                }

                finding.FactCorrectionUsed = true;
                if (_correctors.TryGetValue(violation.GateCode, out var corrector))
                {
                    var result = await corrector.TryCorrectAsync(violation, job, ct);
                    if (result is not null)
                    {
                        artifactVersion = result.NewArtifactVersion;
                        await LogCascadeEventAsync(job.Id, "content_quality_fact_correction", violation, artifactLineageId, pass, artifactVersion, result.Description, state);
                    }
                }
            }

            current = await ReevaluateAsync(job, artifactLineageId, artifactVersion, pass, ct);
            state.CurrentArtifactVersion = artifactVersion;
            if (current.Count == 0)
            {
                return await ResolveAsync(job, state, artifactVersion, current, ct);
            }

            // Tier 2: targeted patch, at most one attempt per finding+artifact version.
            foreach (var violation in current)
            {
                var finding = GetOrAddFinding(state, violation);
                if (finding.TargetedPatchUsed)
                {
                    continue;
                }

                finding.TargetedPatchUsed = true;
                if (_patchers.TryGetValue(violation.GateCode, out var patcher))
                {
                    var result = await patcher.TryPatchAsync(violation, job, ct);
                    if (result is not null)
                    {
                        artifactVersion = result.NewArtifactVersion;
                        await LogCascadeEventAsync(job.Id, "content_quality_targeted_patch", violation, artifactLineageId, pass, artifactVersion, result.Description, state);
                    }
                }
            }

            current = await ReevaluateAsync(job, artifactLineageId, artifactVersion, pass, ct);
            state.CurrentArtifactVersion = artifactVersion;
            if (current.Count == 0)
            {
                return await ResolveAsync(job, state, artifactVersion, current, ct);
            }

            // Tier 3: full regeneration, last resort, shared cross-gate budget.
            if (state.FullOperationAttemptsUsed >= MaxFullOperationAttemptsPerCycle)
            {
                return await ExhaustAsync(job, state, current, "full_operation_budget_exhausted", ct);
            }

            if (pass is null)
            {
                // No evidence attributes this violation to a single pass — the handoff is
                // explicit that this must never default to regenerating every pass.
                return await ExhaustAsync(job, state, current, "no_pass_scoped_regeneration_available", ct);
            }

            // Increment BEFORE the call and never reset it — this is the whack-a-mole
            // containment property. A gate-code change, a new artifact version, a worker
            // restart, or an ordinary re-claim must never reset this counter; only
            // ResolveAsync (success) or the scheduler opening a brand-new cycle after
            // backoff may move past it.
            state.FullOperationAttemptsUsed++;
            SaveState(job, state);
            await _jobRepository.PersistContentQualityProgressAsync(
                job.Id,
                job.ClaimedBy ?? throw new InvalidOperationException($"Job {job.Id} has no worker owner."),
                job.Progress);

            var regenResult = await _regenerationAdapter.TryRegeneratePassAsync(artifactLineageId, pass, job, ct);
            await LogCascadeEventAsync(
                job.Id, "content_quality_full_regeneration", current[0], artifactLineageId, pass, artifactVersion,
                regenResult?.Description ?? "no real regeneration operation available", state);

            if (regenResult is null)
            {
                return await ExhaustAsync(job, state, current, "regeneration_adapter_declined", ct);
            }

            artifactVersion = regenResult.NewArtifactVersion;
            current = await ReevaluateAsync(job, artifactLineageId, artifactVersion, pass, ct);
            state.CurrentArtifactVersion = artifactVersion;
            // Loop back to the top: the freshly-regenerated artifact gets the same
            // opportunity for a tier-1/tier-2 fix on any NEW finding before the next
            // full-regeneration attempt would be considered.
        }
    }

    private static Task<ContentQualityCascadeOutcome> ResolveAsync(
        GenerationJob job, ContentQualityCascadeState state, int artifactVersion, List<ContentQualityViolation> current, CancellationToken ct)
    {
        state.CurrentArtifactVersion = artifactVersion;
        state.GateSetAfter = new List<string>();
        SaveState(job, state);
        return Task.FromResult(new ContentQualityCascadeOutcome(Resolved: true, Exhausted: false, RemainingViolations: current, state));
    }

    private async Task<ContentQualityCascadeOutcome> ExhaustAsync(
        GenerationJob job, ContentQualityCascadeState state, List<ContentQualityViolation> current, string reason, CancellationToken ct)
    {
        state.GateSetAfter = current.Select(v => v.GateCode).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        // Use the current cycle number to size this backoff (5 -> 15 -> 60 minutes, then
        // a 6-hour plateau), then advance the cycle counter for next time. Advancing the
        // cycle changes only the backoff duration and the alert-escalation threshold — it
        // NEVER grants a fresh FullOperationAttemptsUsed allowance. That budget stays
        // permanently spent for this artifact lineage/pass until a human resolves it.
        var errorDetails = new Dictionary<string, object>
        {
            ["reason"] = reason,
            ["remainingGateCodes"] = state.GateSetAfter,
            ["cycle"] = state.Cycle,
            ["fullOperationAttemptsUsed"] = state.FullOperationAttemptsUsed,
        };
        var nextAttemptAt = DateTime.UtcNow.Add(ContentQualityBackoffSchedule.DelayForCycle(state.Cycle));
        state.Cycle++;
        var progress = ProgressWithState(job, state);

        await _jobRepository.RescheduleContentQualityAsync(job.Id, job.ClaimedBy ?? string.Empty, progress, nextAttemptAt, errorDetails);
        await _jobRepository.AppendEventAsync(job.Id, "content_quality_alert", errorDetails);

        _logger.LogWarning(
            "Job {JobId}: content-quality cascade exhausted for cycle {Cycle} ({Reason}); rescheduled for {NextAttemptAt:o}.",
            job.Id, state.Cycle, reason, nextAttemptAt);

        return new ContentQualityCascadeOutcome(Resolved: false, Exhausted: true, RemainingViolations: current, state);
    }

    private async Task<List<ContentQualityViolation>> ReevaluateAsync(GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
    {
        var results = await _reevaluator.ReevaluateAsync(job, artifactLineageId, artifactVersion, pass, ct);
        var ineligible = results.Where(v => !v.IsCascadeEligible).ToList();
        if (ineligible.Count > 0)
        {
            throw new InvalidOperationException(
                $"Job {job.Id}: gate reevaluation returned {ineligible.Count} non-cascade-eligible violation(s). " +
                "A reevaluator must only ever surface violations that satisfy the same origin/gateCode allowlist.");
        }

        return results;
    }

    private static ContentQualityFinding GetOrAddFinding(ContentQualityCascadeState state, ContentQualityViolation violation)
    {
        var existing = state.Findings.FirstOrDefault(f => string.Equals(f.GateCode, violation.GateCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.EvidenceUnit = violation.EvidenceUnit;
            existing.Verdict = violation.Verdict;
            return existing;
        }

        var created = new ContentQualityFinding
        {
            GateCode = violation.GateCode,
            EvidenceUnit = violation.EvidenceUnit,
            Verdict = violation.Verdict,
        };
        state.Findings.Add(created);
        return created;
    }

    private ContentQualityCascadeState LoadState(GenerationJob job, string artifactLineageId, string? pass, int artifactVersion)
    {
        if (job.Progress.TryGetValue(ProgressKey, out var raw))
        {
            ContentQualityCascadeState? existing = raw switch
            {
                JsonElement element => element.Deserialize<ContentQualityCascadeState>(JsonOptions),
                _ => JsonSerializer.Deserialize<ContentQualityCascadeState>(JsonSerializer.Serialize(raw, JsonOptions), JsonOptions),
            };

            // Same artifact lineage/pass keeps its ledger (in particular
            // FullOperationAttemptsUsed) exactly as-is — that persistence across worker
            // restarts/re-claims is the whack-a-mole containment property. A genuinely
            // different lineage or pass is a different repair problem and starts fresh.
            if (existing is not null
                && string.Equals(existing.ArtifactLineageId, artifactLineageId, StringComparison.Ordinal)
                && string.Equals(existing.Pass, pass, StringComparison.Ordinal))
            {
                return existing;
            }
        }

        return new ContentQualityCascadeState
        {
            ArtifactLineageId = artifactLineageId,
            Pass = pass,
            CurrentArtifactVersion = artifactVersion,
            Cycle = 1,
            FullOperationAttemptsUsed = 0,
        };
    }

    private static void SaveState(GenerationJob job, ContentQualityCascadeState state)
    {
        job.Progress[ProgressKey] = state;
    }

    private Dictionary<string, object> ProgressWithState(GenerationJob job, ContentQualityCascadeState state)
    {
        SaveState(job, state);
        return job.Progress;
    }

    private async Task LogCascadeEventAsync(
        Guid jobId, string eventType, ContentQualityViolation violation, string artifactLineageId, string? pass,
        int artifactVersion, string description, ContentQualityCascadeState state)
    {
        await _jobRepository.AppendEventAsync(jobId, eventType, new Dictionary<string, object>
        {
            ["gateCode"] = violation.GateCode,
            ["artifactLineageId"] = artifactLineageId,
            ["pass"] = pass ?? string.Empty,
            ["artifactVersion"] = artifactVersion,
            ["evidenceUnit"] = violation.EvidenceUnit ?? string.Empty,
            ["cycle"] = state.Cycle,
            ["fullOperationAttemptsUsed"] = state.FullOperationAttemptsUsed,
            ["description"] = description,
        });
    }
}
