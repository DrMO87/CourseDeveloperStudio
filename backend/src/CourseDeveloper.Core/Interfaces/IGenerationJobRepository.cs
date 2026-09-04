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
}
