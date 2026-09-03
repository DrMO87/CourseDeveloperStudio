namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class QualityReceipt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid SessionId { get; set; }
    public PipelineStage StageName { get; set; }
    public GateVerdict OverallVerdict { get; set; } = GateVerdict.UNVERIFIED;
    public List<QualityGateResult> GateResults { get; set; } = new();
    public Dictionary<string, object> DetailedReceipt { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
