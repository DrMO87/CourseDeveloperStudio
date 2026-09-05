namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.Obsidian;
using Microsoft.Extensions.Configuration;
using Xunit;

public class ObsidianVaultServiceTests : IDisposable
{
    private readonly DirectoryInfo _vaultRoot = Directory.CreateTempSubdirectory("obsidian-vault-tests-");

    public void Dispose() => Directory.Delete(_vaultRoot.FullName, recursive: true);

    private ObsidianVaultService CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Obsidian:VaultPath"] = _vaultRoot.FullName })
            .Build();
        return new ObsidianVaultService(config);
    }

    private static (Organization org, CourseProject project, CourseSession session) MakeFixture()
    {
        var org = new Organization { Id = Guid.NewGuid(), Slug = "horus-university", Name = "Horus University" };
        var project = new CourseProject { Id = Guid.NewGuid(), OrganizationId = org.Id, Slug = "pharm-201", Name = "Pharmaceutical Analysis" };
        var session = new CourseSession
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SessionCode = "L1-s1",
            Title = "Spectrophotometry and EMR",
            BlueprintMarkdown = "# Blueprint v1",
            SlidesSourceMarkdown = "# Slides v1",
        };
        return (org, project, session);
    }

    [Fact]
    public async Task FirstSync_WritesFrontmatterArtifactsIndexAreaAndResourceNotes()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();

        var record = await service.SyncSessionToVaultAsync(session, project, org);

        var sessionDir = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1");
        var blueprint = await File.ReadAllTextAsync(Path.Combine(sessionDir, "blueprint.md"));
        Assert.StartsWith("---", blueprint);
        Assert.Contains("session_code: L1-s1", blueprint);
        Assert.Contains("# Blueprint v1", blueprint);
        Assert.False(File.Exists(Path.Combine(sessionDir, "home-summary.md")), "no filler should be written for a null artifact");

        Assert.True(File.Exists(Path.Combine(sessionDir, "_index.md")));
        Assert.True(File.Exists(Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "02_Areas", "horus-university", "Brand_Identity_Contract.md")));
        Assert.True(File.Exists(Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "03_Resources", "pharm-201", "Course_Overview.md")));
        Assert.Equal("SYNCED", record.SyncStatus);
        Assert.Equal(session.Id, record.SessionId);
    }

    [Fact]
    public async Task ReSync_WithUnchangedContent_ProducesByteIdenticalArtifact()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        var path = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1", "blueprint.md");

        await service.SyncSessionToVaultAsync(session, project, org);
        var first = await File.ReadAllTextAsync(path);
        await Task.Delay(10); // ensure a differing synced_at would be visible if hashing were skipped
        await service.SyncSessionToVaultAsync(session, project, org);
        var second = await File.ReadAllTextAsync(path);

        Assert.Contains("content_hash: sha256:", first);
        Assert.Equal(first, second);
    }

    [Fact]
    public async Task ReSync_WithChangedContent_ReplacesTheFileAndHash()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        var path = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1", "blueprint.md");

        await service.SyncSessionToVaultAsync(session, project, org);
        var before = ExtractHash(await File.ReadAllTextAsync(path));

        session.BlueprintMarkdown = "# Blueprint v2 — revised\nsynced_at: body content must not be ignored";
        await service.SyncSessionToVaultAsync(session, project, org);
        var after = await File.ReadAllTextAsync(path);

        Assert.NotEqual(before, ExtractHash(after));
        Assert.Contains("Blueprint v2", after);
        Assert.Contains("synced_at: body content must not be ignored", after);
        Assert.DoesNotContain("Blueprint v1", after);
    }

    [Fact]
    public async Task Assets_AreCopiedIntoASessionAssetsSubfolder_AndMissingSourcesAreRecordedNotThrown()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        var sourceAsset = Path.Combine(_vaultRoot.FullName, "source-fig1.png");
        await File.WriteAllBytesAsync(sourceAsset, new byte[] { 1, 2, 3 });

        session.Assets.Add(new SessionAsset { AssetId = "fig-1", FilePath = sourceAsset, AssetClass = AssetClass.REFERENCE, Sha256 = "abc123" });
        session.Assets.Add(new SessionAsset { AssetId = "fig-missing", FilePath = Path.Combine(_vaultRoot.FullName, "does-not-exist.png") });

        await service.SyncSessionToVaultAsync(session, project, org);

        var assetsDir = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1", "assets");
        Assert.True(File.Exists(Path.Combine(assetsDir, "fig-1.png")));
        var index = await File.ReadAllTextAsync(Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1", "_index.md"));
        Assert.Contains("fig-1", index);
        Assert.Contains("fig-missing", index);
        Assert.Contains("source file not found", index);
    }

    [Fact]
    public async Task ReSync_RemovesArtifactsAndAssetsThatAreNoLongerInTheSession()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        var sourceAsset = Path.Combine(_vaultRoot.FullName, "source-fig1.png");
        await File.WriteAllBytesAsync(sourceAsset, new byte[] { 1, 2, 3 });
        session.Assets.Add(new SessionAsset { AssetId = "fig-1", FilePath = sourceAsset });

        await service.SyncSessionToVaultAsync(session, project, org);
        var sessionDir = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "L1-s1");
        Assert.True(File.Exists(Path.Combine(sessionDir, "blueprint.md")));
        Assert.True(File.Exists(Path.Combine(sessionDir, "assets", "fig-1.png")));

        session.BlueprintMarkdown = null;
        session.Assets.Clear();
        await service.SyncSessionToVaultAsync(session, project, org);

        Assert.False(File.Exists(Path.Combine(sessionDir, "blueprint.md")));
        Assert.False(File.Exists(Path.Combine(sessionDir, "assets", "fig-1.png")));
    }

    [Fact]
    public async Task UnsafeProjectAndSessionSlugs_AreSanitized_AndCannotEscapeTheVault()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        project.Slug = "../../etc";
        session.SessionCode = "../../../evil";

        await service.SyncSessionToVaultAsync(session, project, org);

        var vaultsDir = new DirectoryInfo(Path.Combine(_vaultRoot.FullName, "vaults"));
        foreach (var entry in vaultsDir.GetDirectories())
        {
            Assert.DoesNotContain("..", entry.Name);
        }
        Assert.False(Directory.Exists(_vaultRoot.Parent!.FullName + Path.DirectorySeparatorChar + "etc"));
    }

    [Fact]
    public async Task ReadNoteAsync_RejectsAPathThatEscapesTheVaultRoot()
    {
        var service = CreateService();
        var outsideFile = Path.Combine(_vaultRoot.Parent!.FullName, "outside-secret.txt");
        await File.WriteAllTextAsync(outsideFile, "should never be readable via the vault API");
        try
        {
            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                () => service.ReadNoteAsync(Path.Combine("..", Path.GetFileName(outsideFile))));
        }
        finally
        {
            File.Delete(outsideFile);
        }
    }

    [Fact]
    public async Task ListParaCategoryFilesAsync_ListsProjectVaultsAndRejectsNonParaFolders()
    {
        var service = CreateService();
        var (org, project, session) = MakeFixture();
        await service.SyncSessionToVaultAsync(session, project, org);

        var files = await service.ListParaCategoryFilesAsync("01_Projects");

        Assert.Contains(files, file => file.Replace('\\', '/').EndsWith("vaults/pharm-201/01_Projects/pharm-201/L1-s1/blueprint.md"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => service.ListParaCategoryFilesAsync("vaults"));
    }

    [Fact]
    public async Task DossierFile_SyncsIntoResourcesAndProjectDossierFolder()
    {
        var service = CreateService();
        var (org, project, _) = MakeFixture();
        var file = new ProjectDossierFile
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            FileName = "Course_Specification.pdf",
            Category = DossierFileCategory.COURSE_SPEC,
            FileContentText = "Real extracted course specification text.",
        };

        var record = await service.SyncDossierFileAsync(file, project, org);

        var resourcePath = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "03_Resources", "Course_Dossier_Intake", "COURSE_SPEC", "Course_Specification.md");
        var projectCopyPath = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "01_Projects", "pharm-201", "Dossier", "Course_Specification.md");
        Assert.True(File.Exists(resourcePath));
        Assert.True(File.Exists(projectCopyPath));
        Assert.Contains("Real extracted course specification text.", await File.ReadAllTextAsync(resourcePath));
        Assert.Equal("03_Resources", record.ParaCategory);
    }

    [Fact]
    public async Task SyncOrgLogoAsync_WritesLogoIntoEachProjectVault_AndAreaNoteLinksIt()
    {
        var service = CreateService();
        var (org, project, _) = MakeFixture();
        var secondProject = new CourseProject { Id = Guid.NewGuid(), OrganizationId = org.Id, Slug = "pharm-202", Name = "Pharmacology II" };

        var synced = await service.SyncOrgLogoAsync(org, new[] { project, secondProject }, "logo.PNG", new byte[] { 137, 80, 78, 71 });

        Assert.Equal(2, synced);
        foreach (var slug in new[] { "pharm-201", "pharm-202" })
        {
            var logoPath = Path.Combine(_vaultRoot.FullName, "vaults", slug, "02_Areas", "horus-university", "_assets", "logo.PNG");
            Assert.True(File.Exists(logoPath));
            var areaNote = await File.ReadAllTextAsync(Path.Combine(_vaultRoot.FullName, "vaults", slug, "02_Areas", "horus-university", "Brand_Identity_Contract.md"));
            Assert.Contains("_assets/logo.PNG", areaNote);
        }
    }

    [Fact]
    public async Task SyncNlmDownloadsAsync_CopiesStagedFilesIntoResourcesWithManifest_AndRemovesStaleOnes()
    {
        var service = CreateService();
        var (org, project, _) = MakeFixture();
        var stagingDir = Path.Combine(_vaultRoot.FullName, ".nlm-downloads", "pharm-201", "nb-123");
        Directory.CreateDirectory(stagingDir);
        await File.WriteAllBytesAsync(Path.Combine(stagingDir, "slides.pptx"), new byte[] { 1, 2, 3 });

        var record = await service.SyncNlmDownloadsAsync(project, org, "nb-123");

        var targetDir = Path.Combine(_vaultRoot.FullName, "vaults", "pharm-201", "03_Resources", "NotebookLM_Generated", "nb-123");
        Assert.True(File.Exists(Path.Combine(targetDir, "slides.pptx")));
        var manifest = await File.ReadAllTextAsync(Path.Combine(targetDir, "_manifest.md"));
        Assert.Contains("slides.pptx", manifest);
        Assert.Equal("03_Resources", record.ParaCategory);

        File.Delete(Path.Combine(stagingDir, "slides.pptx"));
        await File.WriteAllBytesAsync(Path.Combine(stagingDir, "audio.mp3"), new byte[] { 4, 5, 6 });
        await service.SyncNlmDownloadsAsync(project, org, "nb-123");

        Assert.False(File.Exists(Path.Combine(targetDir, "slides.pptx")), "stale generated file should be removed on re-sync");
        Assert.True(File.Exists(Path.Combine(targetDir, "audio.mp3")));
    }

    [Fact]
    public async Task SyncNlmDownloadsAsync_ThrowsWhenNothingHasBeenDownloaded()
    {
        var service = CreateService();
        var (org, project, _) = MakeFixture();

        await Assert.ThrowsAsync<FileNotFoundException>(
            () => service.SyncNlmDownloadsAsync(project, org, "never-downloaded"));
    }

    [Fact]
    public async Task SyncNlmDownloadsAsync_SanitizesNotebookIdentifier_AndCannotEscapeTheVault()
    {
        var service = CreateService();
        var (org, project, _) = MakeFixture();

        await Assert.ThrowsAsync<FileNotFoundException>(
            () => service.SyncNlmDownloadsAsync(project, org, "../../etc"));
    }

    private static string ExtractHash(string frontmatterDoc)
    {
        var line = frontmatterDoc.Split('\n').First(l => l.StartsWith("content_hash:"));
        return line.Trim();
    }
}
