namespace CourseDeveloper.Worker;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public sealed class GenerationJobPollingService : BackgroundService
{
    private readonly IGenerationJobRepository _repo;
    private readonly IGenerationJobExecutor _executor;
    private readonly ILogger<GenerationJobPollingService> _logger;
    private readonly string _workerId;
    private readonly TimeSpan _pollInterval;
    private readonly TimeSpan _leaseDuration;
    private readonly TimeSpan _heartbeatInterval;

    public GenerationJobPollingService(
        IGenerationJobRepository repo,
        IGenerationJobExecutor executor,
        ILogger<GenerationJobPollingService> logger)
    {
        _repo = repo;
        _executor = executor;
        _logger = logger;

        // Unique per process instance so ClaimNextAsync's claimed_by / lease-recovery
        // logic can tell separate worker instances apart even on the same host.
        _workerId = $"{Environment.MachineName}:{Environment.ProcessId}:{Guid.NewGuid():N}";
        _pollInterval = TimeSpan.FromSeconds(ParseEnvSeconds("GENERATION_WORKER_POLL_INTERVAL_SECONDS", 2));
        _leaseDuration = TimeSpan.FromSeconds(ParseEnvSeconds("GENERATION_WORKER_LEASE_SECONDS", 30));
        _heartbeatInterval = TimeSpan.FromSeconds(Math.Max(5, _leaseDuration.TotalSeconds / 3));
    }

    private static double ParseEnvSeconds(string name, double fallback)
        => double.TryParse(Environment.GetEnvironmentVariable(name), out var value) ? value : fallback;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "GenerationJob worker {WorkerId} started (poll={PollSeconds}s, lease={LeaseSeconds}s, heartbeat={HeartbeatSeconds}s).",
            _workerId, _pollInterval.TotalSeconds, _leaseDuration.TotalSeconds, _heartbeatInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var recovered = await _repo.RecoverExpiredLeasesAsync();
                if (recovered > 0)
                {
                    _logger.LogWarning("Recovered {Count} job(s) with an expired lease.", recovered);
                }

                var job = await _repo.ClaimNextAsync(_workerId, _leaseDuration);
                if (job is null)
                {
                    await Task.Delay(_pollInterval, stoppingToken);
                    continue;
                }

                await RunClaimedJobAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Polling loop error; backing off before retrying.");
                await Task.Delay(_pollInterval, stoppingToken);
            }
        }
    }

    private async Task RunClaimedJobAsync(GenerationJob job, CancellationToken stoppingToken)
    {
        _logger.LogInformation("Claimed job {JobId} ({Operation}) for project {ProjectId}.", job.Id, job.Operation, job.ProjectId);
        await _repo.AppendEventAsync(job.Id, "claimed", new Dictionary<string, object> { ["workerId"] = _workerId });
        if (!await _repo.MarkRunningAsync(job.Id, _workerId))
        {
            _logger.LogWarning("Job {JobId} could not transition to running because its lease was lost.", job.Id);
            return;
        }
        await _repo.AppendEventAsync(job.Id, "running");

        using var heartbeatCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        var heartbeatTask = RunHeartbeatLoopAsync(job.Id, heartbeatCts);

        try
        {
            Task<bool> CancelRequested() => CheckCancelRequestedAsync(job.Id);

            var result = await _executor.ExecuteAsync(job, CancelRequested, heartbeatCts.Token);

            if (result.QualityCascadeHandled)
            {
                // The content-quality cascade orchestrator already rescheduled this job
                // itself (see GenerationJobExecutionResult.QualityCascadeHandled's doc
                // comment) — its status/lease are already handled. Calling Complete/Cancel
                // here would be a second, conflicting transition on top of that.
                _logger.LogInformation(
                    "Job {JobId}: content-quality cascade already rescheduled this job; nothing more to do.", job.Id);
            }
            else if (result.Canceled)
            {
                await _repo.CancelAsync(job.Id, _workerId);
                _logger.LogInformation("Job {JobId} canceled.", job.Id);
            }
            else
            {
                var succeeded = await _repo.CompleteAsync(job.Id, _workerId, result.ResultManifest);
                if (succeeded)
                {
                    _logger.LogInformation("Job {JobId} succeeded.", job.Id);
                }
                else
                {
                    _logger.LogInformation("Job {JobId} canceled before completion.", job.Id);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Job {JobId} execution interrupted by worker shutdown; leaving it claimed for lease-expiry recovery.", job.Id);
        }
        catch (OperationCanceledException) when (heartbeatCts.IsCancellationRequested)
        {
            _logger.LogWarning("Job {JobId} execution stopped because its lease was lost.", job.Id);
        }
        catch (NonRetryableJobExecutionException ex)
        {
            _logger.LogError(ex, "Job {JobId} failed deterministically; will not retry.", job.Id);
            await _repo.FailAsync(job.Id, _workerId, new Dictionary<string, object> { ["message"] = ex.Message }, retryable: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Job {JobId} failed.", job.Id);
            await _repo.FailAsync(job.Id, _workerId, new Dictionary<string, object> { ["message"] = ex.Message }, retryable: true);
        }
        finally
        {
            heartbeatCts.Cancel();
            try
            {
                await heartbeatTask;
            }
            catch (OperationCanceledException)
            {
                // expected when the heartbeat loop is stopped alongside job completion
            }
        }
    }

    private Task<bool> CheckCancelRequestedAsync(Guid jobId) => CheckCancelRequestedCoreAsync(jobId);

    private async Task<bool> CheckCancelRequestedCoreAsync(Guid jobId)
    {
        var current = await _repo.GetByIdAsync(jobId);
        return current?.CancelRequested ?? false;
    }

    private async Task RunHeartbeatLoopAsync(Guid jobId, CancellationTokenSource heartbeatCts)
    {
        try
        {
            var token = heartbeatCts.Token;
            while (!token.IsCancellationRequested)
            {
                await Task.Delay(_heartbeatInterval, token);
                var renewed = await _repo.HeartbeatAsync(jobId, _workerId, _leaseDuration);
                if (!renewed)
                {
                    _logger.LogWarning(
                        "Heartbeat for job {JobId} did not renew (lease lost or job no longer claimed by this worker).", jobId);
                    heartbeatCts.Cancel();
                    return;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // normal shutdown of the heartbeat loop once the job finishes
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Heartbeat loop for job {JobId} failed; stopping execution before the lease can expire.", jobId);
            heartbeatCts.Cancel();
        }
    }
}
