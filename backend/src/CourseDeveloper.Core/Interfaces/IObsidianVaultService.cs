namespace CourseDeveloper.Core.Interfaces;

using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IObsidianVaultService
{
    Task<string> ReadNoteAsync(string relativePath);
    Task<List<string>> QueryVaultAreaAsync(string areaName);
    Task<List<string>> ListParaCategoryFilesAsync(string paraCategory);
    Task WriteGeneratedCourseBundleAsync(string projectName, string sessionFileName, string markdownContent, Dictionary<string, object> frontmatter);
    Task<ObsidianSyncRecord> SyncSessionToVaultAsync(CourseSession session, CourseProject project, Organization org);
    Task<ObsidianSyncRecord> SyncDossierFileAsync(ProjectDossierFile file, CourseProject project, Organization org);
    Task<int> SyncOrgLogoAsync(Organization org, IReadOnlyList<CourseProject> projects, string fileName, byte[] content);
    Task<ObsidianSyncRecord> SyncNlmDownloadsAsync(CourseProject project, Organization org, string notebookIdentifier);
}
