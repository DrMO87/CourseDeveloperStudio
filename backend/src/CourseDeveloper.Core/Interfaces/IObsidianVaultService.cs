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
    Task<ObsidianSyncRecord> SyncSessionToVaultAsync(CourseSession session, string projectName);
}
