namespace CourseDeveloper.Infrastructure.Obsidian;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.Extensions.Configuration;

public class ObsidianVaultService : IObsidianVaultService
{
    private static readonly HashSet<string> ParaCategories = new(StringComparer.Ordinal)
    {
        "01_Projects", "02_Areas", "03_Resources", "04_Archive",
    };

    private readonly string _vaultBasePath;

    public ObsidianVaultService(IConfiguration config)
    {
        // VAULT_ROOT is the same env var name the frontend's Next.js API routes read
        // (frontend/src/app/api/obsidian/{files,read}/route.ts) — both processes must
        // resolve to the same disk location for the browser's reads to see what this
        // service writes. Obsidian:VaultPath remains for a deployment where the API
        // owns a vault no other process reads directly.
        _vaultBasePath = Path.GetFullPath(
            Environment.GetEnvironmentVariable("VAULT_ROOT")
            ?? config["Obsidian:VaultPath"]
            ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "obsidian-vault"));
    }

    // Path-safety: every path segment built from external input (project slug, session
    // code, org slug, asset id) must be reduced to this before touching the filesystem —
    // otherwise "../../etc" or an absolute path in any of those fields escapes the vault.
    private static string SafeSegment(string? raw)
    {
        var cleaned = Regex.Replace(raw ?? string.Empty, "[^a-zA-Z0-9._-]", "_").Trim('.', '_');
        return string.IsNullOrEmpty(cleaned) ? "untitled" : cleaned;
    }

    // Resolves a vault-relative path and verifies it did not escape _vaultBasePath (via
    // "..", an absolute path, or a symlink-style trick). Throws instead of silently
    // clamping, so a caller passing a malicious path gets a clear rejection, not a
    // surprising redirect to some other file.
    private string ResolveContained(string relativePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_vaultBasePath, relativePath));
        var basePrefix = _vaultBasePath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.Equals(_vaultBasePath, StringComparison.OrdinalIgnoreCase)
            && !fullPath.StartsWith(basePrefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException($"Path escapes the vault root: {relativePath}");
        }
        RejectReparsePoints(fullPath);
        return fullPath;
    }

    private void RejectReparsePoints(string fullPath)
    {
        var relativePath = Path.GetRelativePath(_vaultBasePath, fullPath);
        var currentPath = _vaultBasePath;
        foreach (var segment in relativePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar))
        {
            if (segment.Length == 0 || segment == ".") continue;
            currentPath = Path.Combine(currentPath, segment);
            if (!File.Exists(currentPath) && !Directory.Exists(currentPath)) break;
            if ((File.GetAttributes(currentPath) & FileAttributes.ReparsePoint) != 0)
                throw new UnauthorizedAccessException($"Vault paths cannot traverse links: {relativePath}");
        }
    }

    private string ProjectDir(string projectSlug) =>
        ResolveContained(Path.Combine("vaults", projectSlug));

    public async Task<string> ReadNoteAsync(string relativePath)
    {
        var fullPath = ResolveContained(relativePath);
        if (!File.Exists(fullPath)) throw new FileNotFoundException($"Obsidian note not found: {relativePath}");
        return await File.ReadAllTextAsync(fullPath, Encoding.UTF8);
    }

    public Task<List<string>> QueryVaultAreaAsync(string areaName)
    {
        var areaFolder = ResolveContained(Path.Combine("vaults", SafeSegment(areaName), "02_Areas"));
        if (!Directory.Exists(areaFolder)) return Task.FromResult(new List<string>());

        var files = Directory.GetFiles(areaFolder, "*.md", SearchOption.AllDirectories)
                             .Select(f => Path.GetRelativePath(_vaultBasePath, f))
                             .ToList();
        return Task.FromResult(files);
    }

    public Task<List<string>> ListParaCategoryFilesAsync(string paraCategory)
    {
        if (!ParaCategories.Contains(paraCategory))
            throw new UnauthorizedAccessException($"Unknown PARA category: {paraCategory}");

        var vaultsDir = ResolveContained("vaults");
        if (!Directory.Exists(vaultsDir)) return Task.FromResult(new List<string>());

        var files = Directory.GetDirectories(vaultsDir)
            .Select(vaultDir => ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultDir), paraCategory)))
            .Where(Directory.Exists)
            .SelectMany(targetDir => Directory.GetFiles(targetDir, "*.*", SearchOption.AllDirectories))
            .Select(file => Path.GetRelativePath(_vaultBasePath, file))
            .ToList();
        return Task.FromResult(files);
    }

    // Single low-level primitive: every frontmatter-carrying note this service writes
    // (session artifacts, the org area note, the project resource note) goes through
    // here, so there is exactly one serialization path, not one per call site.
    public async Task WriteGeneratedCourseBundleAsync(string projectName, string sessionFileName, string markdownContent, Dictionary<string, object> frontmatter)
    {
        var targetDir = ResolveContained(Path.Combine("01_Projects", SafeSegment(projectName)));
        Directory.CreateDirectory(targetDir);
        await WriteAtomicAsync(Path.Combine(targetDir, $"{SafeSegment(sessionFileName)}.md"),
            FrontmatterEnvelopeParser.Serialize(frontmatter, markdownContent));
    }

    // Writes to a sibling temp file then renames over the destination, so a reader never
    // observes a half-written file and a crash mid-write never corrupts the prior good copy.
    private static async Task WriteAtomicAsync(string destination, string content)
    {
        var tmp = destination + $".{Guid.NewGuid():N}.tmp";
        try
        {
            if (File.Exists(destination))
            {
                var current = await File.ReadAllTextAsync(destination, Encoding.UTF8);
                if (WithoutSyncTimestamp(current) == WithoutSyncTimestamp(content)) return;
            }

            await File.WriteAllTextAsync(tmp, content, Encoding.UTF8);
            File.Move(tmp, destination, overwrite: true);
        }
        finally
        {
            if (File.Exists(tmp)) File.Delete(tmp);
        }
    }

    private static string WithoutSyncTimestamp(string content)
    {
        var frontmatterEnd = content.IndexOf("\n---", 4, StringComparison.Ordinal);
        if (!content.StartsWith("---", StringComparison.Ordinal) || frontmatterEnd < 0) return content;

        var frontmatter = Regex.Replace(
            content[..frontmatterEnd],
            @"(?m)^synced_at:.*(?:\r?\n|$)",
            string.Empty);
        return frontmatter + content[frontmatterEnd..];
    }

    private static string Sha256Of(string content)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(content));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Sha256OfBytes(byte[] content) =>
        Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();

    private async Task WriteArtifactNoteAsync(
        string sessionDir, string fileName, string? body, string artifactType,
        CourseSession session, CourseProject project, Organization org)
    {
        var destination = Path.Combine(sessionDir, fileName);
        if (string.IsNullOrEmpty(body))
        {
            if (File.Exists(destination)) File.Delete(destination);
            return;
        }

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["project"] = project.Slug,
            ["session_code"] = session.SessionCode,
            ["session_id"] = session.Id.ToString(),
            ["artifact_type"] = artifactType,
            ["source"] = "academy-brain",
            ["content_hash"] = "sha256:" + Sha256Of(body),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };

        await WriteAtomicAsync(
            destination,
            FrontmatterEnvelopeParser.Serialize(frontmatter, body));
    }

    public async Task<ObsidianSyncRecord> SyncSessionToVaultAsync(CourseSession session, CourseProject project, Organization org)
    {
        var projectSlug = SafeSegment(project.Slug);
        var sessionSlug = SafeSegment(session.SessionCode);
        var vaultRoot = ProjectDir(projectSlug);
        var sessionDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "01_Projects", projectSlug, sessionSlug));
        Directory.CreateDirectory(sessionDir);

        await WriteArtifactNoteAsync(sessionDir, "blueprint.md", session.BlueprintMarkdown, "Blueprint", session, project, org);
        await WriteArtifactNoteAsync(sessionDir, "slides-source.md", session.SlidesSourceMarkdown, "SlidesSource", session, project, org);
        await WriteArtifactNoteAsync(sessionDir, "home-summary.md", session.HomeSummaryMarkdown, "StudentSummary", session, project, org);
        await WriteArtifactNoteAsync(sessionDir, "decisions.md", session.DecisionsMarkdown, "QualityReceipt", session, project, org);

        var assetHashes = await SyncAssetsAsync(sessionDir, session);
        await WriteIndexNoteAsync(sessionDir, session, project, org, assetHashes);
        await WriteAreaNoteAsync(vaultRoot, org);
        await WriteResourceNoteAsync(vaultRoot, project, org, session);

        return new ObsidianSyncRecord
        {
            ProjectId = session.ProjectId,
            SessionId = session.Id,
            VaultRelativePath = Path.GetRelativePath(_vaultBasePath, sessionDir).Replace('\\', '/'),
            ParaCategory = "01_Projects",
            FileHash = assetHashes.Count > 0 ? assetHashes[0].sha256 : null,
            SyncStatus = "SYNCED",
            LastSyncedAt = DateTime.UtcNow,
        };
    }

    // Copies each session asset's source file into a per-session assets/ subfolder,
    // named by its (sanitized) asset id so re-sync overwrites the same file instead of
    // accumulating duplicates. A missing source file is recorded, not thrown — assets can
    // legitimately lag behind text artifacts mid-pipeline.
    private async Task<List<(string assetId, string? sha256, bool found)>> SyncAssetsAsync(string sessionDir, CourseSession session)
    {
        var results = new List<(string, string?, bool)>();
        var assetsDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, sessionDir), "assets"));
        Directory.CreateDirectory(assetsDir);
        var expectedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var asset in session.Assets)
        {
            var safeId = SafeSegment(asset.AssetId);
            var found = !string.IsNullOrEmpty(asset.FilePath) && File.Exists(asset.FilePath);
            if (found)
            {
                var rawExtension = Path.GetExtension(asset.FilePath);
                var ext = string.IsNullOrEmpty(rawExtension) ? string.Empty : "." + SafeSegment(rawExtension.TrimStart('.'));
                var dest = Path.Combine(assetsDir, safeId + ext);
                expectedPaths.Add(dest);
                var tmp = dest + $".{Guid.NewGuid():N}.tmp";
                try
                {
                    File.Copy(asset.FilePath, tmp, overwrite: true);
                    File.Move(tmp, dest, overwrite: true);
                }
                finally
                {
                    if (File.Exists(tmp)) File.Delete(tmp);
                }
            }
            results.Add((asset.AssetId, asset.Sha256, found));
        }

        foreach (var existingPath in Directory.GetFiles(assetsDir))
            if (!expectedPaths.Contains(existingPath)) File.Delete(existingPath);

        await Task.CompletedTask;
        return results;
    }

    private async Task WriteIndexNoteAsync(
        string sessionDir, CourseSession session, CourseProject project, Organization org,
        List<(string assetId, string? sha256, bool found)> assets)
    {
        var body = new StringBuilder();
        body.AppendLine($"# {session.Title} ({session.SessionCode})");
        body.AppendLine();
        body.AppendLine($"**Course**: {project.Name}  ");
        body.AppendLine($"**Institution**: {org.Name}");
        body.AppendLine();
        body.AppendLine("## Artifacts");
        if (!string.IsNullOrEmpty(session.BlueprintMarkdown)) body.AppendLine("- [[blueprint.md|Blueprint]]");
        if (!string.IsNullOrEmpty(session.SlidesSourceMarkdown)) body.AppendLine("- [[slides-source.md|Slides Source]]");
        if (!string.IsNullOrEmpty(session.HomeSummaryMarkdown)) body.AppendLine("- [[home-summary.md|Student Summary]]");
        if (!string.IsNullOrEmpty(session.DecisionsMarkdown)) body.AppendLine("- [[decisions.md|Decisions]]");
        body.AppendLine();
        body.AppendLine("## Assets");
        if (assets.Count == 0)
        {
            body.AppendLine("- (none)");
        }
        else
        {
            foreach (var (assetId, sha256, found) in assets)
            {
                var status = found ? "" : " — source file not found at sync time";
                body.AppendLine($"- [[assets/{SafeSegment(assetId)}|{assetId}]] `{sha256 ?? "no-hash"}`{status}");
            }
        }

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["project"] = project.Slug,
            ["session_code"] = session.SessionCode,
            ["session_id"] = session.Id.ToString(),
            ["artifact_type"] = "SessionIndex",
            ["source"] = "obsidian-vault-service",
            ["content_hash"] = "sha256:" + Sha256Of(body.ToString()),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };
        await WriteAtomicAsync(Path.Combine(sessionDir, "_index.md"), FrontmatterEnvelopeParser.Serialize(frontmatter, body.ToString()));
    }

    // 02_Areas holds standing institutional context (brand/mascot/language rules) that
    // applies across every project for this org — real Organization fields only, never
    // fabricated filler.
    private async Task WriteAreaNoteAsync(string vaultRoot, Organization org)
    {
        var areaDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "02_Areas", SafeSegment(org.Slug)));
        Directory.CreateDirectory(areaDir);

        var body = new StringBuilder();
        body.AppendLine($"# {org.Name} — Institutional Brand & Quality Contract");
        body.AppendLine();
        body.AppendLine("## Approved Brand Palette");
        foreach (var color in org.BrandPalette.Approved) body.AppendLine($"- `{color}`");
        body.AppendLine();
        body.AppendLine("## Retired Brand Palette");
        foreach (var color in org.BrandPalette.Retired) body.AppendLine($"- `{color}`");
        body.AppendLine();
        body.AppendLine("## Language Policy");
        body.AppendLine($"- Primary: {org.LanguagePolicy.PrimaryScript} (target {org.LanguagePolicy.TargetRatio:P0}, tolerance {org.LanguagePolicy.Tolerance:P0})");
        body.AppendLine($"- Secondary: {org.LanguagePolicy.SecondaryScript}");
        if (!string.IsNullOrEmpty(org.MascotConfig.CharacterName))
        {
            body.AppendLine();
            body.AppendLine($"## Mascot: {org.MascotConfig.CharacterName}");
            foreach (var pose in org.MascotConfig.Poses)
                body.AppendLine($"- **{pose.PoseName}**: `{pose.AssetFile}` ({pose.SlideContext})");
        }
        if (org.BoundaryTerms.ForbiddenStrings.Count > 0)
        {
            body.AppendLine();
            body.AppendLine("## Forbidden Terms (student-facing material)");
            foreach (var term in org.BoundaryTerms.ForbiddenStrings) body.AppendLine($"- {term}");
        }

        // Logo files land here via SyncOrgLogoAsync, a separate upload flow from the rest
        // of this note — list whatever is actually on disk at write time rather than
        // threading a logo argument through every WriteAreaNoteAsync call site.
        var assetsDir = Path.Combine(areaDir, "_assets");
        if (Directory.Exists(assetsDir))
        {
            var assetFiles = Directory.GetFiles(assetsDir).Select(Path.GetFileName).OrderBy(f => f).ToList();
            if (assetFiles.Count > 0)
            {
                body.AppendLine();
                body.AppendLine("## Logo Assets");
                foreach (var assetFile in assetFiles) body.AppendLine($"- [[_assets/{assetFile}]]");
            }
        }

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["artifact_type"] = "BrandIdentityContract",
            ["source"] = "organization-record",
            ["content_hash"] = "sha256:" + Sha256Of(body.ToString()),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };
        await WriteAtomicAsync(Path.Combine(areaDir, "Brand_Identity_Contract.md"), FrontmatterEnvelopeParser.Serialize(frontmatter, body.ToString()));
    }

    // A dossier file is real, user-uploaded course-source material, not a generated
    // session artifact — it lands in 03_Resources (by category) and gets a linking copy
    // under the project's Dossier/ folder, mirroring where session artifacts link from.
    public async Task<ObsidianSyncRecord> SyncDossierFileAsync(ProjectDossierFile file, CourseProject project, Organization org)
    {
        var projectSlug = SafeSegment(project.Slug);
        var vaultRoot = ProjectDir(projectSlug);
        var safeName = SafeSegment(Path.GetFileNameWithoutExtension(file.FileName)) + ".md";
        var category = file.Category.ToString();

        var body = new StringBuilder();
        body.AppendLine($"# {file.FileName}");
        body.AppendLine();
        body.AppendLine($"**Category**: `{category}`  ");
        if (!string.IsNullOrEmpty(file.Summary)) body.AppendLine($"**Summary**: {file.Summary}");
        body.AppendLine();
        body.AppendLine(file.FileContentText ?? "(no extracted text content)");

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["project"] = project.Slug,
            ["dossier_id"] = file.Id.ToString(),
            ["artifact_type"] = "DossierFile",
            ["category"] = category,
            ["source"] = "dossier-upload",
            ["content_hash"] = "sha256:" + Sha256Of(file.FileContentText ?? file.FileName),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };
        var serialized = FrontmatterEnvelopeParser.Serialize(frontmatter, body.ToString());

        var resourceDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "03_Resources", "Course_Dossier_Intake", SafeSegment(category)));
        Directory.CreateDirectory(resourceDir);
        await WriteAtomicAsync(Path.Combine(resourceDir, safeName), serialized);

        var projectDossierDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "01_Projects", projectSlug, "Dossier"));
        Directory.CreateDirectory(projectDossierDir);
        await WriteAtomicAsync(Path.Combine(projectDossierDir, safeName), serialized);

        return new ObsidianSyncRecord
        {
            ProjectId = project.Id,
            SessionId = null,
            VaultRelativePath = Path.GetRelativePath(_vaultBasePath, Path.Combine(resourceDir, safeName)).Replace('\\', '/'),
            ParaCategory = "03_Resources",
            FileHash = Sha256Of(file.FileContentText ?? file.FileName),
            SyncStatus = "SYNCED",
            LastSyncedAt = DateTime.UtcNow,
        };
    }

    // 03_Resources holds per-project reference material — here, the course-level overview
    // that isn't specific to any one session.
    private async Task WriteResourceNoteAsync(string vaultRoot, CourseProject project, Organization org, CourseSession session)
    {
        var resourceDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "03_Resources", SafeSegment(project.Slug)));
        Directory.CreateDirectory(resourceDir);

        var body = new StringBuilder();
        body.AppendLine($"# {project.Name}" + (project.CourseCode is null ? "" : $" ({project.CourseCode})"));
        body.AppendLine();
        body.AppendLine($"**Institution**: {org.Name}  ");
        if (project.AcademicTerm is not null) body.AppendLine($"**Academic Term**: {project.AcademicTerm}  ");
        if (project.CreditHours is not null) body.AppendLine($"**Credit Hours**: {project.CreditHours}  ");
        if (project.TotalSessions is not null) body.AppendLine($"**Total Sessions**: {project.TotalSessions}  ");
        body.AppendLine();
        body.AppendLine("## Sessions Synced");
        body.AppendLine($"- [[../../01_Projects/{SafeSegment(project.Slug)}/{SafeSegment(session.SessionCode)}/_index.md|{session.SessionCode}: {session.Title}]]");

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["project"] = project.Slug,
            ["artifact_type"] = "CourseOverview",
            ["source"] = "project-record",
            ["content_hash"] = "sha256:" + Sha256Of(body.ToString()),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };
        await WriteAtomicAsync(Path.Combine(resourceDir, "Course_Overview.md"), FrontmatterEnvelopeParser.Serialize(frontmatter, body.ToString()));
    }

    // An org's logo applies to every project vault it appears in (mirrors the per-project
    // 02_Areas layout WriteAreaNoteAsync already uses) — written once per active project,
    // then WriteAreaNoteAsync is re-run so the Brand Identity Contract note picks it up.
    public async Task<int> SyncOrgLogoAsync(Organization org, IReadOnlyList<CourseProject> projects, string fileName, byte[] content)
    {
        var orgSlug = SafeSegment(org.Slug);
        var rawExtension = Path.GetExtension(fileName);
        var safeFileName = SafeSegment(Path.GetFileNameWithoutExtension(fileName))
            + (string.IsNullOrEmpty(rawExtension) ? string.Empty : "." + SafeSegment(rawExtension.TrimStart('.')));

        var synced = 0;
        foreach (var project in projects)
        {
            var vaultRoot = ProjectDir(SafeSegment(project.Slug));
            var assetsDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "02_Areas", orgSlug, "_assets"));
            Directory.CreateDirectory(assetsDir);

            var dest = Path.Combine(assetsDir, safeFileName);
            var tmp = dest + $".{Guid.NewGuid():N}.tmp";
            try
            {
                await File.WriteAllBytesAsync(tmp, content);
                File.Move(tmp, dest, overwrite: true);
            }
            finally
            {
                if (File.Exists(tmp)) File.Delete(tmp);
            }

            await WriteAreaNoteAsync(vaultRoot, org);
            synced++;
        }
        return synced;
    }

    // NotebookLM downloads are staged outside the vault by frontend/src/app/api/nlm/route.ts
    // (.nlm-downloads/<project>/<identifier>/) because that route is not a vault writer.
    // This copies those already-real, already-downloaded files into the vault through the
    // one writer allowed to touch it — nothing here generates or fabricates content, it
    // only relocates files that already exist on disk.
    public async Task<ObsidianSyncRecord> SyncNlmDownloadsAsync(CourseProject project, Organization org, string notebookIdentifier)
    {
        var projectSlug = SafeSegment(project.Slug);
        var safeIdentifier = SafeSegment(notebookIdentifier);
        var sourceDir = ResolveContained(Path.Combine(".nlm-downloads", projectSlug, safeIdentifier));
        if (!Directory.Exists(sourceDir))
            throw new FileNotFoundException($"No NotebookLM downloads staged for '{notebookIdentifier}'. Run Download Artifacts first.");

        var vaultRoot = ProjectDir(projectSlug);
        var targetDir = ResolveContained(Path.Combine(Path.GetRelativePath(_vaultBasePath, vaultRoot), "03_Resources", "NotebookLM_Generated", safeIdentifier));
        Directory.CreateDirectory(targetDir);

        var manifest = new List<(string name, string sha256)>();
        var expectedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var sourceFile in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
        {
            var rawExt = Path.GetExtension(sourceFile);
            var safeName = SafeSegment(Path.GetFileNameWithoutExtension(sourceFile))
                + (string.IsNullOrEmpty(rawExt) ? string.Empty : "." + SafeSegment(rawExt.TrimStart('.')));
            var dest = Path.Combine(targetDir, safeName);
            expectedPaths.Add(dest);

            var bytes = await File.ReadAllBytesAsync(sourceFile);
            var tmp = dest + $".{Guid.NewGuid():N}.tmp";
            try
            {
                await File.WriteAllBytesAsync(tmp, bytes);
                File.Move(tmp, dest, overwrite: true);
            }
            finally
            {
                if (File.Exists(tmp)) File.Delete(tmp);
            }
            manifest.Add((safeName, Sha256OfBytes(bytes)));
        }

        var manifestPath = Path.Combine(targetDir, "_manifest.md");
        foreach (var existingPath in Directory.GetFiles(targetDir))
            if (!expectedPaths.Contains(existingPath) && !existingPath.Equals(manifestPath, StringComparison.OrdinalIgnoreCase))
                File.Delete(existingPath);

        var body = new StringBuilder();
        body.AppendLine($"# NotebookLM Generated Artifacts — {notebookIdentifier}");
        body.AppendLine();
        body.AppendLine($"**Course**: {project.Name}  ");
        body.AppendLine($"**Institution**: {org.Name}");
        body.AppendLine();
        body.AppendLine("## Files");
        if (manifest.Count == 0)
        {
            body.AppendLine("- (none)");
        }
        else
        {
            foreach (var (name, sha256) in manifest) body.AppendLine($"- [[{name}]] `sha256:{sha256}`");
        }

        var frontmatter = new Dictionary<string, object>
        {
            ["organization"] = org.Slug,
            ["project"] = project.Slug,
            ["notebook_identifier"] = notebookIdentifier,
            ["artifact_type"] = "NotebookLMGenerated",
            ["source"] = "notebooklm-download",
            ["content_hash"] = "sha256:" + Sha256Of(body.ToString()),
            ["synced_at"] = DateTime.UtcNow.ToString("o"),
        };
        await WriteAtomicAsync(manifestPath, FrontmatterEnvelopeParser.Serialize(frontmatter, body.ToString()));

        return new ObsidianSyncRecord
        {
            ProjectId = project.Id,
            SessionId = null,
            VaultRelativePath = Path.GetRelativePath(_vaultBasePath, targetDir).Replace('\\', '/'),
            ParaCategory = "03_Resources",
            FileHash = manifest.Count > 0 ? manifest[0].sha256 : null,
            SyncStatus = "SYNCED",
            LastSyncedAt = DateTime.UtcNow,
        };
    }
}
