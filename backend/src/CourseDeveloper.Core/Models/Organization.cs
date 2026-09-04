namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class Organization
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public InstitutionType InstitutionType { get; set; } = InstitutionType.academy;
    public string? LogoUrl { get; set; }
    
    // Configurable rules (editable in UI)
    public BrandPalette BrandPalette { get; set; } = new();
    public LanguagePolicy LanguagePolicy { get; set; } = new();
    public MascotConfig MascotConfig { get; set; } = new();
    public BoundaryTermsConfig BoundaryTerms { get; set; } = new();
    public QualityGuidelinesConfig QualityGuidelines { get; set; } = new();
    public string AssetCitationPattern { get; set; } = @"\*\*Asset:\*\*\s*`([^`]+)`";
    public string EvidenceMarkerPattern { get; set; } = @"\[Reserved Image Area:\s*([^\]]+?)\s*\]";
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation
    public List<CourseProject> Projects { get; set; } = new();
    public List<QualityGateDefinition> GateDefinitions { get; set; } = new();
}

public class BrandPalette
{
    public List<string> Approved { get; set; } = new();
    public List<string> Retired { get; set; } = new();
}

public class LanguagePolicy
{
    public string PrimaryScript { get; set; } = "arabic";
    public double TargetRatio { get; set; } = 0.70;
    public double Tolerance { get; set; } = 0.10;
    public string SecondaryScript { get; set; } = "latin";
}

public class MascotConfig
{
    public string? CharacterName { get; set; }
    public List<MascotPose> Poses { get; set; } = new();
}

public class MascotPose
{
    public string PoseName { get; set; } = string.Empty;
    public string AssetFile { get; set; } = string.Empty;
    public string SlideContext { get; set; } = string.Empty;
}

public class BoundaryTermsConfig
{
    public List<string> ForbiddenStrings { get; set; } = new();
}

public class QualityGuidelinesConfig
{
    public string AuthorityName { get; set; } = string.Empty;
    public string CoreGuidelines { get; set; } = string.Empty;
    public string ReferenceUrl { get; set; } = string.Empty;
}
