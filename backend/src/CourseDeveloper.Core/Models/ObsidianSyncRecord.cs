namespace CourseDeveloper.Core.Models;

using System;

public class ObsidianSyncRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid? SessionId { get; set; }
    public string VaultRelativePath { get; set; } = string.Empty;
    public string ParaCategory { get; set; } = "01_Projects"; // "01_Projects", "02_Areas", "03_Resources", "04_Archive"
    public string? FileHash { get; set; }
    public string SyncStatus { get; set; } = "SYNCED"; // "SYNCED", "CONFLICT", "PENDING"
    public DateTime LastSyncedAt { get; set; } = DateTime.UtcNow;
}
