namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
using Xunit;

// STEP 11 Phase B, Batch 3: the NBLM-prompt option's tier-1 fact-correction lever — a
// deterministic re-render of the prompt template from CourseSession/CourseProject/
// Organization facts the worker already knows, never an invented value.
public class NblmPromptPreflightFactCorrectorTests
{
    [Fact]
    public async Task TryCorrectAsync_ReturnsNull_WhenNoPromptFileExistsToRender()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-nofile-").FullName;
        try
        {
            var job = NewJob(vaultRoot, "L1-s1");
            var corrector = new NblmPromptPreflightFactCorrector(
                new FakeSessionRepository(new CourseSession { Id = job.SessionId, DurationMinutes = 45 }),
                new FakeProjectRepository(job.ProjectId, Guid.NewGuid()),
                new FakeOrganizationRepository(new Organization()),
                new FakeNblmPromptRenderer(shouldBeInvoked: false));

            var result = await corrector.TryCorrectAsync(Violation(), job, CancellationToken.None);

            Assert.Null(result);
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TryCorrectAsync_RendersFromTemplateToASessionScopedPath_AndReturnsANewArtifactVersion()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-render-").FullName;
        try
        {
            var promptDir = Path.Combine(vaultRoot, "80-generation");
            Directory.CreateDirectory(promptDir);
            var templatePath = Path.Combine(promptDir, "nblm-student-deck-prompts.md");
            File.WriteAllText(templatePath, "## Notebook A\n\n```\n$SESSION_DURATION_MINUTES\n```\n");
            var expectedRenderedPath = Path.Combine(promptDir, "rendered", "nblm-student-deck-prompts.L1-s1.md");

            var job = NewJob(vaultRoot, "L1-s1");
            var orgId = Guid.NewGuid();
            var session = new CourseSession { Id = job.SessionId, DurationMinutes = 45 };
            var project = new CourseProject { Id = job.ProjectId, OrganizationId = orgId, TargetAgeBand = "ages 9-12" };
            var organization = new Organization { Id = orgId, Name = "Techno Square", MascotConfig = new MascotConfig { CharacterName = "Tata" } };
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);

            var corrector = new NblmPromptPreflightFactCorrector(
                new FakeSessionRepository(session),
                new FakeProjectRepository(job.ProjectId, orgId, project),
                new FakeOrganizationRepository(organization),
                renderer);

            var result = await corrector.TryCorrectAsync(Violation(artifactVersion: 3), job, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(4, result!.NewArtifactVersion);
            Assert.Equal(templatePath, renderer.LastTemplatePath);
            Assert.Equal(expectedRenderedPath, renderer.LastRenderedPath);
            Assert.Equal("45 minutes", renderer.LastDurationMinutesText);
            Assert.Equal("ages 9-12", renderer.LastAudienceDescriptor);
            Assert.Equal("Techno Square", renderer.LastOrgDisplayName);
            Assert.Contains("Tata", renderer.LastBrandingClause);
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TryCorrectAsync_NeverWritesBackToTheSharedTemplate()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-immutable-").FullName;
        try
        {
            var promptDir = Path.Combine(vaultRoot, "80-generation");
            Directory.CreateDirectory(promptDir);
            var templatePath = Path.Combine(promptDir, "nblm-student-deck-prompts.md");
            const string templateText = "## Notebook A\n\n```\n$SESSION_DURATION_MINUTES\n```\n";
            File.WriteAllText(templatePath, templateText);

            var job = NewJob(vaultRoot, "L1-s1");
            var orgId = Guid.NewGuid();
            var project = new CourseProject { Id = job.ProjectId, OrganizationId = orgId, TargetAgeBand = "ages 9-12" };
            var organization = new Organization { Id = orgId, Name = "Techno Square" };
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);

            var corrector = new NblmPromptPreflightFactCorrector(
                new FakeSessionRepository(new CourseSession { Id = job.SessionId, DurationMinutes = 45 }),
                new FakeProjectRepository(job.ProjectId, orgId, project),
                new FakeOrganizationRepository(organization),
                renderer);

            await corrector.TryCorrectAsync(Violation(), job, CancellationToken.None);

            Assert.Equal(templateText, File.ReadAllText(templatePath));
            Assert.NotEqual(renderer.LastTemplatePath, renderer.LastRenderedPath);
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TryCorrectAsync_UsesTheExplicitNoMascotClause_WhenOrganizationHasNoMascotConfigured()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-nomascot-").FullName;
        try
        {
            var promptDir = Path.Combine(vaultRoot, "80-generation");
            Directory.CreateDirectory(promptDir);
            File.WriteAllText(Path.Combine(promptDir, "nblm-student-deck-prompts.md"), "## Notebook A\n\n```\n$SESSION_DURATION_MINUTES\n```\n");

            var job = NewJob(vaultRoot, "L1-s1");
            var orgId = Guid.NewGuid();
            var project = new CourseProject { Id = job.ProjectId, OrganizationId = orgId, TargetAgeBand = "ages 9-12" };
            var organization = new Organization { Id = orgId, Name = "Techno Square" }; // MascotConfig.CharacterName defaults to null
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);

            var corrector = new NblmPromptPreflightFactCorrector(
                new FakeSessionRepository(new CourseSession { Id = job.SessionId, DurationMinutes = 30 }),
                new FakeProjectRepository(job.ProjectId, orgId, project),
                new FakeOrganizationRepository(organization),
                renderer);

            await corrector.TryCorrectAsync(Violation(), job, CancellationToken.None);

            Assert.Contains("No mascot is configured", renderer.LastBrandingClause);
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    private static GenerationJob NewJob(string courseVaultRoot, string sessionCode) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = Guid.NewGuid(),
        SessionId = Guid.NewGuid(),
        ClaimedBy = "test-worker",
        Payload = new Dictionary<string, object>
        {
            ["courseVaultRoot"] = courseVaultRoot,
            ["sessionId"] = sessionCode,
        },
    };

    private static ContentQualityViolation Violation(int artifactVersion = 1) => new()
    {
        Origin = ContentQualityOrigin.AcademyBrainRegistryGate,
        GateCode = "nblm-prompt-preflight",
        ArtifactLineageId = "lineage-1",
        ArtifactVersion = artifactVersion,
        Pass = null,
        Verdict = GateVerdict.FAIL,
        IsBlocking = true,
        Detail = "test violation",
    };

    private sealed class FakeSessionRepository : ISessionRepository
    {
        private readonly CourseSession _session;
        public FakeSessionRepository(CourseSession session) => _session = session;

        public Task<List<CourseSession>> GetByProjectAsync(Guid projectId) => throw new NotSupportedException();
        public Task<CourseSession> CreateAsync(CourseSession session) => throw new NotSupportedException();
        public Task<CourseSession> UpdateAsync(CourseSession session) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
        public Task<CourseSession?> GetByIdAsync(Guid id) => Task.FromResult<CourseSession?>(_session);
    }

    private sealed class FakeProjectRepository : IProjectRepository
    {
        private readonly Guid _projectId;
        private readonly Guid _organizationId;
        private readonly CourseProject? _project;

        public FakeProjectRepository(Guid projectId, Guid organizationId, CourseProject? project = null)
        {
            _projectId = projectId;
            _organizationId = organizationId;
            _project = project;
        }

        public Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null) => throw new NotSupportedException();
        public Task<CourseProject> CreateAsync(CourseProject project) => throw new NotSupportedException();
        public Task<CourseProject> UpdateAsync(CourseProject project) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();

        public Task<CourseProject?> GetByIdAsync(Guid id) => Task.FromResult<CourseProject?>(
            id == _projectId ? _project ?? new CourseProject { Id = id, OrganizationId = _organizationId } : null);
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        private readonly Organization _organization;
        public FakeOrganizationRepository(Organization organization) => _organization = organization;

        public Task<List<Organization>> GetAllAsync() => throw new NotSupportedException();
        public Task<Organization?> GetBySlugAsync(string slug) => throw new NotSupportedException();
        public Task<Organization> CreateAsync(Organization organization) => throw new NotSupportedException();
        public Task<Organization> UpdateAsync(Organization organization) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
        public Task<Organization?> GetByIdAsync(Guid id) => Task.FromResult<Organization?>(_organization);
    }

    private sealed class FakeNblmPromptRenderer : INblmPromptRenderer
    {
        private readonly bool _shouldBeInvoked;
        public string? LastTemplatePath { get; private set; }
        public string? LastRenderedPath { get; private set; }
        public string? LastDurationMinutesText { get; private set; }
        public string? LastAudienceDescriptor { get; private set; }
        public string? LastOrgDisplayName { get; private set; }
        public string? LastBrandingClause { get; private set; }

        public FakeNblmPromptRenderer(bool shouldBeInvoked) => _shouldBeInvoked = shouldBeInvoked;

        public Task<NblmPromptRenderResult> RenderAsync(
            string templatePath, string renderedPath, string durationMinutesText, string audienceDescriptor,
            string orgDisplayName, string brandingClause, CancellationToken ct)
        {
            if (!_shouldBeInvoked)
            {
                throw new NotSupportedException("This test must never reach the renderer.");
            }
            LastTemplatePath = templatePath;
            LastRenderedPath = renderedPath;
            LastDurationMinutesText = durationMinutesText;
            LastAudienceDescriptor = audienceDescriptor;
            LastOrgDisplayName = orgDisplayName;
            LastBrandingClause = brandingClause;
            return Task.FromResult(new NblmPromptRenderResult(renderedPath, "deadbeef", 1));
        }
    }
}
