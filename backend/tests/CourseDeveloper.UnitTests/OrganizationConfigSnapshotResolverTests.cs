namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.ContentQuality;
using Xunit;

// STEP 12 exit criterion: "a C# adapter test proves the exact organization snapshot reaches
// the per-job config file/payload unchanged." This resolves a real Organization/CourseProject/
// CourseSession chain, serializes it via OrganizationConfigSnapshotPayload, and asserts the
// values that come back out of GenerationJob.Payload are byte-for-byte the same ones the
// organization actually has — using Horus University's real published brand values.
public class OrganizationConfigSnapshotResolverTests
{
    // Horus University — Egypt (Faculty of Pharmacy)'s real values, from
    // vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md
    private static readonly List<string> HorusApproved = new() { "#002147", "#FFB81C", "#1929B5", "#0F766E" };
    private static readonly List<string> HorusRetired = new() { "#FF0000", "#990000" };

    [Fact]
    public async Task ResolveAsync_ProducesASnapshot_ThatRoundTripsThroughJobPayloadUnchanged()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        var organization = new Organization
        {
            Id = orgId,
            Name = "Horus University — Egypt (Faculty of Pharmacy)",
            BrandPalette = new BrandPalette { Approved = HorusApproved, Retired = HorusRetired },
            LanguagePolicy = new LanguagePolicy { TargetRatio = 1.0, Tolerance = 0.0 },
            BoundaryTerms = new BoundaryTermsConfig { ForbiddenStrings = new() { "confidential faculty memo" } },
            MascotConfig = new MascotConfig { CharacterName = "Academic Avatar" },
        };
        var project = new CourseProject { Id = projectId, OrganizationId = orgId, TargetAgeBand = "undergraduate" };
        var session = new CourseSession { Id = sessionId, ProjectId = projectId, DurationMinutes = 50 };

        var resolver = new OrganizationConfigSnapshotResolver(
            new FakeProjectRepository(project),
            new FakeOrganizationRepository(organization),
            new FakeSessionRepository(session));

        var snapshot = await resolver.ResolveAsync(projectId, sessionId, CancellationToken.None);

        var job = new GenerationJob
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            SessionId = sessionId,
            Payload = new Dictionary<string, object>
            {
                ["orgConfigSnapshot"] = OrganizationConfigSnapshotPayload.ToPayloadValue(snapshot),
            },
        };

        var roundTripped = OrganizationConfigSnapshotPayload.FromJobPayload(job);

        Assert.Equal(orgId, roundTripped.OrganizationId);
        Assert.Equal(HorusApproved, roundTripped.BrandPalette.Approved);
        Assert.Equal(HorusRetired, roundTripped.BrandPalette.Retired);
        Assert.Equal(1.0, roundTripped.LanguagePolicy.TargetRatio);
        Assert.Equal(0.0, roundTripped.LanguagePolicy.Tolerance);
        Assert.Equal(new List<string> { "confidential faculty memo" }, roundTripped.BoundaryTerms.ForbiddenStrings);
        Assert.Equal(50, roundTripped.DurationMinutes);
        Assert.Equal("undergraduate", roundTripped.TargetAgeBand);
        Assert.Equal("Horus University — Egypt (Faculty of Pharmacy)", roundTripped.OrganizationName);
        Assert.Equal("Academic Avatar", roundTripped.MascotCharacterName);
    }

    [Fact]
    public async Task ResolveAsync_FailsClosed_WhenProjectHasNoOrganization()
    {
        var projectId = Guid.NewGuid();
        var project = new CourseProject { Id = projectId, OrganizationId = null };
        var resolver = new OrganizationConfigSnapshotResolver(
            new FakeProjectRepository(project),
            new FakeOrganizationRepository(new Organization()),
            new FakeSessionRepository(new CourseSession()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => resolver.ResolveAsync(projectId, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task ResolveAsync_FailsClosed_WhenOrganizationDoesNotExist()
    {
        var projectId = Guid.NewGuid();
        var project = new CourseProject { Id = projectId, OrganizationId = Guid.NewGuid() };
        var resolver = new OrganizationConfigSnapshotResolver(
            new FakeProjectRepository(project),
            new FakeOrganizationRepository(null),
            new FakeSessionRepository(new CourseSession()));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => resolver.ResolveAsync(projectId, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task ResolveAsync_FailsClosed_WhenSessionBelongsToAnotherProject()
    {
        var organization = new Organization { Id = Guid.NewGuid() };
        var project = new CourseProject { Id = Guid.NewGuid(), OrganizationId = organization.Id };
        var session = new CourseSession { Id = Guid.NewGuid(), ProjectId = Guid.NewGuid() };
        var resolver = new OrganizationConfigSnapshotResolver(
            new FakeProjectRepository(project),
            new FakeOrganizationRepository(organization),
            new FakeSessionRepository(session));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => resolver.ResolveAsync(project.Id, session.Id, CancellationToken.None));
    }

    [Fact]
    public async Task ResolveAsync_CopiesMutableOrganizationCollectionsIntoTheSnapshot()
    {
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            BrandPalette = new BrandPalette { Approved = new() { "#002147" }, Retired = new() { "#FF0000" } },
            BoundaryTerms = new BoundaryTermsConfig { ForbiddenStrings = new() { "faculty only" } },
        };
        var project = new CourseProject { Id = Guid.NewGuid(), OrganizationId = organization.Id };
        var session = new CourseSession { Id = Guid.NewGuid(), ProjectId = project.Id };
        var resolver = new OrganizationConfigSnapshotResolver(
            new FakeProjectRepository(project),
            new FakeOrganizationRepository(organization),
            new FakeSessionRepository(session));

        var snapshot = await resolver.ResolveAsync(project.Id, session.Id, CancellationToken.None);
        organization.BrandPalette.Retired.Add("#990000");
        organization.BoundaryTerms.ForbiddenStrings.Add("staff only");

        Assert.Equal(new[] { "#FF0000" }, snapshot.BrandPalette.Retired);
        Assert.Equal(new[] { "faculty only" }, snapshot.BoundaryTerms.ForbiddenStrings);
    }

    [Fact]
    public void FromJobPayload_ReadsEveryFieldAfterAJsonbShapedRoundTrip()
    {
        var orgId = Guid.NewGuid();
        var snapshot = new OrganizationConfigSnapshot
        {
            OrganizationId = orgId,
            BrandPalette = new BrandPalette { Approved = HorusApproved, Retired = HorusRetired },
            LanguagePolicy = new LanguagePolicy { TargetRatio = 0.85, Tolerance = 0.05 },
            BoundaryTerms = new BoundaryTermsConfig { ForbiddenStrings = new() { "faculty only" } },
            DurationMinutes = 50,
            TargetAgeBand = "undergraduate",
            OrganizationName = "Horus University",
            MascotCharacterName = null,
        };
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(
            OrganizationConfigSnapshotPayload.ToPayloadValue(snapshot)));
        var job = new GenerationJob
        {
            Id = Guid.NewGuid(),
            Payload = new Dictionary<string, object> { ["orgConfigSnapshot"] = json.RootElement.Clone() },
        };

        var roundTripped = OrganizationConfigSnapshotPayload.FromJobPayload(job);

        Assert.Equal(orgId, roundTripped.OrganizationId);
        Assert.Equal(HorusApproved, roundTripped.BrandPalette.Approved);
        Assert.Equal(HorusRetired, roundTripped.BrandPalette.Retired);
        Assert.Equal(0.85, roundTripped.LanguagePolicy.TargetRatio);
        Assert.Equal(0.05, roundTripped.LanguagePolicy.Tolerance);
        Assert.Equal(new[] { "faculty only" }, roundTripped.BoundaryTerms.ForbiddenStrings);
        Assert.Equal(50, roundTripped.DurationMinutes);
        Assert.Equal("undergraduate", roundTripped.TargetAgeBand);
        Assert.Equal("Horus University", roundTripped.OrganizationName);
        Assert.Null(roundTripped.MascotCharacterName);
    }

    [Fact]
    public void FromJobPayload_RejectsMissingRequiredCollection()
    {
        var payload = OrganizationConfigSnapshotPayload.ToPayloadValue(new OrganizationConfigSnapshot());
        ((Dictionary<string, object>)payload["brandPalette"]).Remove("approved");
        var job = new GenerationJob
        {
            Id = Guid.NewGuid(),
            Payload = new Dictionary<string, object> { ["orgConfigSnapshot"] = payload },
        };

        Assert.Throws<InvalidOperationException>(() => OrganizationConfigSnapshotPayload.FromJobPayload(job));
    }

    [Fact]
    public void FromJobPayload_RejectsMissingRequiredNullableMascotField()
    {
        var payload = OrganizationConfigSnapshotPayload.ToPayloadValue(new OrganizationConfigSnapshot());
        ((Dictionary<string, object>)payload["nblmPromptFields"]).Remove("mascotCharacterName");
        var job = new GenerationJob
        {
            Id = Guid.NewGuid(),
            Payload = new Dictionary<string, object> { ["orgConfigSnapshot"] = payload },
        };

        Assert.Throws<InvalidOperationException>(() => OrganizationConfigSnapshotPayload.FromJobPayload(job));
    }

    [Fact]
    public void FromJobPayload_CopiesPlainDictionaryCollectionsIntoTheSnapshot()
    {
        var payload = OrganizationConfigSnapshotPayload.ToPayloadValue(new OrganizationConfigSnapshot
        {
            BrandPalette = new BrandPalette { Retired = new() { "#FF0000" } },
        });
        var job = new GenerationJob
        {
            Id = Guid.NewGuid(),
            Payload = new Dictionary<string, object> { ["orgConfigSnapshot"] = payload },
        };

        var snapshot = OrganizationConfigSnapshotPayload.FromJobPayload(job);
        ((List<string>)((Dictionary<string, object>)payload["brandPalette"])["retired"]).Add("#990000");

        Assert.Equal(new[] { "#FF0000" }, snapshot.BrandPalette.Retired);
    }

    private sealed class FakeProjectRepository : IProjectRepository
    {
        private readonly CourseProject? _project;
        public FakeProjectRepository(CourseProject? project) => _project = project;

        public Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null) => throw new NotSupportedException();
        public Task<CourseProject> CreateAsync(CourseProject project) => throw new NotSupportedException();
        public Task<CourseProject> UpdateAsync(CourseProject project) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
        public Task<CourseProject?> GetByIdAsync(Guid id) =>
            Task.FromResult(_project is not null && _project.Id == id ? _project : null);
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        private readonly Organization? _organization;
        public FakeOrganizationRepository(Organization? organization) => _organization = organization;

        public Task<List<Organization>> GetAllAsync() => throw new NotSupportedException();
        public Task<Organization?> GetBySlugAsync(string slug) => throw new NotSupportedException();
        public Task<Organization> CreateAsync(Organization organization) => throw new NotSupportedException();
        public Task<Organization> UpdateAsync(Organization organization) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
        public Task<Organization?> GetByIdAsync(Guid id) =>
            Task.FromResult(_organization is not null && _organization.Id == id ? _organization : null);
    }

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
}
