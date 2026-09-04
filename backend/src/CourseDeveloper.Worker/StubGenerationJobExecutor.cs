namespace CourseDeveloper.Worker;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// ponytail: STEP 5 replaces this with the real academy-brain subprocess adapter. This stub
// only proves the claim/heartbeat/lease-recovery/cancel mechanics work end to end — per
// STEP 4's scope lock, invoking academy-brain itself is explicitly out of scope here.
public sealed class StubGenerationJobExecutor : IGenerationJobExecutor
{
    private static readonly TimeSpan SimulatedDuration = TimeSpan.FromSeconds(
        double.TryParse(Environment.GetEnvironmentVariable("GENERATION_WORKER_STUB_DURATION_SECONDS"), out var seconds) ? seconds : 20);

    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(2);

    public async Task<GenerationJobExecutionResult> ExecuteAsync(GenerationJob job, Func<Task<bool>> isCancelRequested, CancellationToken stoppingToken)
    {
        var elapsed = TimeSpan.Zero;

        while (elapsed < SimulatedDuration)
        {
            if (await isCancelRequested())
            {
                return new GenerationJobExecutionResult(Canceled: true, ResultManifest: new());
            }

            await Task.Delay(CheckInterval, stoppingToken);
            elapsed += CheckInterval;
        }

        return new GenerationJobExecutionResult(Canceled: false, ResultManifest: new()
        {
            ["stub"] = true,
            ["simulatedDurationSeconds"] = SimulatedDuration.TotalSeconds
        });
    }
}
