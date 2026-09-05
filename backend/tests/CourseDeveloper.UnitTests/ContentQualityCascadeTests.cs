namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

// STEP 11 Phase B, Batch 1. Exercises the two highest-stakes properties the handoff
// (docs/tickets/handoffs/step11-nblm-prompt-authoring.md Part 2) requires: (1) the
// origin+gateCode allowlist structurally excludes STEP 8b/STEP 12-shaped flows even when
// they otherwise resemble a cascade-eligible finding, and (2) the shared cross-gate
// full-operation budget never resets — a gate newly tripped by a regeneration still
// spends the same two-attempt allowance, converging to an honest exhaustion/reschedule
// rather than an unbounded whack-a-mole loop.
public class ContentQualityCascadeTests
{
    [Theory]
    [InlineData(ContentQualityGateCodes.ArabicRatio)]
    [InlineData(ContentQualityGateCodes.Boundary)]
    [InlineData(ContentQualityGateCodes.BrandPalette)]
    [InlineData(ContentQualityGateCodes.CitationFiltering)]
    [InlineData(ContentQualityGateCodes.PedagogyCoverage)]
    [InlineData(ContentQualityGateCodes.AssetReconciliation)]
    [InlineData(ContentQualityGateCodes.NblmPromptPreflight)]
    public void AllowlistedGateCodesAreCascadeEligibleUnderEitherAllowedOrigin(string gateCode)
    {
        Assert.True(Violation(gateCode, origin: ContentQualityOrigin.StudioQualityReceipt).IsCascadeEligible);
        Assert.True(Violation(gateCode, origin: ContentQualityOrigin.AcademyBrainRegistryGate).IsCascadeEligible);
    }

    [Theory]
    [InlineData("org-config-safety")]
    [InlineData("user-input-validation-failure")]
    [InlineData("")]
    public void UnknownOrExcludedGateCodesAreNeverCascadeEligible(string gateCode)
    {
        // Simulates a hypothetical future refactor where STEP 12's fail-closed org-config
        // check, or STEP 8b's user-input validation, somehow acquires an otherwise-allowed
        // Origin value. The gate-code half of the allowlist must independently reject it —
        // eligibility must never depend on origin alone.
        Assert.False(Violation(gateCode, origin: ContentQualityOrigin.StudioQualityReceipt).IsCascadeEligible);
        Assert.False(Violation(gateCode, origin: ContentQualityOrigin.AcademyBrainRegistryGate).IsCascadeEligible);
    }

    [Theory]
    [InlineData(GateVerdict.PASS)]
    [InlineData(GateVerdict.UNVERIFIED)]
    public void NonFailVerdictsCannotEnterCascade(GateVerdict verdict)
    {
        Assert.False(Violation(ContentQualityGateCodes.ArabicRatio, verdict: verdict).IsCascadeEligible);
    }

    [Fact]
    public void UndefinedOriginCannotEnterCascadeEvenWithAnAllowlistedGateCode()
    {
        Assert.False(Violation(ContentQualityGateCodes.ArabicRatio, origin: (ContentQualityOrigin)999).IsCascadeEligible);
    }

    [Fact]
    public void NonBlockingFailureCannotEnterCascadeEvenWithAllowedOriginAndGateCode()
    {
        Assert.False(Violation(ContentQualityGateCodes.ArabicRatio, isBlocking: false).IsCascadeEligible);
    }

    [Fact]
    public async Task ProcessAsync_ThrowsRatherThanSilentlyProcessing_WhenGivenANonEligibleViolation()
    {
        var repo = new FakeGenerationJobRepository();
        var orchestrator = CreateOrchestrator(repo, reevaluator: new VersionedReevaluator(new()));

        await Assert.ThrowsAsync<InvalidOperationException>(() => orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, "deck-a",
            new List<ContentQualityViolation> { Violation("org-config-safety") },
            CancellationToken.None));

        Assert.Empty(repo.RescheduleCalls);
    }

    [Fact]
    public async Task ProcessAsync_ResolvesWhenADeterministicFactCorrectionClearsTheOnlyFinding()
    {
        var repo = new FakeGenerationJobRepository();
        var corrector = new FakeCorrector(ContentQualityGateCodes.NblmPromptPreflight, newVersion: 2);
        var reevaluator = new VersionedReevaluator(new()
        {
            [2] = new List<ContentQualityViolation>(), // corrected artifact re-checks clean
        });
        var orchestrator = CreateOrchestrator(repo, correctors: new[] { corrector }, reevaluator: reevaluator);

        var outcome = await orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, "deck-a",
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.NblmPromptPreflight, version: 1) },
            CancellationToken.None);

        Assert.True(outcome.Resolved);
        Assert.False(outcome.Exhausted);
        Assert.Equal(1, corrector.CallCount);
        Assert.Empty(repo.RescheduleCalls);
    }

    [Fact]
    public async Task ProcessAsync_RefusesToRegenerate_AndExhaustsHonestly_WhenNoPassCanBeAttributed()
    {
        var repo = new FakeGenerationJobRepository();
        var regenAdapter = new SequentialRegenAdapter(Array.Empty<int?>());
        var reevaluator = new VersionedReevaluator(new()
        {
            [1] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.PedagogyCoverage, version: 1, pass: null) },
        });
        var orchestrator = CreateOrchestrator(repo, regenAdapter: regenAdapter, reevaluator: reevaluator);

        var outcome = await orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, pass: null,
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.PedagogyCoverage, version: 1, pass: null) },
            CancellationToken.None);

        Assert.False(outcome.Resolved);
        Assert.True(outcome.Exhausted);
        Assert.Equal(0, regenAdapter.CallCount);
        Assert.Single(repo.RescheduleCalls);
        Assert.Equal(0, outcome.State.FullOperationAttemptsUsed);
    }

    [Fact]
    public async Task ProcessAsync_SharedFullOperationBudgetNeverResetsWhenRegenerationTripsADifferentGate()
    {
        // Gate A fails; regeneration #1 "fixes" A but the reevaluator reports gate B
        // failing on the new version instead (the exact whack-a-mole scenario the user
        // flagged). Regeneration #2 still doesn't clear everything. The cascade must
        // exhaust at exactly MaxFullOperationAttemptsPerCycle spent — never a fresh
        // allowance because the failing gate's name changed.
        var repo = new FakeGenerationJobRepository();
        var regenAdapter = new SequentialRegenAdapter(new int?[] { 2, 3 });
        var reevaluator = new VersionedReevaluator(new()
        {
            [1] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.ArabicRatio, version: 1, pass: "deck-a") },
            [2] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.Boundary, version: 2, pass: "deck-a") },
            [3] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.Boundary, version: 3, pass: "deck-a") },
        });
        var orchestrator = CreateOrchestrator(repo, regenAdapter: regenAdapter, reevaluator: reevaluator);

        var outcome = await orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, "deck-a",
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.ArabicRatio, version: 1, pass: "deck-a") },
            CancellationToken.None);

        Assert.False(outcome.Resolved);
        Assert.True(outcome.Exhausted);
        Assert.Equal(2, regenAdapter.CallCount);
        Assert.Equal(ContentQualityCascadeOrchestrator.MaxFullOperationAttemptsPerCycle, outcome.State.FullOperationAttemptsUsed);
        Assert.Single(repo.RescheduleCalls);
    }

    [Fact]
    public async Task ProcessAsync_PersistsSpentFullOperationAttemptBeforeCallingRegeneration()
    {
        var repo = new FakeGenerationJobRepository();
        var regenAdapter = new PersistenceObservingRegenAdapter(repo);
        var reevaluator = new VersionedReevaluator(new()
        {
            [1] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.ArabicRatio) },
        });
        var orchestrator = CreateOrchestrator(repo, regenAdapter: regenAdapter, reevaluator: reevaluator);

        await orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, "deck-a",
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.ArabicRatio) },
            CancellationToken.None);

        Assert.True(regenAdapter.SawPersistedAttemptBeforeCall);
        Assert.Single(repo.ProgressPersistCalls);
    }

    [Fact]
    public async Task ProcessAsync_ReevaluatorReturningANonEligibleViolation_ThrowsRatherThanSilentlyAccepting()
    {
        var repo = new FakeGenerationJobRepository();
        var reevaluator = new VersionedReevaluator(new()
        {
            [1] = new List<ContentQualityViolation> { Violation("org-config-safety", version: 1) },
        });
        var orchestrator = CreateOrchestrator(repo, reevaluator: reevaluator);

        await Assert.ThrowsAsync<InvalidOperationException>(() => orchestrator.ProcessAsync(
            NewJob(), "lineage-1", 1, "deck-a",
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.ArabicRatio, version: 1, pass: "deck-a") },
            CancellationToken.None));
    }

    [Fact]
    public async Task ProcessAsync_RetainsSpentBudgetAfterJsonDatabaseRoundTrip()
    {
        var persistedState = new ContentQualityCascadeState
        {
            ArtifactLineageId = "lineage-1",
            Pass = "deck-a",
            CurrentArtifactVersion = 4,
            Cycle = 3,
            FullOperationAttemptsUsed = ContentQualityCascadeOrchestrator.MaxFullOperationAttemptsPerCycle,
        };
        var job = NewJob();
        job.Progress["contentQualityCascade"] = JsonSerializer.SerializeToElement(
            persistedState,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var repo = new FakeGenerationJobRepository();
        var regenAdapter = new SequentialRegenAdapter(new int?[] { 5 });
        var reevaluator = new VersionedReevaluator(new()
        {
            [4] = new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.Boundary, version: 4) },
        });
        var orchestrator = CreateOrchestrator(repo, regenAdapter: regenAdapter, reevaluator: reevaluator);

        var outcome = await orchestrator.ProcessAsync(
            job, "lineage-1", 4, "deck-a",
            new List<ContentQualityViolation> { Violation(ContentQualityGateCodes.Boundary, version: 4) },
            CancellationToken.None);

        Assert.True(outcome.Exhausted);
        Assert.Equal(ContentQualityCascadeOrchestrator.MaxFullOperationAttemptsPerCycle, outcome.State.FullOperationAttemptsUsed);
        Assert.Equal(0, regenAdapter.CallCount);
    }

    private static ContentQualityViolation Violation(
        string gateCode,
        string lineage = "lineage-1",
        int version = 1,
        string? pass = "deck-a",
        ContentQualityOrigin origin = ContentQualityOrigin.AcademyBrainRegistryGate,
        GateVerdict verdict = GateVerdict.FAIL,
        bool isBlocking = true)
        => new()
        {
            Origin = origin,
            GateCode = gateCode,
            ArtifactLineageId = lineage,
            ArtifactVersion = version,
            Pass = pass,
            Verdict = verdict,
            IsBlocking = isBlocking,
            Detail = "test violation",
        };

    private static GenerationJob NewJob() => new()
    {
        Id = Guid.NewGuid(),
        ClaimedBy = "test-worker",
    };

    private static ContentQualityCascadeOrchestrator CreateOrchestrator(
        FakeGenerationJobRepository repo,
        IEnumerable<IContentQualityFactCorrector>? correctors = null,
        IEnumerable<IContentQualityTargetedPatcher>? patchers = null,
        IContentQualityRegenerationAdapter? regenAdapter = null,
        IContentQualityGateReevaluator? reevaluator = null)
        => new(
            correctors ?? Array.Empty<IContentQualityFactCorrector>(),
            patchers ?? Array.Empty<IContentQualityTargetedPatcher>(),
            regenAdapter ?? new SequentialRegenAdapter(Array.Empty<int?>()),
            reevaluator ?? new VersionedReevaluator(new()),
            repo,
            NullLogger<ContentQualityCascadeOrchestrator>.Instance);

    private sealed class FakeCorrector : IContentQualityFactCorrector
    {
        private readonly int? _newVersion;
        public string GateCode { get; }
        public int CallCount { get; private set; }

        public FakeCorrector(string gateCode, int? newVersion)
        {
            GateCode = gateCode;
            _newVersion = newVersion;
        }

        public Task<ContentQualityCorrectionResult?> TryCorrectAsync(ContentQualityViolation violation, GenerationJob job, CancellationToken ct)
        {
            CallCount++;
            return Task.FromResult(_newVersion is int v ? new ContentQualityCorrectionResult(v, "fact-corrected") : null);
        }
    }

    private sealed class SequentialRegenAdapter : IContentQualityRegenerationAdapter
    {
        private readonly Queue<int?> _versions;
        public int CallCount { get; private set; }

        public SequentialRegenAdapter(IEnumerable<int?> versions)
        {
            _versions = new Queue<int?>(versions);
        }

        public Task<ContentQualityCorrectionResult?> TryRegeneratePassAsync(string artifactLineageId, string pass, GenerationJob job, CancellationToken ct)
        {
            CallCount++;
            var next = _versions.Count > 0 ? _versions.Dequeue() : null;
            return Task.FromResult(next is int v ? new ContentQualityCorrectionResult(v, "regenerated pass " + pass) : null);
        }
    }

    private sealed class PersistenceObservingRegenAdapter : IContentQualityRegenerationAdapter
    {
        private readonly FakeGenerationJobRepository _repo;
        public bool SawPersistedAttemptBeforeCall { get; private set; }

        public PersistenceObservingRegenAdapter(FakeGenerationJobRepository repo)
        {
            _repo = repo;
        }

        public Task<ContentQualityCorrectionResult?> TryRegeneratePassAsync(string artifactLineageId, string pass, GenerationJob job, CancellationToken ct)
        {
            SawPersistedAttemptBeforeCall = _repo.ProgressPersistCalls.Count == 1;
            return Task.FromResult<ContentQualityCorrectionResult?>(null);
        }
    }

    // Keyed by artifact version rather than call sequence — the orchestrator legitimately
    // reevaluates the same version more than once (after tier 1 and again after tier 2
    // when neither adapter is registered for a gate), and a version-keyed fake matches
    // real gate evaluation semantics far more faithfully than a call-count script would.
    private sealed class VersionedReevaluator : IContentQualityGateReevaluator
    {
        private readonly Dictionary<int, List<ContentQualityViolation>> _byVersion;
        public List<int> QueriedVersions { get; } = new();

        public VersionedReevaluator(Dictionary<int, List<ContentQualityViolation>> byVersion)
        {
            _byVersion = byVersion;
        }

        public Task<List<ContentQualityViolation>> ReevaluateAsync(GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
        {
            QueriedVersions.Add(artifactVersion);
            var violations = _byVersion.TryGetValue(artifactVersion, out var list) ? list : new List<ContentQualityViolation>();
            return Task.FromResult(violations.ToList());
        }
    }

    private sealed class FakeGenerationJobRepository : IGenerationJobRepository
    {
        public List<(Dictionary<string, object> Progress, DateTime NextAttemptAt, Dictionary<string, object>? ErrorDetails)> RescheduleCalls { get; } = new();
        public List<Dictionary<string, object>> ProgressPersistCalls { get; } = new();
        public List<(string EventType, Dictionary<string, object>? Detail)> Events { get; } = new();

        public Task<GenerationJob> EnqueueAsync(GenerationJob job) => throw new NotSupportedException();
        public Task<GenerationJob?> GetByIdAsync(Guid id) => throw new NotSupportedException();
        public Task<GenerationJob?> ClaimNextAsync(string workerId, TimeSpan leaseDuration) => throw new NotSupportedException();
        public Task<bool> MarkRunningAsync(Guid jobId, string workerId) => throw new NotSupportedException();
        public Task<bool> HeartbeatAsync(Guid jobId, string workerId, TimeSpan leaseDuration) => throw new NotSupportedException();
        public Task<bool> RequestCancelAsync(Guid jobId) => throw new NotSupportedException();
        public Task<bool> CompleteAsync(Guid jobId, string workerId, Dictionary<string, object> resultManifest) => throw new NotSupportedException();
        public Task FailAsync(Guid jobId, string workerId, Dictionary<string, object> errorDetails, bool retryable) => throw new NotSupportedException();
        public Task<bool> CancelAsync(Guid jobId, string workerId) => throw new NotSupportedException();
        public Task<int> RecoverExpiredLeasesAsync() => throw new NotSupportedException();

        public Task AppendEventAsync(Guid jobId, string eventType, Dictionary<string, object>? detail = null)
        {
            Events.Add((eventType, detail));
            return Task.CompletedTask;
        }

        public Task RescheduleContentQualityAsync(
            Guid jobId, string workerId, Dictionary<string, object> progress, DateTime nextAttemptAt, Dictionary<string, object>? errorDetails = null)
        {
            RescheduleCalls.Add((progress, nextAttemptAt, errorDetails));
            return Task.CompletedTask;
        }

        public Task PersistContentQualityProgressAsync(Guid jobId, string workerId, Dictionary<string, object> progress)
        {
            ProgressPersistCalls.Add(progress);
            return Task.CompletedTask;
        }
    }
}
