namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 12: the concrete GenerationJob -> CourseProject.OrganizationId -> Organization ->
// snapshot resolver. Fails closed on any missing/inconsistent link rather than falling back
// to another organization's config (Standing Rule 10a(ii)) — same fail-closed messages
// already used at this exact lookup chain in AssetReconciliationTargetedPatcher,
// Batch2ContentQualityGateReevaluator, and NblmPromptPreflightFactCorrector.
public sealed class OrganizationConfigSnapshotResolver : IOrganizationConfigSnapshotResolver
{
    private readonly IProjectRepository _projectRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ISessionRepository _sessionRepository;

    public OrganizationConfigSnapshotResolver(
        IProjectRepository projectRepository,
        IOrganizationRepository organizationRepository,
        ISessionRepository sessionRepository)
    {
        _projectRepository = projectRepository;
        _organizationRepository = organizationRepository;
        _sessionRepository = sessionRepository;
    }

    public async Task<OrganizationConfigSnapshot> ResolveAsync(Guid projectId, Guid sessionId, CancellationToken ct)
    {
        var project = await _projectRepository.GetByIdAsync(projectId)
            ?? throw new InvalidOperationException($"Project {projectId} not found.");
        var organizationId = project.OrganizationId
            ?? throw new InvalidOperationException($"Project {projectId} has no organization.");
        var organization = await _organizationRepository.GetByIdAsync(organizationId)
            ?? throw new InvalidOperationException($"Organization {organizationId} not found.");
        var session = await _sessionRepository.GetByIdAsync(sessionId)
            ?? throw new InvalidOperationException($"Session {sessionId} not found.");
        if (session.ProjectId != projectId)
        {
            throw new InvalidOperationException(
                $"Session {sessionId} belongs to project {session.ProjectId}, not project {projectId}.");
        }

        return new OrganizationConfigSnapshot
        {
            OrganizationId = organizationId,
            BrandPalette = new BrandPalette
            {
                Approved = new(organization.BrandPalette.Approved),
                Retired = new(organization.BrandPalette.Retired),
            },
            LanguagePolicy = new LanguagePolicy
            {
                PrimaryScript = organization.LanguagePolicy.PrimaryScript,
                TargetRatio = organization.LanguagePolicy.TargetRatio,
                Tolerance = organization.LanguagePolicy.Tolerance,
                SecondaryScript = organization.LanguagePolicy.SecondaryScript,
            },
            BoundaryTerms = new BoundaryTermsConfig
            {
                ForbiddenStrings = new(organization.BoundaryTerms.ForbiddenStrings),
            },
            DurationMinutes = session.DurationMinutes,
            TargetAgeBand = project.TargetAgeBand,
            OrganizationName = organization.Name,
            MascotCharacterName = organization.MascotConfig.CharacterName,
        };
    }
}
