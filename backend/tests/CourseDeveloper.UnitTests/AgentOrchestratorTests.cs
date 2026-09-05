namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.Agents;
using Xunit;

public class AgentOrchestratorTests
{
    [Fact]
    public async Task ArtifactsStage_ActuallyCallsTheRealVaultSync_NotJustLogsIt()
    {
        var org = new Organization { Id = Guid.NewGuid(), Slug = "horus", Name = "Horus" };
        var project = new CourseProject { Id = Guid.NewGuid(), OrganizationId = org.Id, Slug = "pharm-201", Name = "Pharm 201" };
        var session = new CourseSession { Id = Guid.NewGuid(), ProjectId = project.Id, SessionCode = "L1-s1", CurrentStage = PipelineStage.ARTIFACTS };
        var vaultService = new RecordingObsidianVaultService();

        var orchestrator = new AgentOrchestrator(
            vaultService,
            new FakeOrganizationRepository(org),
            new FakeProjectRepository(project),
            new FakeSessionRepository(session));

        var result = await orchestrator.ExecuteStageWorkflowAsync(session.Id, PipelineStage.ARTIFACTS, _ => { });

        Assert.Equal(1, vaultService.SyncSessionCallCount);
        Assert.Same(session, vaultService.LastSyncedSession);
        Assert.Contains("ARTIFACTS_GENERATED_AND_SYNCED", result);
    }

    [Fact]
    public async Task ArtifactsStage_PropagatesASyncFailure_InsteadOfClaimingSuccess()
    {
        var org = new Organization { Id = Guid.NewGuid(), Slug = "horus", Name = "Horus" };
        var project = new CourseProject { Id = Guid.NewGuid(), OrganizationId = org.Id, Slug = "pharm-201", Name = "Pharm 201" };
        var session = new CourseSession { Id = Guid.NewGuid(), ProjectId = project.Id, SessionCode = "L1-s1", CurrentStage = PipelineStage.ARTIFACTS };
        var vaultService = new RecordingObsidianVaultService { ThrowOnSync = true };

        var orchestrator = new AgentOrchestrator(
            vaultService,
            new FakeOrganizationRepository(org),
            new FakeProjectRepository(project),
            new FakeSessionRepository(session));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => orchestrator.ExecuteStageWorkflowAsync(session.Id, PipelineStage.ARTIFACTS, _ => { }));
    }

    private sealed class RecordingObsidianVaultService : IObsidianVaultService
    {
        public int SyncSessionCallCount;
        public CourseSession? LastSyncedSession;
        public bool ThrowOnSync;

        public Task<ObsidianSyncRecord> SyncSessionToVaultAsync(CourseSession session, CourseProject project, Organization org)
        {
            if (ThrowOnSync) throw new InvalidOperationException("simulated disk failure");
            SyncSessionCallCount++;
            LastSyncedSession = session;
            return Task.FromResult(new ObsidianSyncRecord { ProjectId = project.Id, SessionId = session.Id });
        }

        public Task<ObsidianSyncRecord> SyncDossierFileAsync(ProjectDossierFile file, CourseProject project, Organization org)
            => throw new NotSupportedException();
        public Task<int> SyncOrgLogoAsync(Organization org, IReadOnlyList<CourseProject> projects, string fileName, byte[] content)
            => throw new NotSupportedException();
        public Task<ObsidianSyncRecord> SyncNlmDownloadsAsync(CourseProject project, Organization org, string notebookIdentifier)
            => throw new NotSupportedException();
        public Task<string> ReadNoteAsync(string relativePath) => throw new NotSupportedException();
        public Task<List<string>> QueryVaultAreaAsync(string areaName) => throw new NotSupportedException();
        public Task<List<string>> ListParaCategoryFilesAsync(string paraCategory) => throw new NotSupportedException();
        public Task WriteGeneratedCourseBundleAsync(string projectName, string sessionFileName, string markdownContent, Dictionary<string, object> frontmatter)
            => throw new NotSupportedException();
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        private readonly Organization _org;
        public FakeOrganizationRepository(Organization org) => _org = org;
        public Task<Organization?> GetByIdAsync(Guid id) => Task.FromResult(id == _org.Id ? _org : null);
        public Task<List<Organization>> GetAllAsync() => throw new NotSupportedException();
        public Task<Organization?> GetBySlugAsync(string slug) => throw new NotSupportedException();
        public Task<Organization> CreateAsync(Organization organization) => throw new NotSupportedException();
        public Task<Organization> UpdateAsync(Organization organization) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
    }

    private sealed class FakeProjectRepository : IProjectRepository
    {
        private readonly CourseProject _project;
        public FakeProjectRepository(CourseProject project) => _project = project;
        public Task<CourseProject?> GetByIdAsync(Guid id) => Task.FromResult(id == _project.Id ? _project : null);
        public Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null) => throw new NotSupportedException();
        public Task<CourseProject> CreateAsync(CourseProject project) => throw new NotSupportedException();
        public Task<CourseProject> UpdateAsync(CourseProject project) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
    }

    private sealed class FakeSessionRepository : ISessionRepository
    {
        private readonly CourseSession _session;
        public FakeSessionRepository(CourseSession session) => _session = session;
        public Task<CourseSession?> GetByIdAsync(Guid id) => Task.FromResult(id == _session.Id ? _session : null);
        public Task<List<CourseSession>> GetByProjectAsync(Guid projectId) => throw new NotSupportedException();
        public Task<CourseSession> CreateAsync(CourseSession session) => throw new NotSupportedException();
        public Task<CourseSession> UpdateAsync(CourseSession session) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
    }
}
