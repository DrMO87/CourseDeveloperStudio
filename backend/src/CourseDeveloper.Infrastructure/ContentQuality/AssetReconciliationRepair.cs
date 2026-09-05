namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.QualityGates;

// STEP 11 Phase B, Batch 2: asset reconciliation is the one STEP-3-ported gate the handoff
// says already has a genuine, safe targeted-patch lever today (Part 2's per-gate-kind
// mapping table) — it evaluates structured source markdown that academy-brain's
// generate_session.py itself uploads (VAULT/75-bundle/<sessionId>/{slides-source.md,
// home-summary.md}), not opaque generated PDF prose, so there is a real addressable unit to
// relink. This class is intentionally the ONLY real repair lever this batch ships: the other
// three STEP-3-ported gates (language_ratio, boundary_check, brand_palette) evaluate
// generated PDF content and have no safe targeted-patch lever per the handoff's mapping
// table — they still fall through to Tier 3 regeneration/backoff. Real re-evaluation
// evidence for all three now exists (see Batch2ContentQualityGateReevaluator below):
// per-pass PDF text for the first two, real rendered vector-drawing colors (not text hex
// mentions — the handoff explicitly rejects that as insufficient) for brand_palette.
internal static class AssetReconciliationSource
{
    // Mirrors generate_session.py's build_plan: `bundle = VAULT / "75-bundle" / sid`, and its
    // Upload list uploads exactly slides-source.md (feeds deck-a/deck-b) and home-summary.md
    // (feeds summary). There is no per-deck-a-vs-deck-b split file — both decks share
    // slides-source.md — so "summary" is the only pass with a distinct source file.
    public static string ResolveFilePath(string courseVaultRoot, string sessionCode, string? pass)
    {
        var bundleDir = Path.Combine(courseVaultRoot, "75-bundle", sessionCode);
        var fileName = string.Equals(pass, "summary", StringComparison.OrdinalIgnoreCase) ? "home-summary.md" : "slides-source.md";
        return Path.Combine(bundleDir, fileName);
    }

    public static (string CourseVaultRoot, string SessionCode) ReadJobLocation(GenerationJob job)
    {
        var courseVaultRoot = ReadString(job.Payload, "courseVaultRoot")
            ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'courseVaultRoot'.");
        var sessionCode = ReadString(job.Payload, "sessionId")
            ?? throw new InvalidOperationException($"Job {job.Id} payload is missing 'sessionId'.");
        return (courseVaultRoot, sessionCode);
    }

    private static string? ReadString(Dictionary<string, object> payload, string key)
    {
        if (!payload.TryGetValue(key, out var value))
        {
            return null;
        }

        return value switch
        {
            JsonElement el when el.ValueKind == JsonValueKind.String => el.GetString(),
            string s => s,
            _ => null,
        };
    }
}

// Tier 2 (Standing Rule 10a-2): "relinking one exact asset citation to the unique registered
// asset it already denotes" is the handoff's own named example of a genuine targeted patch
// (Part 2, cascade order). This adapter does exactly that and nothing more: it never invents
// an asset, never picks among multiple equally-plausible candidates, and never touches
// generated PDF content. No fact-corrector is registered for this gate code — the handoff's
// own tier-3 mapping-table row names this same relink operation as the canonical patch, and
// inventing a separate tier-1 rule on top of it would be exactly the "invented gate logic
// nobody asked for" this ticket forbids.
public sealed class AssetReconciliationTargetedPatcher : IContentQualityTargetedPatcher
{
    private static readonly string DefaultCitationPattern = @"\*\*Asset:\*\*\s*`([^`]+)`";

    private readonly IProjectRepository _projectRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ISessionAssetRepository _sessionAssetRepository;

    public AssetReconciliationTargetedPatcher(
        IProjectRepository projectRepository,
        IOrganizationRepository organizationRepository,
        ISessionAssetRepository sessionAssetRepository)
    {
        _projectRepository = projectRepository;
        _organizationRepository = organizationRepository;
        _sessionAssetRepository = sessionAssetRepository;
    }

    public string GateCode => "asset_reconciliation";

    public async Task<ContentQualityCorrectionResult?> TryPatchAsync(ContentQualityViolation violation, GenerationJob job, CancellationToken ct)
    {
        var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
        var filePath = AssetReconciliationSource.ResolveFilePath(courseVaultRoot, sessionCode, violation.Pass);
        if (!File.Exists(filePath))
        {
            // No addressable source file at all — honest "no lever," not a fabricated patch.
            return null;
        }

        var project = await _projectRepository.GetByIdAsync(job.ProjectId)
            ?? throw new InvalidOperationException($"Job {job.Id}: course project {job.ProjectId} not found.");
        var organizationId = project.OrganizationId
            ?? throw new InvalidOperationException($"Job {job.Id}: project {job.ProjectId} has no organization.");
        var organization = await _organizationRepository.GetByIdAsync(organizationId)
            ?? throw new InvalidOperationException($"Job {job.Id}: organization {organizationId} not found.");
        var mappedAssets = await _sessionAssetRepository.GetBySessionAsync(job.SessionId);

        var pattern = string.IsNullOrWhiteSpace(organization.AssetCitationPattern) ? DefaultCitationPattern : organization.AssetCitationPattern;
        var regex = new Regex(pattern, RegexOptions.Compiled);
        var text = await File.ReadAllTextAsync(filePath, ct);

        var updated = text;
        string? fixedReference = null;
        string? resolvedAssetId = null;

        foreach (Match match in regex.Matches(text))
        {
            var referencedId = match.Groups[1].Value.Trim();
            if (IsResolved(referencedId, mappedAssets))
            {
                continue; // already fine — not the dangling reference this violation is about
            }

            var unique = FindUniqueMatch(referencedId, mappedAssets);
            if (unique is null)
            {
                continue; // dangling, but no authoritative unique target — never guess
            }

            // Replace only this exact matched citation text, preserving the surrounding
            // template, so the change is a mechanical relink and not a rewrite of prose.
            var correctedCitation = match.Value.Replace(match.Groups[1].Value, unique.CitationId);
            updated = updated.Remove(match.Index, match.Length).Insert(match.Index, correctedCitation);
            fixedReference = referencedId;
            resolvedAssetId = unique.Asset.AssetId;
            break; // one mechanical relink per patch attempt — re-evaluation drives the next one
        }

        if (fixedReference is null)
        {
            return null;
        }

        await File.WriteAllTextAsync(filePath, updated, ct);
        var newVersion = violation.ArtifactVersion + 1;
        return new ContentQualityCorrectionResult(
            newVersion,
            $"Relinked dangling asset citation '{fixedReference}' to registered asset '{resolvedAssetId}' in {Path.GetFileName(filePath)}.");
    }

    private static bool IsResolved(string referencedId, List<SessionAsset> mappedAssets)
    {
        if (mappedAssets.Any(a => string.Equals(a.AssetId, referencedId, StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        return mappedAssets.Any(a => a.FilePath.Contains(referencedId));
    }

    // A case-insensitive equality with the authoritative stored file basename is the only
    // useful normalization available here. The real gate's FilePath.Contains check is
    // case-sensitive, so a case-only basename mismatch can be dangling; rewriting it to the
    // exact stored basename makes that same gate resolve it. AssetId whitespace normalization
    // is deliberately excluded: the gate trims citations but not mapped AssetIds, so such a
    // rewrite cannot pass re-evaluation. No fuzzy, substring, or closest-match scoring occurs.
    private static ReconciliationMatch? FindUniqueMatch(string referencedId, List<SessionAsset> mappedAssets)
    {
        var candidates = mappedAssets
            .Select(a => new ReconciliationMatch(a, Path.GetFileName(a.FilePath)))
            .Where(candidate => !string.IsNullOrEmpty(candidate.CitationId)
                && string.Equals(candidate.CitationId, referencedId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return candidates.Count == 1 ? candidates[0] : null;
    }

    private sealed record ReconciliationMatch(SessionAsset Asset, string CitationId);
}

// Resolves a NotebookLM pass's generated PDF on disk. Mirrors AssetReconciliationSource's
// role for the markdown source, but for the actual generated artifact: generate_session.py's
// run_live/_run_pass write exactly VAULT/80-generation/<sid>/{deck-a,deck-b,summary}.pdf
// (see that file's Pass.key comment) — the same three pass keys ContentQualityViolation.Pass
// carries.
// Public (not internal): CourseDeveloper.Worker's job-execution boundary needs the same
// three pass names to know which generated PDFs to check post-generation — see
// AcademyBrainSubprocessExecutor.
public static class PdfPassSource
{
    public static readonly IReadOnlyCollection<string> SupportedPasses = new HashSet<string>(StringComparer.Ordinal)
    {
        "deck-a", "deck-b", "summary",
    };

    public static string ResolvePdfPath(string courseVaultRoot, string sessionCode, string pass)
    {
        if (!SupportedPasses.Contains(pass))
        {
            throw new InvalidOperationException(
                $"Unsupported PDF pass '{pass}'; expected deck-a, deck-b, or summary.");
        }

        return Path.Combine(courseVaultRoot, "80-generation", sessionCode, $"{pass}.pdf");
    }
}

// STEP 11 Phase B, Batch 2's real IContentQualityGateReevaluator. It replaces Batch 1's
// NotYetImplementedContentQualityGateReevaluator for every organization whose enabled gate
// set this evidence pipeline can actually re-derive honestly: asset_reconciliation
// (structured source markdown — see AssetReconciliationTargetedPatcher above), language_ratio
// and boundary_check (real per-pass PDF text via IPdfTextExtractor — see
// PythonPdfTextExtractor.cs), and brand_palette (real per-pass rendered vector-drawing colors
// via IPdfColorExtractor — see PythonPdfColorExtractor.cs). The handoff's brand_palette row
// explicitly rejects scanning generated-PDF text for literal hex-code mentions as
// insufficient evidence ("existing gates scan hex strings in supplied text and do not
// inspect rendered PDF color objects") — extract_pdf_colors.py reads fitz's actual recorded
// fill/stroke colors from the PDF's vector drawings instead, so BrandPaletteGate.Evaluate
// (a plain hex-regex scan) runs against a synthesized string of REAL rendered colors, not
// prose. Rather than silently skip an unsupported gate (which would let a resolved-looking
// cascade promote content nobody actually re-checked), this reevaluator throws the same
// honest NotSupportedException Batch 1 used for any OTHER enabled gate code — an explicit
// allowlist, not a denylist, so a future gate code defaults to fail-closed instead of
// silently "passing" through this reevaluator.
//
// STEP 11 Phase B, Batch 3 extends this same class (rather than adding a second
// IContentQualityGateReevaluator — the orchestrator takes exactly one) with the two
// academy-brain-registry (Python-only, never ported to a Studio IQualityGate) gate codes:
// pedagogy-coverage (re-runs generate_session.py's own `pedagogy_summary` via
// evaluate_pedagogy_coverage.py — see IPedagogyCoverageEvaluator) and nblm-prompt-preflight
// (re-runs the new registry gate against the resolved prompt file — see
// INblmPromptPreflightEvaluator). Both violations carry Pass=null: neither check is
// attributable to a single generated PDF pass, so the orchestrator's own "no pass-scoped
// regeneration available" rule correctly routes a persistent failure straight to
// reschedule/alert rather than ever spending NotebookLM quota on either.
public sealed class Batch2ContentQualityGateReevaluator : IContentQualityGateReevaluator
{
    private static readonly HashSet<string> SupportedGateCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "asset_reconciliation", "language_ratio", "boundary_check", "brand_palette",
        // STEP 11 Phase B, Batch 3: both academy-brain-registry (Python-only) gate codes —
        // see the class-level doc comment update below.
        "pedagogy-coverage", "nblm-prompt-preflight",
    };

    private readonly IProjectRepository _projectRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IGateDefinitionRepository _gateDefinitionRepository;
    private readonly ISessionAssetRepository _sessionAssetRepository;
    private readonly IPdfTextExtractor _pdfTextExtractor;
    private readonly IPdfColorExtractor _pdfColorExtractor;
    private readonly IPedagogyCoverageEvaluator _pedagogyCoverageEvaluator;
    private readonly INblmPromptPreflightEvaluator _nblmPromptPreflightEvaluator;
    private readonly AssetReconciliationGate _assetReconciliationGate = new();
    private readonly LanguageRatioGate _languageRatioGate = new();
    private readonly BoundaryCheckGate _boundaryCheckGate = new();
    private readonly BrandPaletteGate _brandPaletteGate = new();

    public Batch2ContentQualityGateReevaluator(
        IProjectRepository projectRepository,
        IOrganizationRepository organizationRepository,
        IGateDefinitionRepository gateDefinitionRepository,
        ISessionAssetRepository sessionAssetRepository,
        IPdfTextExtractor pdfTextExtractor,
        IPdfColorExtractor pdfColorExtractor,
        IPedagogyCoverageEvaluator pedagogyCoverageEvaluator,
        INblmPromptPreflightEvaluator nblmPromptPreflightEvaluator)
    {
        _projectRepository = projectRepository;
        _organizationRepository = organizationRepository;
        _gateDefinitionRepository = gateDefinitionRepository;
        _sessionAssetRepository = sessionAssetRepository;
        _pdfTextExtractor = pdfTextExtractor;
        _pdfColorExtractor = pdfColorExtractor;
        _pedagogyCoverageEvaluator = pedagogyCoverageEvaluator;
        _nblmPromptPreflightEvaluator = nblmPromptPreflightEvaluator;
    }

    public async Task<List<ContentQualityViolation>> ReevaluateAsync(
        GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
    {
        var project = await _projectRepository.GetByIdAsync(job.ProjectId)
            ?? throw new InvalidOperationException($"Job {job.Id}: course project {job.ProjectId} not found.");
        var organizationId = project.OrganizationId
            ?? throw new InvalidOperationException($"Job {job.Id}: project {job.ProjectId} has no organization.");
        var organization = await _organizationRepository.GetByIdAsync(organizationId)
            ?? throw new InvalidOperationException($"Job {job.Id}: organization {organizationId} not found.");
        var definitions = await _gateDefinitionRepository.GetByOrganizationAsync(organizationId);
        var enabled = definitions.Where(d => d.IsEnabled).ToDictionary(d => d.GateCode, StringComparer.OrdinalIgnoreCase);

        var unsupportedEnabled = enabled.Keys.Where(code => !SupportedGateCodes.Contains(code)).ToList();
        if (unsupportedEnabled.Count > 0)
        {
            throw new NotSupportedException(
                $"Job {job.Id}: organization {organizationId} has {string.Join(", ", unsupportedEnabled)} enabled, " +
                "but this Batch 2 reevaluator has no real evidence adapter for those gate codes. " +
                "Refusing to reevaluate rather than silently skip a gate the cascade cannot honestly re-check.");
        }

        var violations = new List<ContentQualityViolation>();
        if (enabled.TryGetValue("asset_reconciliation", out var assetGateDef))
        {
            var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
            var sourcePasses = pass is null ? new[] { "deck-a", "summary" } : new[] { pass };
            foreach (var sourcePass in sourcePasses)
            {
                var filePath = AssetReconciliationSource.ResolveFilePath(courseVaultRoot, sessionCode, sourcePass);
                if (!File.Exists(filePath))
                {
                    throw new InvalidOperationException(
                        $"Job {job.Id}: enabled asset_reconciliation gate cannot read missing source file '{filePath}'.");
                }

                var sourceText = await File.ReadAllTextAsync(filePath, ct);
                if (string.IsNullOrWhiteSpace(sourceText))
                {
                    throw new InvalidOperationException(
                        $"Job {job.Id}: enabled asset_reconciliation gate cannot verify empty source file '{filePath}'.");
                }

                var mappedAssets = await _sessionAssetRepository.GetBySessionAsync(job.SessionId);
                var result = _assetReconciliationGate.Evaluate(sourceText, mappedAssets, organization.AssetCitationPattern);
                var severity = ResolveSeverity(assetGateDef, result.GateName);

                if (result.Verdict == GateVerdict.FAIL)
                {
                    var danglingRefs = result.Evidence.TryGetValue("dangling_references", out var refsObj)
                        ? CoerceStringList(refsObj)
                        : new List<string>();

                    violations.Add(BuildViolation(
                        "asset_reconciliation", result, severity == "blocking", artifactLineageId, artifactVersion,
                        pass is null ? sourcePass : pass, danglingRefs.FirstOrDefault()));
                }
            }
        }

        var needsPdfText = enabled.ContainsKey("language_ratio") || enabled.ContainsKey("boundary_check");
        var needsPdfEvidence = needsPdfText || enabled.ContainsKey("brand_palette");
        if (needsPdfEvidence && pass is not null)
        {
            var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
            var pdfPath = PdfPassSource.ResolvePdfPath(courseVaultRoot, sessionCode, pass);
            if (!File.Exists(pdfPath))
            {
                throw new InvalidOperationException(
                    $"Job {job.Id}: enabled PDF-evidence gate cannot read missing pass PDF '{pdfPath}'.");
            }

            if (needsPdfText)
            {
                var pdfText = await _pdfTextExtractor.ExtractTextAsync(pdfPath, ct);
                if (string.IsNullOrWhiteSpace(pdfText))
                {
                    // Same standing rule as the asset_reconciliation branch's empty-source check
                    // above: an enabled gate with no real content to evaluate is missing evidence,
                    // not a pass. Both gates would otherwise return UNVERIFIED here, which only
                    // GateVerdict.FAIL below turns into a violation — silently treating an
                    // unreadable/blank deck (e.g. a scanned-image-only PDF fitz can't extract text
                    // from) as "no violation" would be exactly the silent-pass this rule forbids.
                    throw new InvalidOperationException(
                        $"Job {job.Id}: enabled PDF-evidence gate extracted no text from pass PDF '{pdfPath}'.");
                }

                if (enabled.TryGetValue("language_ratio", out var ratioDef))
                {
                    var result = _languageRatioGate.Evaluate(pdfText, organization.LanguagePolicy);
                    var severity = ResolveSeverity(ratioDef, result.GateName);
                    EnsureVerified(result, pdfPath);
                    if (result.Verdict == GateVerdict.FAIL)
                    {
                        violations.Add(BuildViolation(
                            "language_ratio", result, severity == "blocking", artifactLineageId, artifactVersion, pass,
                            evidenceUnit: null));
                    }
                }

                if (enabled.TryGetValue("boundary_check", out var boundaryDef))
                {
                    var result = _boundaryCheckGate.Evaluate(pdfText, organization.BoundaryTerms);
                    var severity = ResolveSeverity(boundaryDef, result.GateName);
                    EnsureVerified(result, pdfPath);
                    if (result.Verdict == GateVerdict.FAIL)
                    {
                        var leaked = result.Evidence.TryGetValue("leaked_markers", out var markersObj)
                            ? CoerceStringList(markersObj)
                            : new List<string>();

                        violations.Add(BuildViolation(
                            "boundary_check", result, severity == "blocking", artifactLineageId, artifactVersion, pass,
                            leaked.FirstOrDefault()));
                    }
                }
            }

            if (enabled.TryGetValue("brand_palette", out var paletteDef))
            {
                var colors = await _pdfColorExtractor.ExtractColorsAsync(pdfPath, ct);
                // BrandPaletteGate.Evaluate takes a text blob and regex-scans it for hex codes.
                // Feeding it a space-joined string of REAL rendered vector-drawing colors (not
                // literal PDF prose) is what makes this reevaluation honest per the handoff's
                // brand_palette row — the gate's own regex logic is unmodified, only the source
                // of the "text" it scans changed from prose to real color evidence.
                var result = _brandPaletteGate.Evaluate(string.Join(' ', colors), organization.BrandPalette);
                var severity = ResolveSeverity(paletteDef, result.GateName);
                EnsureVerified(result, pdfPath);
                if (result.Verdict == GateVerdict.FAIL)
                {
                    var retired = result.Evidence.TryGetValue("retired_colors", out var retiredObj)
                        ? CoerceStringList(retiredObj)
                        : new List<string>();

                    violations.Add(BuildViolation(
                        "brand_palette", result, severity == "blocking", artifactLineageId, artifactVersion, pass,
                        retired.FirstOrDefault()));
                }
            }
        }

        // pedagogy-coverage and nblm-prompt-preflight are session-level, not pass-level (one
        // vault YAML / one prompt file covers every pass) — only evaluate them on the
        // session-level (pass is null) call. Without this gate, calling ReevaluateAsync once
        // per generated pass (deck-a/deck-b/summary) for the PDF-evidence gates below would
        // also re-run these two 2-3x per session, each as its own cascade cycle keyed by a
        // different `pass`, multiplying any real, persistent failure into 2-3 separate
        // reschedule/alert events for the same underlying defect.
        if (pass is null && enabled.TryGetValue("pedagogy-coverage", out var pedagogyDef))
        {
            var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
            var result = await _pedagogyCoverageEvaluator.EvaluateAsync(sessionCode, courseVaultRoot, ct);
            EnsurePythonResultVerified(result, "pedagogy-coverage");
            if (result.Verdict == "FAIL")
            {
                var severity = ResolveSeverity(pedagogyDef, result.Gate);
                violations.Add(BuildPythonViolation(
                    "pedagogy-coverage", result, severity == "blocking", artifactLineageId, artifactVersion));
            }
        }

        if (pass is null && enabled.TryGetValue("nblm-prompt-preflight", out var preflightDef))
        {
            var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
            // The per-session rendered file may not exist yet (no correction has run for this
            // session before) — fall back to the immutable template so the very first
            // evaluation has something to read rather than throwing "missing file" before the
            // cascade ever gets a chance to render it. An unrendered template still contains
            // literal `$FIELD` markers, so it fails the verbatim-text checks below honestly and
            // routes straight into tier-1 correction, exactly like any other real defect would.
            var renderedPath = NblmPromptFields.RenderedPath(courseVaultRoot, sessionCode);
            var promptPath = File.Exists(renderedPath) ? renderedPath : NblmPromptFields.TemplatePath(courseVaultRoot);
            if (!File.Exists(promptPath))
            {
                throw new InvalidOperationException(
                    $"Job {job.Id}: enabled nblm-prompt-preflight gate cannot read missing prompt file '{promptPath}'.");
            }

            // STEP 12: duration/audience/branding come from the job's immutable enqueue-time
            // snapshot, not a live CourseSession read — see NblmPromptFields' doc comment.
            var snapshot = OrganizationConfigSnapshotPayload.FromJobPayload(job);
            var forbidden = organization.BoundaryTerms.ForbiddenStrings;
            var result = await _nblmPromptPreflightEvaluator.EvaluateAsync(
                promptPath,
                NblmPromptFields.DurationText(snapshot),
                NblmPromptFields.AudienceText(snapshot),
                NblmPromptFields.BrandingText(snapshot),
                forbidden,
                ct);
            EnsurePythonResultVerified(result, "nblm-prompt-preflight");
            if (result.Verdict == "FAIL")
            {
                var severity = ResolveSeverity(preflightDef, result.Gate);
                violations.Add(BuildPythonViolation(
                    "nblm-prompt-preflight", result, severity == "blocking", artifactLineageId, artifactVersion));
            }
        }

        return violations;
    }

    private static ContentQualityViolation BuildPythonViolation(
        string gateCode, PythonGateResult result, bool isBlocking, string artifactLineageId, int artifactVersion) => new()
    {
        Origin = ContentQualityOrigin.AcademyBrainRegistryGate,
        GateCode = gateCode,
        ArtifactLineageId = artifactLineageId,
        ArtifactVersion = artifactVersion,
        Pass = null,
        EvidenceUnit = null,
        Verdict = GateVerdict.FAIL,
        IsBlocking = isBlocking,
        Detail = result.Detail,
        Evidence = result.Evidence,
    };

    private static void EnsurePythonResultVerified(PythonGateResult result, string gateCode)
    {
        if (!string.Equals(result.Gate, gateCode, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Enabled {gateCode} gate returned result for unexpected gate '{result.Gate}'.");
        }

        if (result.Verdict is not ("PASS" or "FAIL" or "UNVERIFIED"))
        {
            throw new InvalidOperationException(
                $"Enabled {gateCode} gate returned unsupported verdict '{result.Verdict}'.");
        }

        if (result.Verdict == "UNVERIFIED")
        {
            throw new InvalidOperationException(
                $"Enabled {gateCode} gate could not verify: {result.Detail}");
        }
    }

    private static ContentQualityViolation BuildViolation(
        string gateCode, GateResult result, bool isBlocking, string artifactLineageId, int artifactVersion,
        string? pass, string? evidenceUnit) => new()
    {
        Origin = ContentQualityOrigin.StudioQualityReceipt,
        GateCode = gateCode,
        ArtifactLineageId = artifactLineageId,
        ArtifactVersion = artifactVersion,
        Pass = pass,
        EvidenceUnit = evidenceUnit,
        Verdict = result.Verdict,
        IsBlocking = isBlocking,
        Detail = result.Detail,
        Evidence = result.Evidence,
    };

    // Matches GateRunnerService's own severity validation exactly: missing defaults to
    // blocking, anything else must be one of the three recognized values.
    private static string ResolveSeverity(QualityGateDefinition definition, string gateName)
    {
        var severity = ReadConfigString(definition.GateConfig, "severity") ?? "blocking";
        if (severity is not ("advisory" or "approvalRequired" or "blocking"))
        {
            throw new QualityGateConfigurationException(
                $"Quality gate '{gateName}' has unsupported severity '{severity}'.");
        }
        return severity;
    }

    private static void EnsureVerified(GateResult result, string pdfPath)
    {
        if (result.Verdict == GateVerdict.UNVERIFIED)
        {
            throw new InvalidOperationException(
                $"Enabled {result.GateName} gate could not verify pass PDF '{pdfPath}': {result.Detail}");
        }
    }

    private static string? ReadConfigString(Dictionary<string, object> config, string key)
    {
        if (!config.TryGetValue(key, out var value))
        {
            return null;
        }

        return value switch
        {
            string s => s,
            JsonElement { ValueKind: JsonValueKind.String } el => el.GetString(),
            _ => throw new QualityGateConfigurationException(
                $"Quality gate config value '{key}' must be a string."),
        };
    }

    private static List<string> CoerceStringList(object value) => value switch
    {
        List<string> list => list,
        JsonElement el when el.ValueKind == JsonValueKind.Array =>
            el.EnumerateArray().Select(e => e.GetString() ?? string.Empty).ToList(),
        _ => new List<string>(),
    };
}
