namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class QualityGateResult
{
    public Guid Id { get; set; }
    public Guid ReceiptId { get; set; }
    public string GateCode { get; set; } = string.Empty;
    public GateVerdict Verdict { get; set; }
    public decimal? MetricValue { get; set; }
    public string? Detail { get; set; }
    public Dictionary<string, object> Evidence { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
