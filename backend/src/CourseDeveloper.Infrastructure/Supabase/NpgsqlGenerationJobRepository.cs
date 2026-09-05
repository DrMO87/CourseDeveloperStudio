namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

// Registered by CourseDeveloper.Worker under its narrowly-scoped database role. A future
// API enqueue/query adapter must use IAuthenticatedConnectionFactory so user-owned jobs
// remain subject to the caller's RLS identity.
public class NpgsqlGenerationJobRepository : IGenerationJobRepository
{
    private const string ProjectConcurrencyIndex = "generation_job_one_in_flight_per_project";
    private const string NotebookLmAccountConcurrencyIndex = "generation_job_one_in_flight_per_notebooklm_account";
    private readonly NpgsqlDataSource _dataSource;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlGenerationJobRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    private static GenerationJob MapRow(NpgsqlDataReader reader)
    {
        return new GenerationJob
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            ProjectId = reader.GetGuid(reader.GetOrdinal("project_id")),
            SessionId = reader.GetGuid(reader.GetOrdinal("session_id")),
            Operation = reader.GetString(reader.GetOrdinal("operation")),
            IdempotencyKey = reader.GetString(reader.GetOrdinal("idempotency_key")),
            NotebookLmAccountKey = reader.GetString(reader.GetOrdinal("notebooklm_account_key")),
            Status = Enum.Parse<GenerationJobStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            ClaimedBy = reader.IsDBNull(reader.GetOrdinal("claimed_by")) ? null : reader.GetString(reader.GetOrdinal("claimed_by")),
            ClaimedAt = reader.IsDBNull(reader.GetOrdinal("claimed_at")) ? null : reader.GetDateTime(reader.GetOrdinal("claimed_at")),
            LeaseExpiresAt = reader.IsDBNull(reader.GetOrdinal("lease_expires_at")) ? null : reader.GetDateTime(reader.GetOrdinal("lease_expires_at")),
            HeartbeatAt = reader.IsDBNull(reader.GetOrdinal("heartbeat_at")) ? null : reader.GetDateTime(reader.GetOrdinal("heartbeat_at")),
            AttemptCount = reader.GetInt32(reader.GetOrdinal("attempt_count")),
            MaxAttempts = reader.GetInt32(reader.GetOrdinal("max_attempts")),
            ExternalTaskId = reader.IsDBNull(reader.GetOrdinal("external_task_id")) ? null : reader.GetString(reader.GetOrdinal("external_task_id")),
            AcademyBrainVersion = reader.IsDBNull(reader.GetOrdinal("academy_brain_version")) ? null : reader.GetString(reader.GetOrdinal("academy_brain_version")),
            CancelRequested = reader.GetBoolean(reader.GetOrdinal("cancel_requested")),
            Payload = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("payload")), _jsonOptions) ?? new(),
            ResultManifest = reader.IsDBNull(reader.GetOrdinal("result_manifest")) ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("result_manifest")), _jsonOptions),
            ErrorDetails = reader.IsDBNull(reader.GetOrdinal("error_details")) ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("error_details")), _jsonOptions),
            Progress = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("progress")), _jsonOptions) ?? new(),
            NextAttemptAt = reader.IsDBNull(reader.GetOrdinal("next_attempt_at")) ? null : reader.GetDateTime(reader.GetOrdinal("next_attempt_at")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"))
        };
    }

    public async Task<GenerationJob> EnqueueAsync(GenerationJob job)
    {
        job.Id = job.Id == Guid.Empty ? Guid.NewGuid() : job.Id;
        job.CreatedAt = DateTime.UtcNow;
        job.UpdatedAt = job.CreatedAt;

        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var insertCmd = new NpgsqlCommand(@"
            INSERT INTO generation_job (
                id, project_id, session_id, operation, idempotency_key, notebooklm_account_key, status,
                max_attempts, payload, progress, created_at, updated_at
            ) VALUES (
                @id, @project_id, @session_id, @operation, @idempotency_key, @notebooklm_account_key, 'queued',
                @max_attempts, @payload::jsonb, '{}'::jsonb, @created_at, @updated_at
            )
            ON CONFLICT (idempotency_key)
                WHERE status IN ('queued', 'claimed', 'running', 'retryable', 'merging', 'overlaying', 'reviewing')
                DO NOTHING
            RETURNING *", conn);

        insertCmd.Parameters.AddWithValue("id", job.Id);
        insertCmd.Parameters.AddWithValue("project_id", job.ProjectId);
        insertCmd.Parameters.AddWithValue("session_id", job.SessionId);
        insertCmd.Parameters.AddWithValue("operation", job.Operation);
        insertCmd.Parameters.AddWithValue("idempotency_key", job.IdempotencyKey);
        insertCmd.Parameters.AddWithValue("notebooklm_account_key", job.NotebookLmAccountKey);
        insertCmd.Parameters.AddWithValue("max_attempts", job.MaxAttempts);
        insertCmd.Parameters.AddWithValue("payload", JsonSerializer.Serialize(job.Payload, _jsonOptions));
        insertCmd.Parameters.AddWithValue("created_at", job.CreatedAt);
        insertCmd.Parameters.AddWithValue("updated_at", job.UpdatedAt);

        await using (var reader = await insertCmd.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync())
            {
                return MapRow(reader);
            }
        }

        await using var existingCmd = new NpgsqlCommand(
            @"SELECT * FROM generation_job
              WHERE idempotency_key = @key
                AND status IN ('queued', 'claimed', 'running', 'retryable', 'merging', 'overlaying', 'reviewing')
              LIMIT 1", conn);
        existingCmd.Parameters.AddWithValue("key", job.IdempotencyKey);
        await using var existingReader = await existingCmd.ExecuteReaderAsync();
        if (await existingReader.ReadAsync())
        {
            return MapRow(existingReader);
        }

        throw new InvalidOperationException("The active generation job disappeared during idempotent enqueue.");
    }

    public async Task<GenerationJob?> GetByIdAsync(Guid id)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand("SELECT * FROM generation_job WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapRow(reader) : null;
    }

    // Claims the oldest queued/retryable job whose project has no other claimed/running
    // job, using SKIP LOCKED so concurrent worker instances never double-claim. This
    // enforces the per-course concurrency bound (max 1 in-flight job per project) that
    // decision 7 requires without a separate configurable limiter.
    public async Task<GenerationJob?> ClaimNextAsync(string workerId, TimeSpan leaseDuration)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(@"
            UPDATE generation_job
            SET status = 'claimed',
                claimed_by = @workerId,
                claimed_at = now(),
                lease_expires_at = now() + @leaseSeconds * interval '1 second',
                heartbeat_at = now(),
                attempt_count = attempt_count + 1,
                next_attempt_at = NULL,
                updated_at = now()
            WHERE id = (
                SELECT id FROM generation_job candidate
                WHERE candidate.status IN ('queued', 'retryable')
                  AND candidate.cancel_requested = false
                  AND (candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= now())
                  AND candidate.project_id NOT IN (
                      SELECT project_id FROM generation_job
                      WHERE status IN ('claimed', 'running', 'merging', 'overlaying', 'reviewing')
                  )
                  AND candidate.notebooklm_account_key NOT IN (
                      SELECT notebooklm_account_key FROM generation_job
                      WHERE status IN ('claimed', 'running', 'merging', 'overlaying', 'reviewing')
                  )
                ORDER BY candidate.created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING *", conn);

        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("leaseSeconds", leaseDuration.TotalSeconds);

        try
        {
            await using var reader = await cmd.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapRow(reader) : null;
        }
        catch (PostgresException ex) when (
            ex.SqlState == PostgresErrorCodes.UniqueViolation &&
            (ex.ConstraintName == ProjectConcurrencyIndex ||
             ex.ConstraintName == NotebookLmAccountConcurrencyIndex))
        {
            return null;
        }
    }

    public async Task<bool> MarkRunningAsync(Guid jobId, string workerId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job SET status = 'running', updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status = 'claimed'", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        return await cmd.ExecuteNonQueryAsync() == 1;
    }

    public async Task<bool> HeartbeatAsync(Guid jobId, string workerId, TimeSpan leaseDuration)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET heartbeat_at = now(), lease_expires_at = now() + @leaseSeconds * interval '1 second', updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("leaseSeconds", leaseDuration.TotalSeconds);
        return await cmd.ExecuteNonQueryAsync() == 1;
    }

    public async Task<bool> RequestCancelAsync(Guid jobId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET cancel_requested = true,
                  status = CASE WHEN status IN ('queued', 'retryable') THEN 'canceled' ELSE status END,
                  updated_at = now()
              WHERE id = @id AND status IN ('queued', 'claimed', 'running', 'retryable')
              RETURNING status::text", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        var status = (string?)await cmd.ExecuteScalarAsync();
        if (status == "canceled")
        {
            await AppendEventAsync(jobId, "canceled", null);
        }
        return status is not null;
    }

    public async Task<bool> CompleteAsync(Guid jobId, string workerId, Dictionary<string, object> resultManifest)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET status = CASE WHEN cancel_requested THEN 'canceled'::generation_job_status ELSE 'succeeded' END,
                  result_manifest = CASE WHEN cancel_requested THEN result_manifest ELSE @manifest::jsonb END,
                  claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL,
                  updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')
              RETURNING status::text", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("manifest", JsonSerializer.Serialize(resultManifest, _jsonOptions));
        var status = (string?)await cmd.ExecuteScalarAsync();
        if (status is null)
        {
            throw new InvalidOperationException($"Cannot complete generation job {jobId}: ownership or lease was lost.");
        }
        await AppendEventAsync(jobId, status, null);
        return status == "succeeded";
    }

    public async Task FailAsync(Guid jobId, string workerId, Dictionary<string, object> errorDetails, bool retryable)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET status = CASE
                      WHEN cancel_requested THEN 'canceled'::generation_job_status
                      WHEN @retryable AND attempt_count < max_attempts THEN 'retryable'
                      ELSE 'failed'
                  END,
                  error_details = @errorDetails::jsonb,
                  claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL,
                  updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')
              RETURNING status::text", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("retryable", retryable);
        cmd.Parameters.AddWithValue("errorDetails", JsonSerializer.Serialize(errorDetails, _jsonOptions));
        var status = (string?)await cmd.ExecuteScalarAsync();
        if (status is null)
        {
            throw new InvalidOperationException($"Cannot fail generation job {jobId}: ownership or lease was lost.");
        }
        await AppendEventAsync(jobId, status, errorDetails);
    }

    public async Task PersistContentQualityProgressAsync(
        Guid jobId,
        string workerId,
        Dictionary<string, object> progress)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET progress = @progress::jsonb, updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("progress", JsonSerializer.Serialize(progress, _jsonOptions));

        if (await cmd.ExecuteNonQueryAsync() != 1)
        {
            throw new InvalidOperationException(
                $"Cannot persist content-quality progress for generation job {jobId}: ownership or lease was lost.");
        }
    }

    // STEP 11: dedicated reschedule path for content-quality cascade exhaustion. Unlike
    // FailAsync, this NEVER terminates the job as 'failed' regardless of AttemptCount vs
    // MaxAttempts — Standing Rule 10a requires an honest "still working" state, not a
    // fake/generic result and not a dead job. cancel_requested still wins so a user
    // cancellation is never overridden by a stale in-flight cascade decision.
    public async Task RescheduleContentQualityAsync(
        Guid jobId,
        string workerId,
        Dictionary<string, object> progress,
        DateTime nextAttemptAt,
        Dictionary<string, object>? errorDetails = null)
    {
        errorDetails ??= new Dictionary<string, object>();

        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET status = CASE WHEN cancel_requested THEN 'canceled'::generation_job_status ELSE 'retryable'::generation_job_status END,
                  progress = @progress::jsonb,
                  error_details = @errorDetails::jsonb,
                  next_attempt_at = CASE WHEN cancel_requested THEN NULL ELSE @nextAttemptAt END,
                  claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL,
                  updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')
              RETURNING status::text", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        cmd.Parameters.AddWithValue("progress", JsonSerializer.Serialize(progress, _jsonOptions));
        cmd.Parameters.AddWithValue("nextAttemptAt", nextAttemptAt);
        cmd.Parameters.AddWithValue("errorDetails", JsonSerializer.Serialize(errorDetails, _jsonOptions));
        var status = (string?)await cmd.ExecuteScalarAsync();
        if (status is null)
        {
            throw new InvalidOperationException($"Cannot reschedule generation job {jobId} for content-quality retry: ownership or lease was lost.");
        }
        await AppendEventAsync(jobId, status == "canceled" ? "canceled" : "content_quality_rescheduled", errorDetails);
    }

    public async Task<bool> CancelAsync(Guid jobId, string workerId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET status = 'canceled', cancel_requested = true,
                  claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL, updated_at = now()
              WHERE id = @id AND claimed_by = @workerId AND status IN ('claimed', 'running')", conn);
        cmd.Parameters.AddWithValue("id", jobId);
        cmd.Parameters.AddWithValue("workerId", workerId);
        var updated = await cmd.ExecuteNonQueryAsync() == 1;
        if (updated)
        {
            await AppendEventAsync(jobId, "canceled", null);
        }
        return updated;
    }

    // Reclaims jobs whose lease expired without a heartbeat (worker crashed/killed mid-job).
    // Attempts under the cap go back to 'retryable' for the next ClaimNextAsync poll;
    // attempts at the cap terminate as 'failed' rather than looping forever.
    public async Task<int> RecoverExpiredLeasesAsync()
    {
        await using var conn = await _dataSource.OpenConnectionAsync();

        var recoveredIds = new List<Guid>();
        await using (var updateCmd = new NpgsqlCommand(
            @"UPDATE generation_job
              SET status = CASE
                      WHEN cancel_requested THEN 'canceled'::generation_job_status
                      WHEN attempt_count >= max_attempts THEN 'failed'
                      ELSE 'retryable'
                  END,
                  error_details = CASE WHEN NOT cancel_requested AND attempt_count >= max_attempts
                      THEN '{""reason"":""lease_expired_max_attempts""}'::jsonb
                      ELSE error_details END,
                  claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
                  updated_at = now()
              WHERE status IN ('claimed', 'running') AND lease_expires_at < now()
              RETURNING id", conn))
        {
            await using var reader = await updateCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                recoveredIds.Add(reader.GetGuid(0));
            }
        }

        foreach (var id in recoveredIds)
        {
            await AppendEventAsync(id, "lease_expired", null);
        }

        return recoveredIds.Count;
    }

    public async Task AppendEventAsync(Guid jobId, string eventType, Dictionary<string, object>? detail = null)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO generation_job_event (id, job_id, event_type, detail, created_at)
              VALUES (@id, @jobId, @eventType, @detail::jsonb, now())", conn);
        cmd.Parameters.AddWithValue("id", Guid.NewGuid());
        cmd.Parameters.AddWithValue("jobId", jobId);
        cmd.Parameters.AddWithValue("eventType", eventType);
        cmd.Parameters.AddWithValue("detail", JsonSerializer.Serialize(detail ?? new Dictionary<string, object>(), _jsonOptions));
        await cmd.ExecuteNonQueryAsync();
    }
}
