namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;

public class CourseProject
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid? OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public string TargetAgeBand { get; set; } = string.Empty;
    public List<int> Levels { get; set; } = new();
    public int SessionsPerLevel { get; set; } = 1;
    public string? ObsidianVaultProjectPath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<CourseSession> Sessions { get; set; } = new();
}
