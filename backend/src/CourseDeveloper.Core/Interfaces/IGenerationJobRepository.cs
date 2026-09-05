namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IGenerationJobRepository
{
    Task<GenerationJob> EnqueueAsync(GenerationJob job);
    Task<GenerationJob?> GetByIdAsync(Guid id);
    Task<GenerationJob?> ClaimNextAsync(string workerId, TimeSpan leaseDuration);
    Task<bool> MarkRunningAsync(Guid jobId, string workerId);
    Task<bool> HeartbeatAsync(Guid jobId, string workerId, TimeSpan leaseDuration);
    Task<bool> RequestCancelAsync(Guid jobId);
    Task<bool> CompleteAsync(Guid jobId, string workerId, System.Collections.Generic.Dictionary<string, object> resultManifest);
    Task FailAsync(Guid jobId, string workerId, System.Collections.Generic.Dictionary<string, object> errorDetails, bool retryable);
    Task<bool> CancelAsync(Guid jobId, string workerId);
    Task<int> RecoverExpiredLeasesAsync();
    Task AppendEventAsync(Guid jobId, string eventType, System.Collections.Generic.Dictionary<string, object>? detail = null);

    Task PersistContentQualityProgressAsync(
        Guid jobId,
        string workerId,
        System.Collections.Generic.Dictionary<string, object> progress);

    // STEP 11: content-quality-cascade exhaustion must stay honestly 'retryable' even
    // when AttemptCount == MaxAttempts (Standing Rule 10a) — FailAsync's max-attempts
    // terminal branch must never be reused for this path. Persists the cascade ledger
    // into Progress and gates the next ClaimNextAsync via nextAttemptAt.
    Task RescheduleContentQualityAsync(
        Guid jobId,
        string workerId,
        System.Collections.Generic.Dictionary<string, object> progress,
        DateTime nextAttemptAt,
        System.Collections.Generic.Dictionary<string, object>? errorDetails = null);
}
