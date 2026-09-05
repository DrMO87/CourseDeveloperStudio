namespace CourseDeveloper.Worker;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IGenerationJobExecutor
{
    Task<GenerationJobExecutionResult> ExecuteAsync(GenerationJob job, Func<Task<bool>> isCancelRequested, CancellationToken stoppingToken);
}

// QualityCascadeHandled: STEP 11 Phase B, Batch 3's wiring of the content-quality repair
// cascade into this execution boundary (see AcademyBrainSubprocessExecutor). True means the
// cascade orchestrator itself already called IGenerationJobRepository.RescheduleContentQualityAsync
// for this job (a real, unresolved content-quality finding exhausted its repair options) —
// the job's status/lease are already handled. GenerationJobPollingService must not also call
// CompleteAsync/CancelAsync/FailAsync in that case; doing so would be a second, conflicting
// state transition on a job the orchestrator already moved.
public sealed record GenerationJobExecutionResult(bool Canceled, Dictionary<string, object> ResultManifest, bool QualityCascadeHandled = false);

// Signals a deterministic failure (e.g. a quality gate refusing the content) that will
// fail identically on every retry — GenerationJobPollingService must not treat this the
// same as a transient crash.
public sealed class NonRetryableJobExecutionException : Exception
{
    public NonRetryableJobExecutionException(string message) : base(message) { }
}
