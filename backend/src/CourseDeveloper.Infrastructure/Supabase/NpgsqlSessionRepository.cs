namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlSessionRepository : ISessionRepository
{
    private readonly IAuthenticatedConnectionFactory _connectionFactory;

    public NpgsqlSessionRepository(IAuthenticatedConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private CourseSession MapRow(NpgsqlDataReader reader)
    {
        return new CourseSession
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            ProjectId = reader.GetGuid(reader.GetOrdinal("project_id")),
            SessionCode = reader.GetString(reader.GetOrdinal("session_code")),
            Level = reader.GetInt32(reader.GetOrdinal("level")),
            SessionNumber = reader.GetInt32(reader.GetOrdinal("session_number")),
            Title = reader.GetString(reader.GetOrdinal("title")),
            DurationMinutes = reader.GetInt32(reader.GetOrdinal("duration_minutes")),
            ProducesArtifacts = reader.GetBoolean(reader.GetOrdinal("produces_artifacts")),
            CurrentStage = Enum.Parse<PipelineStage>(reader.GetString(reader.GetOrdinal("current_stage")), true),
            BlueprintMarkdown = reader.IsDBNull(reader.GetOrdinal("blueprint_markdown")) ? null : reader.GetString(reader.GetOrdinal("blueprint_markdown")),
            SlidesSourceMarkdown = reader.IsDBNull(reader.GetOrdinal("slides_source_markdown")) ? null : reader.GetString(reader.GetOrdinal("slides_source_markdown")),
            HomeSummaryMarkdown = reader.IsDBNull(reader.GetOrdinal("home_summary_markdown")) ? null : reader.GetString(reader.GetOrdinal("home_summary_markdown")),
            DecisionsMarkdown = reader.IsDBNull(reader.GetOrdinal("decisions_markdown")) ? null : reader.GetString(reader.GetOrdinal("decisions_markdown")),
            Status = reader.GetString(reader.GetOrdinal("status")),
            ApprovalKind = reader.IsDBNull(reader.GetOrdinal("approval_kind")) ? null : Enum.Parse<ApprovalKind>(reader.GetString(reader.GetOrdinal("approval_kind")), true),
            ApprovalNote = reader.IsDBNull(reader.GetOrdinal("approval_note")) ? null : reader.GetString(reader.GetOrdinal("approval_note")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"))
        };
    }

    public async Task<List<CourseSession>> GetByProjectAsync(Guid projectId)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("SELECT * FROM course_sessions WHERE project_id = @projectId ORDER BY level, session_number");
        cmd.Parameters.AddWithValue("projectId", projectId);

        var list = new List<CourseSession>();
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                list.Add(MapRow(reader));
            }
        }
        await conn.CommitAsync();
        return list;
    }

    public async Task<CourseSession?> GetByIdAsync(Guid id)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("SELECT * FROM course_sessions WHERE id = @id");
        cmd.Parameters.AddWithValue("id", id);

        CourseSession? result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            result = await reader.ReadAsync() ? MapRow(reader) : null;
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task<CourseSession> CreateAsync(CourseSession session)
    {
        session.CreatedAt = DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            INSERT INTO course_sessions (
                id, project_id, session_code, level, session_number, title,
                duration_minutes, produces_artifacts, current_stage,
                blueprint_markdown, slides_source_markdown, home_summary_markdown,
                decisions_markdown, status, approval_kind, approval_note,
                created_at, updated_at
            ) VALUES (
                @id, @project_id, @session_code, @level, @session_number, @title,
                @duration_minutes, @produces_artifacts, @current_stage::pipeline_stage,
                @blueprint_markdown, @slides_source_markdown, @home_summary_markdown,
                @decisions_markdown, @status, @approval_kind::approval_kind, @approval_note,
                @created_at, @updated_at
            ) RETURNING *");

        cmd.Parameters.AddWithValue("id", session.Id);
        cmd.Parameters.AddWithValue("project_id", session.ProjectId);
        cmd.Parameters.AddWithValue("session_code", session.SessionCode);
        cmd.Parameters.AddWithValue("level", session.Level);
        cmd.Parameters.AddWithValue("session_number", session.SessionNumber);
        cmd.Parameters.AddWithValue("title", session.Title);
        cmd.Parameters.AddWithValue("duration_minutes", session.DurationMinutes);
        cmd.Parameters.AddWithValue("produces_artifacts", session.ProducesArtifacts);
        cmd.Parameters.AddWithValue("current_stage", session.CurrentStage.ToString());
        cmd.Parameters.AddWithValue("blueprint_markdown", session.BlueprintMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("slides_source_markdown", session.SlidesSourceMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("home_summary_markdown", session.HomeSummaryMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("decisions_markdown", session.DecisionsMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("status", session.Status);
        cmd.Parameters.AddWithValue("approval_kind", session.ApprovalKind?.ToString() ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("approval_note", session.ApprovalNote ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("created_at", session.CreatedAt);
        cmd.Parameters.AddWithValue("updated_at", session.UpdatedAt);

        CourseSession result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Failed to insert session.");
            }
            result = MapRow(reader);
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task<CourseSession> UpdateAsync(CourseSession session)
    {
        session.UpdatedAt = DateTime.UtcNow;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            UPDATE course_sessions SET
                session_code = @session_code,
                level = @level,
                session_number = @session_number,
                title = @title,
                duration_minutes = @duration_minutes,
                produces_artifacts = @produces_artifacts,
                current_stage = @current_stage::pipeline_stage,
                blueprint_markdown = @blueprint_markdown,
                slides_source_markdown = @slides_source_markdown,
                home_summary_markdown = @home_summary_markdown,
                decisions_markdown = @decisions_markdown,
                status = @status,
                approval_kind = @approval_kind::approval_kind,
                approval_note = @approval_note,
                updated_at = @updated_at
            WHERE id = @id
            RETURNING *");

        cmd.Parameters.AddWithValue("id", session.Id);
        cmd.Parameters.AddWithValue("session_code", session.SessionCode);
        cmd.Parameters.AddWithValue("level", session.Level);
        cmd.Parameters.AddWithValue("session_number", session.SessionNumber);
        cmd.Parameters.AddWithValue("title", session.Title);
        cmd.Parameters.AddWithValue("duration_minutes", session.DurationMinutes);
        cmd.Parameters.AddWithValue("produces_artifacts", session.ProducesArtifacts);
        cmd.Parameters.AddWithValue("current_stage", session.CurrentStage.ToString());
        cmd.Parameters.AddWithValue("blueprint_markdown", session.BlueprintMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("slides_source_markdown", session.SlidesSourceMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("home_summary_markdown", session.HomeSummaryMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("decisions_markdown", session.DecisionsMarkdown ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("status", session.Status);
        cmd.Parameters.AddWithValue("approval_kind", session.ApprovalKind?.ToString() ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("approval_note", session.ApprovalNote ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("updated_at", session.UpdatedAt);

        CourseSession result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Failed to update session.");
            }
            result = MapRow(reader);
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task DeleteAsync(Guid id)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("DELETE FROM course_sessions WHERE id = @id");
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
        await conn.CommitAsync();
    }
}
