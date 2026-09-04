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

public sealed record GenerationJobExecutionResult(bool Canceled, Dictionary<string, object> ResultManifest);

// Signals a deterministic failure (e.g. a quality gate refusing the content) that will
// fail identically on every retry — GenerationJobPollingService must not treat this the
// same as a transient crash.
public sealed class NonRetryableJobExecutionException : Exception
{
    public NonRetryableJobExecutionException(string message) : base(message) { }
}
