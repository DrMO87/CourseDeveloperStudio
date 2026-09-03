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
    private readonly NpgsqlDataSource _dataSource;

    public NpgsqlProjectRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
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
        using var conn = await _dataSource.OpenConnectionAsync();
        var sql = "SELECT * FROM course_projects ";
        if (organizationId.HasValue)
        {
            sql += "WHERE organization_id = @orgId ";
        }
        sql += "ORDER BY created_at DESC";

        using var cmd = new NpgsqlCommand(sql, conn);
        if (organizationId.HasValue)
        {
            cmd.Parameters.AddWithValue("orgId", organizationId.Value);
        }

        using var reader = await cmd.ExecuteReaderAsync();
        var list = new List<CourseProject>();
        while (await reader.ReadAsync())
        {
            list.Add(MapRow(reader));
        }
        return list;
    }

    public async Task<CourseProject?> GetByIdAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        
        using var cmd = new NpgsqlCommand("SELECT * FROM course_projects WHERE id = @id", conn);
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
            using var sessionCmd = new NpgsqlCommand("SELECT * FROM course_sessions WHERE project_id = @id ORDER BY level, session_number", conn);
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

        return project;
    }

    public async Task<CourseProject> CreateAsync(CourseProject project)
    {
        project.CreatedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            INSERT INTO course_projects (
                id, user_id, slug, name, organization_id, target_age_band, levels, 
                sessions_per_level, obsidian_vault_project_path, created_at, updated_at
            ) VALUES (
                @id, @user_id, @slug, @name, @organization_id, @target_age_band, @levels, 
                @sessions_per_level, @obsidian_vault_project_path, @created_at, @updated_at
            ) RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", project.Id);
        cmd.Parameters.AddWithValue("user_id", project.UserId);
        cmd.Parameters.AddWithValue("slug", project.Slug);
        cmd.Parameters.AddWithValue("name", project.Name);
        cmd.Parameters.AddWithValue("organization_id", project.OrganizationId ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("target_age_band", project.TargetAgeBand);
        cmd.Parameters.AddWithValue("levels", project.Levels.ToArray());
        cmd.Parameters.AddWithValue("sessions_per_level", project.SessionsPerLevel);
        cmd.Parameters.AddWithValue("obsidian_vault_project_path", project.ObsidianVaultProjectPath ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("created_at", project.CreatedAt);
        cmd.Parameters.AddWithValue("updated_at", project.UpdatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to insert project.");
    }

    public async Task<CourseProject> UpdateAsync(CourseProject project)
    {
        project.UpdatedAt = DateTime.UtcNow;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            UPDATE course_projects SET 
                name = @name, 
                target_age_band = @target_age_band, 
                levels = @levels, 
                sessions_per_level = @sessions_per_level, 
                obsidian_vault_project_path = @obsidian_vault_project_path, 
                updated_at = @updated_at
            WHERE id = @id
            RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", project.Id);
        cmd.Parameters.AddWithValue("name", project.Name);
        cmd.Parameters.AddWithValue("target_age_band", project.TargetAgeBand);
        cmd.Parameters.AddWithValue("levels", project.Levels.ToArray());
        cmd.Parameters.AddWithValue("sessions_per_level", project.SessionsPerLevel);
        cmd.Parameters.AddWithValue("obsidian_vault_project_path", project.ObsidianVaultProjectPath ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("updated_at", project.UpdatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to update project.");
    }

    public async Task DeleteAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("DELETE FROM course_projects WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
