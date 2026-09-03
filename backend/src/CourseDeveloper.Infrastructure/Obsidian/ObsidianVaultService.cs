namespace CourseDeveloper.Infrastructure.Obsidian;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.Extensions.Configuration;

public class ObsidianVaultService : IObsidianVaultService
{
    private readonly string _vaultBasePath;

    public ObsidianVaultService(IConfiguration config)
    {
        _vaultBasePath = config["Obsidian:VaultPath"] ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "obsidian-vault");
        EnsureParaStructure();
    }

    private void EnsureParaStructure()
    {
        Directory.CreateDirectory(Path.Combine(_vaultBasePath, "01_Projects"));
        Directory.CreateDirectory(Path.Combine(_vaultBasePath, "02_Areas"));
        Directory.CreateDirectory(Path.Combine(_vaultBasePath, "03_Resources"));
        Directory.CreateDirectory(Path.Combine(_vaultBasePath, "04_Archive"));
    }

    public async Task<string> ReadNoteAsync(string relativePath)
    {
        var fullPath = Path.Combine(_vaultBasePath, relativePath);
        if (!File.Exists(fullPath)) throw new FileNotFoundException($"Obsidian note not found: {relativePath}");
        return await File.ReadAllTextAsync(fullPath, Encoding.UTF8);
    }

    public Task<List<string>> QueryVaultAreaAsync(string areaName)
    {
        var areaFolder = Path.Combine(_vaultBasePath, "02_Areas", areaName);
        if (!Directory.Exists(areaFolder)) return Task.FromResult(new List<string>());

        var files = Directory.GetFiles(areaFolder, "*.md", SearchOption.AllDirectories)
                             .Select(f => Path.GetRelativePath(_vaultBasePath, f))
                             .ToList();
        return Task.FromResult(files);
    }

    public Task<List<string>> ListParaCategoryFilesAsync(string paraCategory)
    {
        var targetDir = Path.Combine(_vaultBasePath, paraCategory);
        if (!Directory.Exists(targetDir)) return Task.FromResult(new List<string>());

        var files = Directory.GetFiles(targetDir, "*.*", SearchOption.AllDirectories)
                             .Select(f => Path.GetRelativePath(_vaultBasePath, f))
                             .ToList();
        return Task.FromResult(files);
    }

    public async Task WriteGeneratedCourseBundleAsync(string projectName, string sessionFileName, string markdownContent, Dictionary<string, object> frontmatter)
    {
        var targetDir = Path.Combine(_vaultBasePath, "01_Projects", projectName);
        Directory.CreateDirectory(targetDir);

        var fullPath = Path.Combine(targetDir, $"{sessionFileName}.md");
        var serialized = FrontmatterEnvelopeParser.Serialize(frontmatter, markdownContent);
        await File.WriteAllTextAsync(fullPath, serialized, Encoding.UTF8);
    }

    public async Task<ObsidianSyncRecord> SyncSessionToVaultAsync(CourseSession session, string projectName)
    {
        var folderName = Path.Combine("01_Projects", projectName, session.SessionCode);
        var targetDir = Path.Combine(_vaultBasePath, folderName);
        Directory.CreateDirectory(targetDir);

        // Write blueprint
        if (!string.IsNullOrEmpty(session.BlueprintMarkdown))
        {
            await File.WriteAllTextAsync(Path.Combine(targetDir, "blueprint.md"), session.BlueprintMarkdown, Encoding.UTF8);
        }

        // Write slides-source
        if (!string.IsNullOrEmpty(session.SlidesSourceMarkdown))
        {
            await File.WriteAllTextAsync(Path.Combine(targetDir, "slides-source.md"), session.SlidesSourceMarkdown, Encoding.UTF8);
        }

        // Write home-summary
        if (!string.IsNullOrEmpty(session.HomeSummaryMarkdown))
        {
            await File.WriteAllTextAsync(Path.Combine(targetDir, "home-summary.md"), session.HomeSummaryMarkdown, Encoding.UTF8);
        }

        // Write decisions
        if (!string.IsNullOrEmpty(session.DecisionsMarkdown))
        {
            await File.WriteAllTextAsync(Path.Combine(targetDir, "decisions.md"), session.DecisionsMarkdown, Encoding.UTF8);
        }

        return new ObsidianSyncRecord
        {
            ProjectId = session.ProjectId,
            SessionId = session.Id,
            VaultRelativePath = folderName,
            ParaCategory = "01_Projects",
            SyncStatus = "SYNCED",
            LastSyncedAt = DateTime.UtcNow
        };
    }
}
