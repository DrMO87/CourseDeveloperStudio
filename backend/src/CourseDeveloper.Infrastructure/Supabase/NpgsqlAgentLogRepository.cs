namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlAgentLogRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlAgentLogRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<AgentSwarmLog> CreateAsync(AgentSwarmLog log)
    {
        log.Id = log.Id == Guid.Empty ? Guid.NewGuid() : log.Id;
        log.CreatedAt = log.CreatedAt == default ? DateTime.UtcNow : log.CreatedAt;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            INSERT INTO agent_swarm_logs (
                id, project_id, session_id, stage_name, agent_role, agent_thoughts, tool_invocations, input_payload, output_data, tokens_consumed, created_at
            ) VALUES (
                @id, @project_id, @session_id, @stage_name::text, @agent_role, @agent_thoughts, @tool_invocations::jsonb, @input_payload, @output_data, @tokens_consumed, @created_at
            ) RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", log.Id);
        cmd.Parameters.AddWithValue("project_id", log.ProjectId);
        cmd.Parameters.AddWithValue("session_id", log.SessionId ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("stage_name", log.StageName.ToString());
        cmd.Parameters.AddWithValue("agent_role", log.AgentRole);
        cmd.Parameters.AddWithValue("agent_thoughts", log.AgentThoughts);
        cmd.Parameters.AddWithValue("tool_invocations", JsonSerializer.Serialize(log.ToolInvocations, _jsonOptions));
        cmd.Parameters.AddWithValue("input_payload", log.InputPayload ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("output_data", log.OutputData ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("tokens_consumed", log.TokensConsumed);
        cmd.Parameters.AddWithValue("created_at", log.CreatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to insert log.");
    }

    public async Task<List<AgentSwarmLog>> GetBySessionAsync(Guid sessionId)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("SELECT * FROM agent_swarm_logs WHERE session_id = @sessionId ORDER BY created_at", conn);
        cmd.Parameters.AddWithValue("sessionId", sessionId);

        using var reader = await cmd.ExecuteReaderAsync();
        var list = new List<AgentSwarmLog>();
        while (await reader.ReadAsync())
        {
            list.Add(MapRow(reader));
        }
        return list;
    }

    public async Task CreateBatchAsync(List<AgentSwarmLog> logs)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var tx = await conn.BeginTransactionAsync();

        try
        {
            foreach (var log in logs)
            {
                log.Id = log.Id == Guid.Empty ? Guid.NewGuid() : log.Id;
                log.CreatedAt = log.CreatedAt == default ? DateTime.UtcNow : log.CreatedAt;

                using var cmd = new NpgsqlCommand(@"
                    INSERT INTO agent_swarm_logs (
                        id, project_id, session_id, stage_name, agent_role, agent_thoughts, tool_invocations, input_payload, output_data, tokens_consumed, created_at
                    ) VALUES (
                        @id, @project_id, @session_id, @stage_name::text, @agent_role, @agent_thoughts, @tool_invocations::jsonb, @input_payload, @output_data, @tokens_consumed, @created_at
                    )", conn, tx);

                cmd.Parameters.AddWithValue("id", log.Id);
                cmd.Parameters.AddWithValue("project_id", log.ProjectId);
                cmd.Parameters.AddWithValue("session_id", log.SessionId ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("stage_name", log.StageName.ToString());
                cmd.Parameters.AddWithValue("agent_role", log.AgentRole);
                cmd.Parameters.AddWithValue("agent_thoughts", log.AgentThoughts);
                cmd.Parameters.AddWithValue("tool_invocations", JsonSerializer.Serialize(log.ToolInvocations, _jsonOptions));
                cmd.Parameters.AddWithValue("input_payload", log.InputPayload ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("output_data", log.OutputData ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("tokens_consumed", log.TokensConsumed);
                cmd.Parameters.AddWithValue("created_at", log.CreatedAt);

                await cmd.ExecuteNonQueryAsync();
            }

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private AgentSwarmLog MapRow(NpgsqlDataReader reader)
    {
        return new AgentSwarmLog
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            ProjectId = reader.GetGuid(reader.GetOrdinal("project_id")),
            SessionId = reader.IsDBNull(reader.GetOrdinal("session_id")) ? null : reader.GetGuid(reader.GetOrdinal("session_id")),
            StageName = Enum.Parse<PipelineStage>(reader.GetString(reader.GetOrdinal("stage_name")), true),
            AgentRole = reader.GetString(reader.GetOrdinal("agent_role")),
            AgentThoughts = reader.GetString(reader.GetOrdinal("agent_thoughts")),
            ToolInvocations = JsonSerializer.Deserialize<List<string>>(reader.GetString(reader.GetOrdinal("tool_invocations")), _jsonOptions) ?? new(),
            InputPayload = reader.IsDBNull(reader.GetOrdinal("input_payload")) ? null : reader.GetString(reader.GetOrdinal("input_payload")),
            OutputData = reader.IsDBNull(reader.GetOrdinal("output_data")) ? null : reader.GetString(reader.GetOrdinal("output_data")),
            TokensConsumed = reader.GetInt32(reader.GetOrdinal("tokens_consumed")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at"))
        };
    }
}
