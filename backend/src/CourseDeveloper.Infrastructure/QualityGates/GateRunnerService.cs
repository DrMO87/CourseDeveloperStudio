namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class GateRunnerService : IQualityGateRunner
{
    private readonly IGateDefinitionRepository _gateRepo;
    private readonly IOrganizationRepository _orgRepo;
    
    private readonly LanguageRatioGate _languageGate = new();
    private readonly BoundaryCheckGate _boundaryGate = new();
    private readonly BrandPaletteGate _brandGate = new();
    private readonly AssetReconciliationGate _assetGate = new();

    public GateRunnerService(IGateDefinitionRepository gateRepo, IOrganizationRepository orgRepo)
    {
        _gateRepo = gateRepo;
        _orgRepo = orgRepo;
    }

    public async Task<QualityReceipt> EvaluateAsync(Guid organizationId, Guid projectId, Guid sessionId, PipelineStage stage, string learnerText, List<SessionAsset> mappedAssets)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        if (org == null) throw new InvalidOperationException("Organization not found.");

        var gateDefs = await _gateRepo.GetByOrganizationAsync(organizationId);
        var enabledGates = gateDefs.Where(g => g.IsEnabled).ToList();

        var results = new List<GateResult>();
        var detailed = new Dictionary<string, object>();

        foreach (var gateDef in enabledGates)
        {
            GateResult result = null;
            switch (gateDef.GateCode)
            {
                case "language_ratio":
                    result = _languageGate.Evaluate(learnerText, org.LanguagePolicy);
                    break;
                case "brand_palette":
                    result = _brandGate.Evaluate(learnerText, org.BrandPalette);
                    break;
                case "boundary_check":
                    result = _boundaryGate.Evaluate(learnerText, org.BoundaryTerms);
                    break;
                case "asset_reconciliation":
                    result = _assetGate.Evaluate(learnerText, mappedAssets, org.AssetCitationPattern);
                    break;
            }

            if (result != null)
            {
                results.Add(result);
                detailed[gateDef.GateCode] = result;
            }
        }

        GateVerdict overall = GateVerdict.PASS;
        if (results.Any(r => r.Verdict == GateVerdict.FAIL)) overall = GateVerdict.FAIL;
        else if (results.Any(r => r.Verdict == GateVerdict.UNVERIFIED) && !results.Any(r => r.Verdict == GateVerdict.FAIL)) overall = GateVerdict.UNVERIFIED;

        var receipt = new QualityReceipt
        {
            ProjectId = projectId,
            SessionId = sessionId,
            StageName = stage,
            OverallVerdict = overall,
            DetailedReceipt = detailed,
            CreatedAt = DateTime.UtcNow
        };

        var arabicResult = results.FirstOrDefault(r => r.GateName == "language_ratio");
        if (arabicResult != null)
        {
            receipt.ArabicRatioVerdict = arabicResult.Verdict;
            receipt.ArabicRatioValue = arabicResult.Evidence.TryGetValue("primary_ratio", out var val) ? Convert.ToDouble(val) : 0;
        }

        var boundaryResult = results.FirstOrDefault(r => r.GateName == "boundary_check");
        if (boundaryResult != null) receipt.BoundaryCheckVerdict = boundaryResult.Verdict;

        var brandResult = results.FirstOrDefault(r => r.GateName == "brand_palette");
        if (brandResult != null) receipt.BrandPaletteVerdict = brandResult.Verdict;

        var assetResult = results.FirstOrDefault(r => r.GateName == "asset_reconciliation");
        if (assetResult != null) receipt.AssetGateVerdict = assetResult.Verdict;

        return receipt;
    }

    public async Task<GateResult> CheckArabicRatioAsync(Guid organizationId, string text)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        return _languageGate.Evaluate(text, org?.LanguagePolicy ?? new LanguagePolicy());
    }

    public async Task<GateResult> CheckBoundaryMarkersAsync(Guid organizationId, string text)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        return _boundaryGate.Evaluate(text, org?.BoundaryTerms ?? new BoundaryTermsConfig());
    }

    public async Task<GateResult> CheckBrandPaletteAsync(Guid organizationId, string text)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        return _brandGate.Evaluate(text, org?.BrandPalette ?? new BrandPalette());
    }

    public async Task<GateResult> CheckAssetReconciliationAsync(Guid organizationId, string slideMarkdown, List<SessionAsset> assets)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        return _assetGate.Evaluate(slideMarkdown, assets, org?.AssetCitationPattern);
    }
}
