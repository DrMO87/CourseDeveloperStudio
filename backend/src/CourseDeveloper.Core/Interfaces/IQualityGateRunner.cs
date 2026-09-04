namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;

public record GateResult(
    string GateName,
    GateVerdict Verdict,
    string Detail,
    Dictionary<string, object> Evidence,
    decimal? MetricValue = null);

public interface IQualityGateRunner
{
    Task<QualityReceipt> EvaluateAsync(Guid organizationId, Guid projectId, Guid sessionId, PipelineStage stage, string learnerText, List<SessionAsset> mappedAssets);
}
