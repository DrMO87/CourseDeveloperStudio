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
// deterministic re-render of the prompt template from the job's facts. STEP 12: those facts
// now come from the job's immutable enqueue-time OrganizationConfigSnapshot (see
// OrganizationConfigSnapshotPayload), not a live CourseSession/CourseProject/Organization
// read — a queued/retried job must render the same instructions regardless of any
// mid-flight config change.
public class NblmPromptPreflightFactCorrectorTests
{
    [Fact]
    public async Task TryCorrectAsync_ReturnsNull_WhenNoPromptFileExistsToRender()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-nofile-").FullName;
        try
        {
            var job = NewJob(vaultRoot, "L1-s1", new OrganizationConfigSnapshot { DurationMinutes = 45 });
            var corrector = new NblmPromptPreflightFactCorrector(new FakeNblmPromptRenderer(shouldBeInvoked: false));

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

            var snapshot = new OrganizationConfigSnapshot
            {
                DurationMinutes = 45,
                TargetAgeBand = "ages 9-12",
                OrganizationName = "Techno Square",
                MascotCharacterName = "Tata",
            };
            var job = NewJob(vaultRoot, "L1-s1", snapshot);
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);
            var corrector = new NblmPromptPreflightFactCorrector(renderer);

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

            var snapshot = new OrganizationConfigSnapshot { DurationMinutes = 45, TargetAgeBand = "ages 9-12", OrganizationName = "Techno Square" };
            var job = NewJob(vaultRoot, "L1-s1", snapshot);
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);
            var corrector = new NblmPromptPreflightFactCorrector(renderer);

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
    public async Task TryCorrectAsync_UsesTheExplicitNoMascotClause_WhenSnapshotHasNoMascotConfigured()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-nomascot-").FullName;
        try
        {
            var promptDir = Path.Combine(vaultRoot, "80-generation");
            Directory.CreateDirectory(promptDir);
            File.WriteAllText(Path.Combine(promptDir, "nblm-student-deck-prompts.md"), "## Notebook A\n\n```\n$SESSION_DURATION_MINUTES\n```\n");

            // MascotCharacterName defaults to null.
            var snapshot = new OrganizationConfigSnapshot { DurationMinutes = 30, TargetAgeBand = "ages 9-12", OrganizationName = "Techno Square" };
            var job = NewJob(vaultRoot, "L1-s1", snapshot);
            var renderer = new FakeNblmPromptRenderer(shouldBeInvoked: true);
            var corrector = new NblmPromptPreflightFactCorrector(renderer);

            await corrector.TryCorrectAsync(Violation(), job, CancellationToken.None);

            Assert.Contains("No mascot is configured", renderer.LastBrandingClause);
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TryCorrectAsync_ThrowsHonestly_WhenTheJobHasNoOrgConfigSnapshot()
    {
        var vaultRoot = Directory.CreateTempSubdirectory("nblm-corrector-nosnapshot-").FullName;
        try
        {
            var promptDir = Path.Combine(vaultRoot, "80-generation");
            Directory.CreateDirectory(promptDir);
            File.WriteAllText(Path.Combine(promptDir, "nblm-student-deck-prompts.md"), "## Notebook A\n\n```\n$SESSION_DURATION_MINUTES\n```\n");

            var job = new GenerationJob
            {
                Id = Guid.NewGuid(),
                ProjectId = Guid.NewGuid(),
                SessionId = Guid.NewGuid(),
                ClaimedBy = "test-worker",
                Payload = new Dictionary<string, object>
                {
                    ["courseVaultRoot"] = vaultRoot,
                    ["sessionId"] = "L1-s1",
                },
            };
            var corrector = new NblmPromptPreflightFactCorrector(new FakeNblmPromptRenderer(shouldBeInvoked: false));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => corrector.TryCorrectAsync(Violation(), job, CancellationToken.None));
        }
        finally
        {
            Directory.Delete(vaultRoot, recursive: true);
        }
    }

    private static GenerationJob NewJob(string courseVaultRoot, string sessionCode, OrganizationConfigSnapshot snapshot) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = Guid.NewGuid(),
        SessionId = Guid.NewGuid(),
        ClaimedBy = "test-worker",
        Payload = new Dictionary<string, object>
        {
            ["courseVaultRoot"] = courseVaultRoot,
            ["sessionId"] = sessionCode,
            ["orgConfigSnapshot"] = OrganizationConfigSnapshotPayload.ToPayloadValue(snapshot),
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
