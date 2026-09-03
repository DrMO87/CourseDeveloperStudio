namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class ProjectDossierFile
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public long? FileSizeBytes { get; set; }
    public string? MimeType { get; set; }
    public DossierFileCategory Category { get; set; } = DossierFileCategory.UNCLASSIFIED;
    public string? Summary { get; set; }
    public Dictionary<string, object> ExtractedMetadata { get; set; } = new();
    public string? FileContentText { get; set; }
    public string? FileUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
