namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
using CourseDeveloper.Infrastructure.QualityGates;
using Xunit;

// STEP 11 Phase B, Batch 2. Exercises the one real repair lever this batch ships
// (asset_reconciliation's targeted patch) against a real temp-directory filesystem — no
// fake/in-memory file system — plus the reevaluator's honest refusal for organizations still
// using the three PDF-evidence gate codes this batch does not build evidence for.
public class AssetReconciliationRepairTests : IDisposable
{
    private readonly string _vaultRoot;

    public AssetReconciliationRepairTests()
    {
        _vaultRoot = Path.Combine(Path.GetTempPath(), "cqs-batch2-" + Guid.NewGuid().ToString("N"));
    }

    public void Dispose()
    {
        if (Directory.Exists(_vaultRoot))
        {
            Directory.Delete(_vaultRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TryPatchAsync_RefusesWhitespaceOnlyAssetIdMatch_ThatTheRealGateCannotResolve()
    {
        // The real gate trims citations but not registered AssetIds. Rewriting this citation
        // to the whitespace-bearing stored ID would therefore still fail re-evaluation.
        var sessionId = Guid.NewGuid();
        var bundleDir = WriteSourceFile("L1-s1", "slides-source.md",
            "Intro slide.\n\n**Asset:** `img-old-typo`\n\nMore text.");
        var job = NewJob(sessionId, "L1-s1");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "img-old-typo ", FilePath = "assets/unrelated-name.png" },
            }));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.Null(result);
        var updated = await File.ReadAllTextAsync(Path.Combine(bundleDir, "slides-source.md"));
        Assert.Contains("**Asset:** `img-old-typo`", updated);
    }

    [Fact]
    public async Task TryPatchAsync_RelinksUniqueCaseMismatchedFileBasename_AndRealGatePasses()
    {
        var sessionId = Guid.NewGuid();
        var bundleDir = WriteSourceFile("L1-basename", "slides-source.md", "**Asset:** `IMG-42.PNG`");
        var job = NewJob(sessionId, "L1-basename");
        var assets = new List<SessionAsset>
        {
            new() { SessionId = sessionId, AssetId = "asset-42", FilePath = "assets/img-42.png" },
        };
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, assets));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.NotNull(result);
        var updated = await File.ReadAllTextAsync(Path.Combine(bundleDir, "slides-source.md"));
        Assert.Equal(GateVerdict.PASS, new AssetReconciliationGate().Evaluate(updated, assets).Verdict);
    }

    [Fact]
    public async Task TryPatchAsync_RefusesToGuess_WhenMultipleRegisteredAssetsNormalizeToTheSameMatch()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-s3", "slides-source.md", "**Asset:** `DaNgLiNg-ReF`");
        var job = NewJob(sessionId, "L1-s3");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                // Both stored basenames normalize (case-fold) to "dangling-ref" — two authoritative
                // candidates, so the unique-match requirement is not met and the adapter must
                // decline rather than pick one.
                new() { SessionId = sessionId, AssetId = "asset-one", FilePath = "assets/DANGLING-REF" },
                new() { SessionId = sessionId, AssetId = "asset-two", FilePath = "assets/dangling-ref" },
            }));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryPatchAsync_UsesTheGateCaseSensitiveFilePathResolutionRule()
    {
        var sessionId = Guid.NewGuid();
        var bundleDir = WriteSourceFile("L1-path-case", "slides-source.md", "**Asset:** `IMG-1`");
        var job = NewJob(sessionId, "L1-path-case");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "IMG-1 ", FilePath = "assets/img-1.png" },
            }));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.Null(result);
        Assert.Contains("`IMG-1`", await File.ReadAllTextAsync(Path.Combine(bundleDir, "slides-source.md")));
    }

    [Fact]
    public async Task TryPatchAsync_RewritesOnlyOneCitationPerPatchAttempt()
    {
        var sessionId = Guid.NewGuid();
        var bundleDir = WriteSourceFile("L1-s3c", "slides-source.md",
            "**Asset:** `DANGLING.PNG`\n\n**Asset:** `DANGLING.PNG`");
        var job = NewJob(sessionId, "L1-s3c");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "asset-1", FilePath = "assets/dangling.png" },
            }));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.NotNull(result);
        var updated = await File.ReadAllTextAsync(Path.Combine(bundleDir, "slides-source.md"));
        Assert.Single(Regex.Matches(updated, @"`dangling.png`").Cast<Match>());
        Assert.Single(Regex.Matches(updated, @"`DANGLING.PNG`").Cast<Match>());
    }

    [Fact]
    public async Task TryPatchAsync_ReturnsNull_WhenNoRegisteredAssetMatchesAtAll()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-s3b", "slides-source.md", "**Asset:** `dangling-ref`");
        var job = NewJob(sessionId, "L1-s3b");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "candidate-a", FilePath = "assets/candidate-a.png" },
                new() { SessionId = sessionId, AssetId = "candidate-b", FilePath = "assets/candidate-b.png" },
            }));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryPatchAsync_ReturnsNull_WhenSourceFileDoesNotExist()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-missing");
        var patcher = new AssetReconciliationTargetedPatcher(
            new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
            new FakeOrganizationRepository(),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        var result = await patcher.TryPatchAsync(Violation(pass: "deck-a", version: 1), job, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task ReevaluateAsync_ReturnsRealResolvedEmptyList_AfterCitationIsFixed()
    {
        var sessionId = Guid.NewGuid();
        var bundleDir = WriteSourceFile("L1-s4", "slides-source.md", "**Asset:** `img-42`");
        var job = NewJob(sessionId, "L1-s4");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { ("asset_reconciliation", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "img-42", FilePath = "assets/img-42.png" },
            }));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsARealBlockingViolation_WhenACitationIsStillDangling()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-s5", "slides-source.md", "**Asset:** `still-dangling`");
        var job = NewJob(sessionId, "L1-s5");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { ("asset_reconciliation", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("asset_reconciliation", violation.GateCode);
        Assert.True(violation.IsBlocking);
        Assert.Equal(GateVerdict.FAIL, violation.Verdict);
        Assert.True(violation.IsCascadeEligible);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenSupportedAndUnsupportedGatesAreBothEnabled()
    {
        // pedagogy_coverage (Batch 3) is a real gate code named in the ticket that this
        // reevaluator has no evidence adapter for yet — a realistic still-unsupported code,
        // distinct from all four STEP-3-ported gates which are now all supported.
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-mixed-gates");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[]
            {
                ("language_ratio", true, "blocking"),
                ("pedagogy_coverage", true, "blocking"),
            }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        var exception = await Assert.ThrowsAsync<NotSupportedException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));

        Assert.Contains("pedagogy_coverage", exception.Message);
    }

    [Fact]
    public async Task ReevaluateAsync_ReturnsRealResolvedEmptyList_ForBrandPalette_WhenAllColorsAreApproved()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-palette-pass", "deck-a");
        var job = NewJob(sessionId, "L1-palette-pass");
        var orgId = Guid.NewGuid();
        var organization = new Organization
        {
            Id = orgId,
            BrandPalette = new BrandPalette { Retired = new List<string> { "#111111" } },
        };
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(organization),
            new FakeGateDefinitionRepository(orgId, new[] { ("brand_palette", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pdfColorExtractor: new FakePdfColorExtractor(new List<string> { "#ABCDEF" }));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsARealBlockingViolation_ForBrandPalette_WhenRenderedDeckUsesARetiredColor()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-palette-fail", "deck-a");
        var job = NewJob(sessionId, "L1-palette-fail");
        var orgId = Guid.NewGuid();
        var organization = new Organization
        {
            Id = orgId,
            BrandPalette = new BrandPalette { Retired = new List<string> { "#AABBCC" } },
        };
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(organization),
            new FakeGateDefinitionRepository(orgId, new[] { ("brand_palette", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            // These are real fitz-recorded vector-drawing colors per PythonPdfColorExtractor's
            // contract, not literal text — proving the reevaluator checks rendered color
            // evidence, not a hex-in-prose scan the handoff explicitly rejected.
            pdfColorExtractor: new FakePdfColorExtractor(new List<string> { "#AABBCC", "#001122" }));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("brand_palette", violation.GateCode);
        Assert.True(violation.IsBlocking);
        Assert.Equal(GateVerdict.FAIL, violation.Verdict);
        Assert.Equal("#AABBCC", violation.EvidenceUnit);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenNoDrawingColorsAreExtractedForBrandPalette()
    {
        // A pass PDF with zero vector drawings (e.g. plain text slides) yields an empty color
        // list. BrandPaletteGate.Evaluate("", ...) returns UNVERIFIED ("no hex color codes
        // found"), which only GateVerdict.FAIL below turns into a violation — silently
        // treating "nothing to check" as "compliant" would be the same silent-pass this rule
        // forbids for language_ratio/boundary_check's UNVERIFIED cases.
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-palette-empty", "deck-a");
        var job = NewJob(sessionId, "L1-palette-empty");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("brand_palette", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pdfColorExtractor: new FakePdfColorExtractor(new List<string>()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_ExtractsColorsOnce_AndNeverExtractsTextWhenOnlyBrandPaletteIsEnabled()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-palette-only", "deck-a");
        var job = NewJob(sessionId, "L1-palette-only");
        var orgId = Guid.NewGuid();
        var colorExtractor = new FakePdfColorExtractor(new List<string> { "#ABCDEF" });
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("brand_palette", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            // No FakePdfTextExtractor override — the default throws if invoked, proving the
            // text extractor is never reached when only the color-based gate is enabled.
            pdfColorExtractor: colorExtractor);

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
        Assert.Equal(1, colorExtractor.ExtractionCount);
    }

    [Fact]
    public async Task ReevaluateAsync_ReturnsRealResolvedEmptyList_ForLanguageRatio_WhenPdfTextIsWithinPolicy()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-ratio-pass", "deck-a");
        var job = NewJob(sessionId, "L1-ratio-pass");
        var orgId = Guid.NewGuid();
        // Default LanguagePolicy: primary=arabic, target=0.70, tolerance=0.10 — 70/100 is
        // exactly on target.
        var pdfText = new string('ا', 70) + new string('a', 30);
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("language_ratio", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor(pdfText));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsARealBlockingViolation_ForLanguageRatio_WhenPdfTextFailsPolicy()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-ratio-fail", "deck-a");
        var job = NewJob(sessionId, "L1-ratio-fail");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("language_ratio", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor(new string('a', 100))); // pure latin — 0% arabic, target 70%

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("language_ratio", violation.GateCode);
        Assert.True(violation.IsBlocking);
        Assert.Equal(GateVerdict.FAIL, violation.Verdict);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsARealBlockingViolation_ForBoundaryCheck_WhenPdfTextLeaksForbiddenMarker()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-boundary-fail", "deck-a");
        var job = NewJob(sessionId, "L1-boundary-fail");
        var orgId = Guid.NewGuid();
        var organization = new Organization
        {
            Id = orgId,
            BoundaryTerms = new BoundaryTermsConfig { ForbiddenStrings = new List<string> { "LECTURER-ONLY-NOTE" } },
        };
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(organization),
            new FakeGateDefinitionRepository(orgId, new[] { ("boundary_check", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor("Student content. LECTURER-ONLY-NOTE: do not show this slide."));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("boundary_check", violation.GateCode);
        Assert.True(violation.IsBlocking);
        Assert.Equal(GateVerdict.FAIL, violation.Verdict);
        Assert.Equal("LECTURER-ONLY-NOTE", violation.EvidenceUnit);
    }

    [Fact]
    public async Task ReevaluateAsync_ExtractsPdfTextOnce_WhenBothTextGatesAreEnabled()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-both-text-gates", "deck-a");
        var job = NewJob(sessionId, "L1-both-text-gates");
        var orgId = Guid.NewGuid();
        var organization = new Organization
        {
            Id = orgId,
            BoundaryTerms = new BoundaryTermsConfig { ForbiddenStrings = new List<string> { "LECTURER-ONLY-NOTE" } },
        };
        var extractor = new FakePdfTextExtractor(new string('ا', 70) + new string('a', 30));
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(organization),
            new FakeGateDefinitionRepository(orgId, new[]
            {
                ("language_ratio", true, "blocking"),
                ("boundary_check", true, "blocking"),
            }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            extractor);

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
        Assert.Equal(1, extractor.ExtractionCount);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenPdfTextExtractionIsEmpty()
    {
        // A scanned-image-only PDF (or any extraction failure) yields empty text. Both
        // LanguageRatioGate and BoundaryCheckGate would return UNVERIFIED for that, which
        // only GateVerdict.FAIL turns into a violation — so silently treating this as "no
        // violation" would hide a deck this gate never actually checked. Must throw instead,
        // same standing rule as the asset_reconciliation branch's empty-source-file check.
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-empty-extract", "deck-a");
        var job = NewJob(sessionId, "L1-empty-extract");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("language_ratio", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor("   "));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenLanguageRatioHasNoMeasurableScriptCharacters()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-unmeasurable-ratio", "deck-a");
        var job = NewJob(sessionId, "L1-unmeasurable-ratio");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("language_ratio", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor("12345 !!!"));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_RunsTheMandatoryBaselineCheck_WhenBoundaryTermsAreNotConfigured()
    {
        // STEP 12 bug fix: an org with no BoundaryTerms.ForbiddenStrings override used to make
        // BoundaryCheckGate report UNVERIFIED (and this reevaluator throw). The mandatory
        // TRAINER_MARKERS baseline now always runs regardless, so clean text really passes.
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-unconfigured-boundary", "deck-a");
        var job = NewJob(sessionId, "L1-unconfigured-boundary");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("boundary_check", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor("student-facing text"));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsAViolation_WhenTheMandatoryBaselineDetectsLeakage_EvenWithNoOrgTermsConfigured()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-baseline-leak", "deck-a");
        var job = NewJob(sessionId, "L1-baseline-leak");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("boundary_check", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor("Trainer note: 5 minutes for this activity."));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("boundary_check", violation.GateCode);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenEnabledPdfGateIsMissingItsPassPdf()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-missing-pdf");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("boundary_check", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_StillEvaluatesAssetReconciliationForReal_WhenOnlyItIsEnabled()
    {
        // A disabled PDF-evidence gate must not trip the honest-refusal path — only an
        // *enabled* one should, since a disabled gate is never actually re-checked.
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-s7", "slides-source.md", "**Asset:** `img-9`");
        var job = NewJob(sessionId, "L1-s7");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[]
            {
                ("asset_reconciliation", true, "blocking"),
                ("language_ratio", false, "blocking"),
            }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>
            {
                new() { SessionId = sessionId, AssetId = "img-9", FilePath = "assets/img-9.png" },
            }));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenEnabledAssetGateSourceIsMissing()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-missing-source");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { ("asset_reconciliation", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenUnknownGateIsEnabled()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-unknown-gate");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { ("future_gate", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        await Assert.ThrowsAsync<NotSupportedException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_DefaultsMissingSeverityToBlocking()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-no-severity", "slides-source.md", "**Asset:** `dangling`");
        var job = NewJob(sessionId, "L1-no-severity");
        var orgId = Guid.NewGuid();
        var definition = new QualityGateDefinition
        {
            Id = Guid.NewGuid(), OrganizationId = orgId, GateCode = "asset_reconciliation",
            DisplayName = "asset_reconciliation", IsEnabled = true, GateConfig = new Dictionary<string, object>(),
        };
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { definition }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        var violation = Assert.Single(await reevaluator.ReevaluateAsync(
            job, "lineage-1", 1, "deck-a", CancellationToken.None));

        Assert.True(violation.IsBlocking);
    }

    [Fact]
    public async Task ReevaluateAsync_RejectsInvalidSeverityLikeGateRunner()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-invalid-severity", "slides-source.md", "**Asset:** `dangling`");
        var job = NewJob(sessionId, "L1-invalid-severity");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(),
            new FakeGateDefinitionRepository(orgId, new[] { ("asset_reconciliation", true, "typo") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        await Assert.ThrowsAsync<QualityGateConfigurationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_RejectsNonStringSeverityLikeGateRunner()
    {
        var sessionId = Guid.NewGuid();
        WritePdfPlaceholder("L1-non-string-severity", "deck-a");
        var job = NewJob(sessionId, "L1-non-string-severity");
        var orgId = Guid.NewGuid();
        var definition = new QualityGateDefinition
        {
            Id = Guid.NewGuid(), OrganizationId = orgId, GateCode = "language_ratio",
            DisplayName = "language_ratio", IsEnabled = true,
            GateConfig = new Dictionary<string, object> { ["severity"] = 3 },
        };
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { definition }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            new FakePdfTextExtractor(new string('ا', 70) + new string('a', 30)));

        var exception = await Assert.ThrowsAsync<QualityGateConfigurationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, "deck-a", CancellationToken.None));

        Assert.Equal("Quality gate config value 'severity' must be a string.", exception.Message);
    }

    [Fact]
    public async Task ReevaluateAsync_ReturnsRealResolvedEmptyList_ForPedagogyCoverage_WhenTheLevelPasses()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("pedagogy-coverage", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pedagogyCoverageEvaluator: new FakePedagogyCoverageEvaluator(
                new PythonGateResult("pedagogy-coverage", "PASS", "level reaches Create", new Dictionary<string, object>())));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_SessionLevelCall_SkipsEnabledPdfEvidenceGates()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[]
            {
                ("language_ratio", true, "blocking"),
                ("pedagogy-coverage", true, "blocking"),
            }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pedagogyCoverageEvaluator: new FakePedagogyCoverageEvaluator(
                new PythonGateResult("pedagogy-coverage", "PASS", "level reaches Create", new Dictionary<string, object>())));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None);

        Assert.Empty(violations);
    }

    [Fact]
    public async Task ReevaluateAsync_SessionLevelAssetCheck_CoversSlidesAndSummarySources()
    {
        var sessionId = Guid.NewGuid();
        WriteSourceFile("L1-s1", "slides-source.md", "no asset citations");
        WriteSourceFile("L1-s1", "home-summary.md", "**Asset:** `missing.png`");
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("asset_reconciliation", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("summary", violation.Pass);
        Assert.Equal("missing.png", violation.EvidenceUnit);
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsABlockingViolationWithNoPass_ForPedagogyCoverage_WhenTheLevelFails()
    {
        // Pass=null is the point: pedagogy-coverage is level-wide YAML, not attributable to a
        // single generated PDF pass — the handoff's mapping table says this must fall through
        // to reschedule/alert, never NotebookLM regeneration. The orchestrator's own "no
        // pass-scoped regeneration available" rule (ContentQualityCascadeOrchestrator) only
        // fires correctly if Pass is genuinely null here.
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("pedagogy-coverage", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pedagogyCoverageEvaluator: new FakePedagogyCoverageEvaluator(
                new PythonGateResult("pedagogy-coverage", "FAIL", "no session reaches Create",
                    new Dictionary<string, object> { ["ceiling"] = "Apply" })));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("pedagogy-coverage", violation.GateCode);
        Assert.Equal(ContentQualityOrigin.AcademyBrainRegistryGate, violation.Origin);
        Assert.Null(violation.Pass);
        Assert.True(violation.IsBlocking);
        Assert.True(violation.IsCascadeEligible);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenPedagogyCoverageIsUnverified()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("pedagogy-coverage", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pedagogyCoverageEvaluator: new FakePedagogyCoverageEvaluator(
                new PythonGateResult("pedagogy-coverage", "UNVERIFIED", "no pedagogy record yet", new Dictionary<string, object>())));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None));
    }

    [Theory]
    [InlineData("different-gate", "PASS")]
    [InlineData("pedagogy-coverage", "UNKNOWN")]
    public async Task ReevaluateAsync_RejectsMalformedPythonGateIdentityOrVerdict(string gate, string verdict)
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-s1");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("pedagogy-coverage", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            pedagogyCoverageEvaluator: new FakePedagogyCoverageEvaluator(
                new PythonGateResult(gate, verdict, "malformed subprocess result", new Dictionary<string, object>())));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None));
    }

    [Fact]
    public async Task ReevaluateAsync_ReportsABlockingViolationWithNoPass_ForNblmPromptPreflight_WhenTheGateFails()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-prompt-fail");
        var orgId = Guid.NewGuid();
        var promptDir = Path.Combine(_vaultRoot, "80-generation");
        Directory.CreateDirectory(promptDir);
        File.WriteAllText(Path.Combine(promptDir, "nblm-student-deck-prompts.md"), "## Notebook A\n\n```\nstale prose\n```\n");
        job.Payload["orgConfigSnapshot"] = OrganizationConfigSnapshotPayload.ToPayloadValue(
            new OrganizationConfigSnapshot { OrganizationId = orgId, DurationMinutes = 45, TargetAgeBand = "ages 9-12", OrganizationName = "Test Org" });
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("nblm-prompt-preflight", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()),
            nblmPromptPreflightEvaluator: new FakeNblmPromptPreflightEvaluator(
                new PythonGateResult("nblm-prompt-preflight", "FAIL", "no deck-a section found", new Dictionary<string, object>())));

        var violations = await reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None);

        var violation = Assert.Single(violations);
        Assert.Equal("nblm-prompt-preflight", violation.GateCode);
        Assert.Equal(ContentQualityOrigin.AcademyBrainRegistryGate, violation.Origin);
        Assert.Null(violation.Pass);
        Assert.True(violation.IsCascadeEligible);
    }

    [Fact]
    public async Task ReevaluateAsync_ThrowsHonestly_WhenNblmPromptPreflightFileIsMissing()
    {
        var sessionId = Guid.NewGuid();
        var job = NewJob(sessionId, "L1-prompt-missing");
        var orgId = Guid.NewGuid();
        var reevaluator = NewReevaluator(
            new FakeProjectRepository(job.ProjectId, orgId),
            new FakeOrganizationRepository(new Organization { Id = orgId }),
            new FakeGateDefinitionRepository(orgId, new[] { ("nblm-prompt-preflight", true, "blocking") }),
            new FakeSessionAssetRepository(sessionId, new List<SessionAsset>()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reevaluator.ReevaluateAsync(job, "lineage-1", 1, null, CancellationToken.None));
    }

    private string WriteSourceFile(string sessionCode, string fileName, string content)
    {
        var bundleDir = Path.Combine(_vaultRoot, "75-bundle", sessionCode);
        Directory.CreateDirectory(bundleDir);
        File.WriteAllText(Path.Combine(bundleDir, fileName), content);
        return bundleDir;
    }

    // Content is irrelevant — these tests substitute a FakePdfTextExtractor for the real
    // fitz-backed extraction, so only the file's existence at the real resolved path matters.
    private void WritePdfPlaceholder(string sessionCode, string pass)
    {
        var dir = Path.Combine(_vaultRoot, "80-generation", sessionCode);
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, $"{pass}.pdf"), "not a real pdf — extraction is faked in these tests");
    }

    private static Batch2ContentQualityGateReevaluator NewReevaluator(
        IProjectRepository projectRepository,
        IOrganizationRepository organizationRepository,
        IGateDefinitionRepository gateDefinitionRepository,
        ISessionAssetRepository sessionAssetRepository,
        IPdfTextExtractor? pdfTextExtractor = null,
        IPdfColorExtractor? pdfColorExtractor = null,
        IPedagogyCoverageEvaluator? pedagogyCoverageEvaluator = null,
        INblmPromptPreflightEvaluator? nblmPromptPreflightEvaluator = null) =>
        new(projectRepository, organizationRepository, gateDefinitionRepository, sessionAssetRepository,
            // All default to fakes that throw if actually invoked — tests that don't enable the
            // corresponding gate must never reach that evidence source at all.
            pdfTextExtractor ?? new FakePdfTextExtractor(),
            pdfColorExtractor ?? new FakePdfColorExtractor(),
            pedagogyCoverageEvaluator ?? new FakePedagogyCoverageEvaluator(),
            nblmPromptPreflightEvaluator ?? new FakeNblmPromptPreflightEvaluator());

    private GenerationJob NewJob(Guid sessionId, string sessionCode) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = Guid.NewGuid(),
        SessionId = sessionId,
        ClaimedBy = "test-worker",
        Payload = new Dictionary<string, object>
        {
            ["courseVaultRoot"] = _vaultRoot,
            ["sessionId"] = sessionCode,
        },
    };

    private static ContentQualityViolation Violation(string? pass, int version) => new()
    {
        Origin = ContentQualityOrigin.StudioQualityReceipt,
        GateCode = "asset_reconciliation",
        ArtifactLineageId = "lineage-1",
        ArtifactVersion = version,
        Pass = pass,
        Verdict = GateVerdict.FAIL,
        IsBlocking = true,
        Detail = "test violation",
    };

    private sealed class FakeProjectRepository : IProjectRepository
    {
        private readonly Guid _projectId;
        private readonly Guid _organizationId;

        public FakeProjectRepository(Guid projectId, Guid organizationId)
        {
            _projectId = projectId;
            _organizationId = organizationId;
        }

        public Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null) => throw new NotSupportedException();
        public Task<CourseProject> CreateAsync(CourseProject project) => throw new NotSupportedException();
        public Task<CourseProject> UpdateAsync(CourseProject project) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();

        public Task<CourseProject?> GetByIdAsync(Guid id) => Task.FromResult<CourseProject?>(
            id == _projectId ? new CourseProject { Id = id, OrganizationId = _organizationId } : null);
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        private readonly Organization? _organization;

        public FakeOrganizationRepository() { }
        public FakeOrganizationRepository(Organization organization) { _organization = organization; }

        public Task<List<Organization>> GetAllAsync() => throw new NotSupportedException();
        public Task<Organization?> GetBySlugAsync(string slug) => throw new NotSupportedException();
        public Task<Organization> CreateAsync(Organization organization) => throw new NotSupportedException();
        public Task<Organization> UpdateAsync(Organization organization) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();

        public Task<Organization?> GetByIdAsync(Guid id) =>
            Task.FromResult<Organization?>(_organization ?? new Organization { Id = id });
    }

    private sealed class FakePdfTextExtractor : IPdfTextExtractor
    {
        private readonly string? _text;

        public int ExtractionCount { get; private set; }

        public FakePdfTextExtractor() { }
        public FakePdfTextExtractor(string text) { _text = text; }

        public Task<string> ExtractTextAsync(string pdfPath, CancellationToken ct)
        {
            ExtractionCount++;
            return _text is null
                ? throw new NotSupportedException("This test must never reach real PDF text extraction.")
                : Task.FromResult(_text);
        }
    }

    private sealed class FakePdfColorExtractor : IPdfColorExtractor
    {
        private readonly List<string>? _colors;

        public int ExtractionCount { get; private set; }

        public FakePdfColorExtractor() { }
        public FakePdfColorExtractor(List<string> colors) { _colors = colors; }

        public Task<List<string>> ExtractColorsAsync(string pdfPath, CancellationToken ct)
        {
            ExtractionCount++;
            return _colors is null
                ? throw new NotSupportedException("This test must never reach real PDF color extraction.")
                : Task.FromResult(_colors);
        }
    }

    private sealed class FakePedagogyCoverageEvaluator : IPedagogyCoverageEvaluator
    {
        private readonly PythonGateResult? _result;

        public FakePedagogyCoverageEvaluator() { }
        public FakePedagogyCoverageEvaluator(PythonGateResult result) { _result = result; }

        public Task<PythonGateResult> EvaluateAsync(string sessionCode, string courseVaultRoot, CancellationToken ct) =>
            _result is null
                ? throw new NotSupportedException("This test must never reach real pedagogy-coverage evaluation.")
                : Task.FromResult(_result);
    }

    private sealed class FakeNblmPromptPreflightEvaluator : INblmPromptPreflightEvaluator
    {
        private readonly PythonGateResult? _result;

        public FakeNblmPromptPreflightEvaluator() { }
        public FakeNblmPromptPreflightEvaluator(PythonGateResult result) { _result = result; }

        public Task<PythonGateResult> EvaluateAsync(
            string promptPath, string? expectedDurationText, string? expectedAudienceText,
            string? expectedBrandingText, IReadOnlyList<string> forbiddenStrings, CancellationToken ct) =>
            _result is null
                ? throw new NotSupportedException("This test must never reach real nblm-prompt-preflight evaluation.")
                : Task.FromResult(_result);
    }

    private sealed class FakeSessionAssetRepository : ISessionAssetRepository
    {
        private readonly Guid _sessionId;
        private readonly List<SessionAsset> _assets;

        public FakeSessionAssetRepository(Guid sessionId, List<SessionAsset> assets)
        {
            _sessionId = sessionId;
            _assets = assets;
        }

        public Task<List<SessionAsset>> GetBySessionAsync(Guid sessionId) =>
            Task.FromResult(sessionId == _sessionId ? _assets : new List<SessionAsset>());
    }

    private sealed class FakeGateDefinitionRepository : IGateDefinitionRepository
    {
        private readonly Guid _organizationId;
        private readonly List<QualityGateDefinition> _definitions;

        public FakeGateDefinitionRepository(Guid organizationId, IEnumerable<(string GateCode, bool Enabled, string Severity)> definitions)
        {
            _organizationId = organizationId;
            _definitions = definitions.Select(d => new QualityGateDefinition
            {
                Id = Guid.NewGuid(),
                OrganizationId = organizationId,
                GateCode = d.GateCode,
                DisplayName = d.GateCode,
                IsEnabled = d.Enabled,
                GateConfig = new Dictionary<string, object> { ["severity"] = d.Severity },
            }).ToList();
        }

        public FakeGateDefinitionRepository(Guid organizationId, IEnumerable<QualityGateDefinition> definitions)
        {
            _organizationId = organizationId;
            _definitions = definitions.ToList();
        }

        public Task<QualityGateDefinition> UpsertAsync(QualityGateDefinition definition) => throw new NotSupportedException();
        public Task ToggleAsync(Guid definitionId, bool isEnabled) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();

        public Task<List<QualityGateDefinition>> GetByOrganizationAsync(Guid organizationId) =>
            Task.FromResult(organizationId == _organizationId ? _definitions : new List<QualityGateDefinition>());
    }
}
