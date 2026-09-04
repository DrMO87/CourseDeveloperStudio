namespace CourseDeveloper.Worker;

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IGenerationJobExecutor
{
    Task<GenerationJobExecutionResult> ExecuteAsync(GenerationJob job, Func<Task<bool>> isCancelRequested, CancellationToken stoppingToken);
}

public sealed record GenerationJobExecutionResult(bool Canceled, Dictionary<string, object> ResultManifest);
