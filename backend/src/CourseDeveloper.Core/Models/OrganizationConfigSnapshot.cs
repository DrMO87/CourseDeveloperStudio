namespace CourseDeveloper.Core.Models;

// STEP 12: the resolved GenerationJob -> CourseProject.OrganizationId -> Organization
// snapshot, meant to be computed once at enqueue time and stored immutably on the job
// (see contracts/org-config/org-config.schema.json). Reading Organization/CourseProject/
// CourseSession live at correction/re-evaluation time — as NblmPromptPreflightRepair.cs
// used to — lets a queued/retried job render different instructions after a mid-flight
// config change; reading this snapshot instead keeps a job's content-quality behavior
// fixed to the values that were true when it was enqueued.
public sealed class OrganizationConfigSnapshot
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public Guid OrganizationId { get; init; }
    public BrandPalette BrandPalette { get; init; } = new();
    public LanguagePolicy LanguagePolicy { get; init; } = new();
    public BoundaryTermsConfig BoundaryTerms { get; init; } = new();

    // Folded in from STEP 11 Batch 3's follow-up review (2026-09-05) — see
    // NblmPromptPreflightRepair.cs.
    public int DurationMinutes { get; init; }
    public string TargetAgeBand { get; init; } = string.Empty;
    public string OrganizationName { get; init; } = string.Empty;
    public string? MascotCharacterName { get; init; }
}
