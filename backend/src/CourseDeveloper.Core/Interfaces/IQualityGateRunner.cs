namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;

public record GateResult(string GateName, GateVerdict Verdict, string Detail, Dictionary<string, object> Evidence);

public interface IQualityGateRunner
{
    Task<QualityReceipt> EvaluateAsync(Guid organizationId, Guid projectId, Guid sessionId, PipelineStage stage, string learnerText, List<SessionAsset> mappedAssets);
    Task<GateResult> CheckArabicRatioAsync(Guid organizationId, string text);
    Task<GateResult> CheckBoundaryMarkersAsync(Guid organizationId, string text);
    Task<GateResult> CheckBrandPaletteAsync(Guid organizationId, string text);
    Task<GateResult> CheckAssetReconciliationAsync(Guid organizationId, string slideMarkdown, List<SessionAsset> assets);
}
