namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlProjectRepository : IProjectRepository
{
    private readonly IAuthenticatedConnectionFactory _connectionFactory;

    public NpgsqlProjectRepository(IAuthenticatedConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private CourseProject MapRow(NpgsqlDataReader reader)
    {
        return new CourseProject
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            UserId = reader.GetGuid(reader.GetOrdinal("user_id")),
            Slug = reader.GetString(reader.GetOrdinal("slug")),
            Name = reader.GetString(reader.GetOrdinal("name")),
            OrganizationId = reader.IsDBNull(reader.GetOrdinal("organization_id")) ? null : reader.GetGuid(reader.GetOrdinal("organization_id")),
            CourseCode = reader.IsDBNull(reader.GetOrdinal("course_code")) ? null : reader.GetString(reader.GetOrdinal("course_code")),
            CreditHours = reader.IsDBNull(reader.GetOrdinal("credit_hours")) ? null : reader.GetInt32(reader.GetOrdinal("credit_hours")),
            Prerequisites = reader.IsDBNull(reader.GetOrdinal("prerequisites")) ? null : reader.GetString(reader.GetOrdinal("prerequisites")),
            AcademicTerm = reader.IsDBNull(reader.GetOrdinal("academic_term")) ? null : reader.GetString(reader.GetOrdinal("academic_term")),
            TotalSessions = reader.IsDBNull(reader.GetOrdinal("total_sessions")) ? null : reader.GetInt32(reader.GetOrdinal("total_sessions")),
            TargetAgeBand = reader.GetString(reader.GetOrdinal("target_age_band")),
            Levels = ((int[])reader.GetValue(reader.GetOrdinal("levels"))).ToList(),
            SessionsPerLevel = reader.GetInt32(reader.GetOrdinal("sessions_per_level")),
            ObsidianVaultProjectPath = reader.IsDBNull(reader.GetOrdinal("obsidian_vault_project_path")) ? null : reader.GetString(reader.GetOrdinal("obsidian_vault_project_path")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"))
        };
    }

    public async Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        var sql = "SELECT * FROM course_projects ";
        if (organizationId.HasValue)
        {
            sql += "WHERE organization_id = @orgId ";
        }
        sql += "ORDER BY created_at DESC";

        using var cmd = conn.CreateCommand(sql);
        if (organizationId.HasValue)
        {
            cmd.Parameters.AddWithValue("orgId", organizationId.Value);
        }

        var list = new List<CourseProject>();
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

    public async Task<CourseProject?> GetByIdAsync(Guid id)
    {
        await using var conn = await _connectionFactory.OpenAsync();

        using var cmd = conn.CreateCommand("SELECT * FROM course_projects WHERE id = @id");
        cmd.Parameters.AddWithValue("id", id);

        CourseProject? project = null;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync())
            {
                project = MapRow(reader);
            }
        }

        if (project != null)
        {
            using var sessionCmd = conn.CreateCommand("SELECT * FROM course_sessions WHERE project_id = @id ORDER BY level, session_number");
            sessionCmd.Parameters.AddWithValue("id", id);
            using var sessionReader = await sessionCmd.ExecuteReaderAsync();
            while (await sessionReader.ReadAsync())
            {
                project.Sessions.Add(new CourseSession
                {
                    Id = sessionReader.GetGuid(sessionReader.GetOrdinal("id")),
                    ProjectId = sessionReader.GetGuid(sessionReader.GetOrdinal("project_id")),
                    SessionCode = sessionReader.GetString(sessionReader.GetOrdinal("session_code")),
                    Level = sessionReader.GetInt32(sessionReader.GetOrdinal("level")),
                    SessionNumber = sessionReader.GetInt32(sessionReader.GetOrdinal("session_number")),
                    Title = sessionReader.GetString(sessionReader.GetOrdinal("title")),
                    DurationMinutes = sessionReader.GetInt32(sessionReader.GetOrdinal("duration_minutes")),
                    ProducesArtifacts = sessionReader.GetBoolean(sessionReader.GetOrdinal("produces_artifacts")),
                    CurrentStage = Enum.Parse<CourseDeveloper.Core.Enums.PipelineStage>(sessionReader.GetString(sessionReader.GetOrdinal("current_stage")), true),
                    BlueprintMarkdown = sessionReader.IsDBNull(sessionReader.GetOrdinal("blueprint_markdown")) ? null : sessionReader.GetString(sessionReader.GetOrdinal("blueprint_markdown")),
                    SlidesSourceMarkdown = sessionReader.IsDBNull(sessionReader.GetOrdinal("slides_source_markdown")) ? null : sessionReader.GetString(sessionReader.GetOrdinal("slides_source_markdown")),
                    HomeSummaryMarkdown = sessionReader.IsDBNull(sessionReader.GetOrdinal("home_summary_markdown")) ? null : sessionReader.GetString(sessionReader.GetOrdinal("home_summary_markdown")),
                    DecisionsMarkdown = sessionReader.IsDBNull(sessionReader.GetOrdinal("decisions_markdown")) ? null : sessionReader.GetString(sessionReader.GetOrdinal("decisions_markdown")),
                    Status = sessionReader.GetString(sessionReader.GetOrdinal("status")),
                    ApprovalKind = sessionReader.IsDBNull(sessionReader.GetOrdinal("approval_kind")) ? null : Enum.Parse<CourseDeveloper.Core.Enums.ApprovalKind>(sessionReader.GetString(sessionReader.GetOrdinal("approval_kind")), true),
                    ApprovalNote = sessionReader.IsDBNull(sessionReader.GetOrdinal("approval_note")) ? null : sessionReader.GetString(sessionReader.GetOrdinal("approval_note")),
                    CreatedAt = sessionReader.GetDateTime(sessionReader.GetOrdinal("created_at")),
                    UpdatedAt = sessionReader.GetDateTime(sessionReader.GetOrdinal("updated_at"))
                });
            }
        }

        await conn.CommitAsync();
        return project;
    }

    public async Task<CourseProject> CreateAsync(CourseProject project)
    {
        project.CreatedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            INSERT INTO course_projects (
                id, user_id, slug, name, organization_id, course_code, credit_hours,
                prerequisites, academic_term, total_sessions, target_age_band, levels,
                sessions_per_level, obsidian_vault_project_path, created_at, updated_at
            ) VALUES (
                @id, @user_id, @slug, @name, @organization_id, @course_code, @credit_hours,
                @prerequisites, @academic_term, @total_sessions, @target_age_band, @levels,
                @sessions_per_level, @obsidian_vault_project_path, @created_at, @updated_at
            ) RETURNING *");

        cmd.Parameters.AddWithValue("id", project.Id);
        cmd.Parameters.AddWithValue("user_id", project.UserId);
        cmd.Parameters.AddWithValue("slug", project.Slug);
        cmd.Parameters.AddWithValue("name", project.Name);
        cmd.Parameters.AddWithValue("organization_id", project.OrganizationId ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("course_code", project.CourseCode ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("credit_hours", project.CreditHours ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("prerequisites", project.Prerequisites ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("academic_term", project.AcademicTerm ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("total_sessions", project.TotalSessions ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("target_age_band", project.TargetAgeBand);
        cmd.Parameters.AddWithValue("levels", project.Levels.ToArray());
        cmd.Parameters.AddWithValue("sessions_per_level", project.SessionsPerLevel);
        cmd.Parameters.AddWithValue("obsidian_vault_project_path", project.ObsidianVaultProjectPath ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("created_at", project.CreatedAt);
        cmd.Parameters.AddWithValue("updated_at", project.UpdatedAt);

        CourseProject result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Failed to insert project.");
            }
            result = MapRow(reader);
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task<CourseProject> UpdateAsync(CourseProject project)
    {
        project.UpdatedAt = DateTime.UtcNow;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            UPDATE course_projects SET
                name = @name,
                course_code = @course_code,
                credit_hours = @credit_hours,
                prerequisites = @prerequisites,
                academic_term = @academic_term,
                total_sessions = @total_sessions,
                target_age_band = @target_age_band,
                levels = @levels,
                sessions_per_level = @sessions_per_level,
                obsidian_vault_project_path = @obsidian_vault_project_path,
                updated_at = @updated_at
            WHERE id = @id
            RETURNING *");

        cmd.Parameters.AddWithValue("id", project.Id);
        cmd.Parameters.AddWithValue("name", project.Name);
        cmd.Parameters.AddWithValue("course_code", project.CourseCode ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("credit_hours", project.CreditHours ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("prerequisites", project.Prerequisites ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("academic_term", project.AcademicTerm ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("total_sessions", project.TotalSessions ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("target_age_band", project.TargetAgeBand);
        cmd.Parameters.AddWithValue("levels", project.Levels.ToArray());
        cmd.Parameters.AddWithValue("sessions_per_level", project.SessionsPerLevel);
        cmd.Parameters.AddWithValue("obsidian_vault_project_path", project.ObsidianVaultProjectPath ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("updated_at", project.UpdatedAt);

        CourseProject result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Failed to update project.");
            }
            result = MapRow(reader);
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task DeleteAsync(Guid id)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("DELETE FROM course_projects WHERE id = @id");
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
        await conn.CommitAsync();
    }
}
