namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 3, option (a)+(b): the resolved-field computation shared by the
// nblm-prompt-preflight reevaluator (which needs the EXPECTED verbatim text to check for),
// its fact-corrector (which needs the same values to render), and CourseDeveloper.Worker's
// job-execution boundary (which needs to know whether a rendered file exists before deciding
// what path to hand generate_session.py — see AcademyBrainSubprocessExecutor). Public (not
// internal) for that last, cross-assembly use.
public static class NblmPromptFields
{
    public static string DurationText(CourseSession session) => $"{session.DurationMinutes} minutes";

    public static string AudienceText(CourseProject project) => project.TargetAgeBand;

    // No mascot configured is an explicit organization choice (Organization.MascotConfig
    // is required non-null but its CharacterName is nullable) — never fabricate a mascot
    // clause for an org that opted out.
    public static string BrandingText(Organization organization) =>
        string.IsNullOrWhiteSpace(organization.MascotConfig.CharacterName)
            ? "No mascot is configured for this organization — do not include any mascot character."
            : $"Reference the {organization.MascotConfig.CharacterName} mascot's approved poses on branded slides.";

    // The one immutable, shared file a course ships — read-only. Never write here (that
    // was the bug Codex's review caught: rendering in place destroyed the `$FIELD` markers
    // a later, or differently-configured, session still needs to substitute).
    public static string TemplatePath(string courseVaultRoot) =>
        Path.Combine(courseVaultRoot, "80-generation", "nblm-student-deck-prompts.md");

    // A per-session output file: safe to overwrite any number of times (re-rendering is
    // idempotent — see nblm_prompt_template.py) without ever touching the shared template
    // or another session's already-rendered prompt.
    public static string RenderedPath(string courseVaultRoot, string sessionCode) =>
        Path.Combine(courseVaultRoot, "80-generation", "rendered", $"nblm-student-deck-prompts.{sessionCode}.md");
}

// Tier 1 (Standing Rule 10a-1): the handoff's NBLM-prompt mapping-table row names this
// exact operation — "re-render duration/audience/branding fields from the job's immutable
// snapshot and restore only an exact approved template/version when provenance proves
// drift." Rendering is deterministic and idempotent (see nblm_prompt_template.py), so
// there is nothing to invent: every field comes from CourseSession/CourseProject/
// Organization, facts the worker already knows are true.
//
// The mapping table's tier-2 ("targeted patch") column for this gate names this same
// restoration rather than a distinct operation, but that does NOT mean replaying it as a
// second, separate lever: Codex's review correctly caught that registering the identical
// re-render under both IContentQualityFactCorrector and IContentQualityTargetedPatcher let
// a persistent structural defect (e.g. a duplicated heading no re-render can fix) get a
// second no-op "correction" at tier 2 that still bumped ArtifactVersion — a false mutation
// event for a patch that changed nothing. This class implements only
// IContentQualityFactCorrector: tier 1 is this gate's one and only repair lever, and tier 2
// is a legitimate no-op for it (the orchestrator's `_patchers` lookup simply finds nothing
// registered for "nblm-prompt-preflight" and moves on to tier 3/4, exactly like the other
// STEP-3-ported gates that have no targeted-patch lever today).
public sealed class NblmPromptPreflightFactCorrector : IContentQualityFactCorrector
{
    private readonly ISessionRepository _sessionRepository;
    private readonly IProjectRepository _projectRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly INblmPromptRenderer _renderer;

    public NblmPromptPreflightFactCorrector(
        ISessionRepository sessionRepository,
        IProjectRepository projectRepository,
        IOrganizationRepository organizationRepository,
        INblmPromptRenderer renderer)
    {
        _sessionRepository = sessionRepository;
        _projectRepository = projectRepository;
        _organizationRepository = organizationRepository;
        _renderer = renderer;
    }

    public string GateCode => "nblm-prompt-preflight";

    public async Task<ContentQualityCorrectionResult?> TryCorrectAsync(ContentQualityViolation violation, GenerationJob job, CancellationToken ct)
    {
        var (courseVaultRoot, sessionCode) = AssetReconciliationSource.ReadJobLocation(job);
        var templatePath = NblmPromptFields.TemplatePath(courseVaultRoot);
        if (!File.Exists(templatePath))
        {
            // No addressable template at all — honest "no lever," not a fabricated fix.
            return null;
        }

        var session = await _sessionRepository.GetByIdAsync(job.SessionId)
            ?? throw new InvalidOperationException($"Job {job.Id}: session {job.SessionId} not found.");
        var project = await _projectRepository.GetByIdAsync(job.ProjectId)
            ?? throw new InvalidOperationException($"Job {job.Id}: course project {job.ProjectId} not found.");
        var organizationId = project.OrganizationId
            ?? throw new InvalidOperationException($"Job {job.Id}: project {job.ProjectId} has no organization.");
        var organization = await _organizationRepository.GetByIdAsync(organizationId)
            ?? throw new InvalidOperationException($"Job {job.Id}: organization {organizationId} not found.");

        // Render with the exact same resolved phrases the reevaluator's preflight check later
        // searches for verbatim (NblmPromptFields is the single source of truth for both) — a
        // bare "45" here would silently break the "duration marker present verbatim" check,
        // which looks for "45 minutes". Output goes to this session's own rendered path, never
        // back onto the shared template (see NblmPromptFields.RenderedPath's doc comment).
        var renderedPath = NblmPromptFields.RenderedPath(courseVaultRoot, sessionCode);
        var result = await _renderer.RenderAsync(
            templatePath,
            renderedPath,
            NblmPromptFields.DurationText(session),
            NblmPromptFields.AudienceText(project),
            organization.Name,
            NblmPromptFields.BrandingText(organization),
            ct);

        return new ContentQualityCorrectionResult(
            violation.ArtifactVersion + 1,
            $"Re-rendered NBLM prompt template (version {result.TemplateVersion}, sha256 {result.RenderedSha256}) at '{result.RenderedPath}'.");
    }
}
