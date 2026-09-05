namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class GenerationJob
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid SessionId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string NotebookLmAccountKey { get; set; } = "default";
    public GenerationJobStatus Status { get; set; } = GenerationJobStatus.queued;

    public string? ClaimedBy { get; set; }
    public DateTime? ClaimedAt { get; set; }
    public DateTime? LeaseExpiresAt { get; set; }
    public DateTime? HeartbeatAt { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; } = 3;

    // STEP 11: gates ClaimNextAsync so a content-quality reschedule (which must stay
    // 'retryable' even past MaxAttempts, per Standing Rule 10a) is not re-claimed before
    // its backoff window elapses. Null means immediately eligible, same as before this
    // column existed.
    public DateTime? NextAttemptAt { get; set; }

    public string? ExternalTaskId { get; set; }
    public string? AcademyBrainVersion { get; set; }
    public bool CancelRequested { get; set; }

    public Dictionary<string, object> Payload { get; set; } = new();
    public Dictionary<string, object>? ResultManifest { get; set; }
    public Dictionary<string, object>? ErrorDetails { get; set; }
    public Dictionary<string, object> Progress { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
