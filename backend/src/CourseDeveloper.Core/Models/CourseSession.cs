namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class CourseSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public string SessionCode { get; set; } = string.Empty; // e.g. "L1-s1"
    public int Level { get; set; } = 1;
    public int SessionNumber { get; set; } = 1;
    public string Title { get; set; } = string.Empty;
    public int DurationMinutes { get; set; } = 0;
    public bool ProducesArtifacts { get; set; } = true;
    public PipelineStage CurrentStage { get; set; } = PipelineStage.BRAND_SETUP;
    
    public string? BlueprintMarkdown { get; set; }
    public string? SlidesSourceMarkdown { get; set; }
    public string? HomeSummaryMarkdown { get; set; }
    public string? DecisionsMarkdown { get; set; }
    
    public string Status { get; set; } = "draft";
    public ApprovalKind? ApprovalKind { get; set; }
    public string? ApprovalNote { get; set; }

    public List<SessionAsset> Assets { get; set; } = new();
    public List<QualityReceipt> Receipts { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
