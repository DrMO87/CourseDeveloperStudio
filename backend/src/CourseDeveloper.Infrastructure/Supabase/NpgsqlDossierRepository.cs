namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlDossierRepository : IDossierRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public NpgsqlDossierRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<List<ProjectDossierFile>> GetByProjectAsync(Guid projectId)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(
            @"SELECT id, project_id, file_name, file_size_bytes, mime_type, category::text, summary, extracted_metadata, file_content_text, file_url, created_at, updated_at
              FROM public.project_dossier_files
              WHERE project_id = @pid
              ORDER BY created_at DESC", conn);
        cmd.Parameters.AddWithValue("pid", projectId);

        using var reader = await cmd.ExecuteReaderAsync();
        var files = new List<ProjectDossierFile>();
        while (await reader.ReadAsync())
        {
            files.Add(MapRow(reader));
        }
        return files;
    }

    public async Task<ProjectDossierFile?> GetByIdAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(
            @"SELECT id, project_id, file_name, file_size_bytes, mime_type, category::text, summary, extracted_metadata, file_content_text, file_url, created_at, updated_at
              FROM public.project_dossier_files
              WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        return null;
    }

    public async Task<ProjectDossierFile> CreateAsync(ProjectDossierFile file)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(
            @"INSERT INTO public.project_dossier_files (
                project_id, file_name, file_size_bytes, mime_type, category, summary, extracted_metadata, file_content_text, file_url, created_at, updated_at
              ) VALUES (
                @project_id, @file_name, @file_size_bytes, @mime_type, @category::dossier_file_category, @summary, @extracted_metadata::jsonb, @file_content_text, @file_url, now(), now()
              ) RETURNING id, created_at, updated_at", conn);

        cmd.Parameters.AddWithValue("project_id", file.ProjectId);
        cmd.Parameters.AddWithValue("file_name", file.FileName);
        cmd.Parameters.AddWithValue("file_size_bytes", (object?)file.FileSizeBytes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("mime_type", (object?)file.MimeType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("category", file.Category.ToString());
        cmd.Parameters.AddWithValue("summary", (object?)file.Summary ?? DBNull.Value);
        cmd.Parameters.AddWithValue("extracted_metadata", JsonSerializer.Serialize(file.ExtractedMetadata ?? new(), JsonOpts));
        cmd.Parameters.AddWithValue("file_content_text", (object?)file.FileContentText ?? DBNull.Value);
        cmd.Parameters.AddWithValue("file_url", (object?)file.FileUrl ?? DBNull.Value);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            file.Id = reader.GetGuid(0);
            file.CreatedAt = reader.GetDateTime(1);
            file.UpdatedAt = reader.GetDateTime(2);
        }
        return file;
    }

    public async Task<ProjectDossierFile> UpdateAsync(ProjectDossierFile file)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(
            @"UPDATE public.project_dossier_files SET
                file_name = @file_name,
                category = @category::dossier_file_category,
                summary = @summary,
                extracted_metadata = @extracted_metadata::jsonb,
                file_content_text = @file_content_text,
                updated_at = now()
              WHERE id = @id
              RETURNING updated_at", conn);

        cmd.Parameters.AddWithValue("id", file.Id);
        cmd.Parameters.AddWithValue("file_name", file.FileName);
        cmd.Parameters.AddWithValue("category", file.Category.ToString());
        cmd.Parameters.AddWithValue("summary", (object?)file.Summary ?? DBNull.Value);
        cmd.Parameters.AddWithValue("extracted_metadata", JsonSerializer.Serialize(file.ExtractedMetadata ?? new(), JsonOpts));
        cmd.Parameters.AddWithValue("file_content_text", (object?)file.FileContentText ?? DBNull.Value);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            file.UpdatedAt = reader.GetDateTime(0);
        }
        return file;
    }

    public async Task DeleteAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("DELETE FROM public.project_dossier_files WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    private static ProjectDossierFile MapRow(NpgsqlDataReader reader)
    {
        var categoryStr = reader.GetString(5);
        Enum.TryParse<DossierFileCategory>(categoryStr, true, out var cat);

        var metaJson = reader.IsDBNull(7) ? "{}" : reader.GetString(7);
        var meta = JsonSerializer.Deserialize<Dictionary<string, object>>(metaJson, JsonOpts) ?? new();

        return new ProjectDossierFile
        {
            Id = reader.GetGuid(0),
            ProjectId = reader.GetGuid(1),
            FileName = reader.GetString(2),
            FileSizeBytes = reader.IsDBNull(3) ? null : reader.GetInt64(3),
            MimeType = reader.IsDBNull(4) ? null : reader.GetString(4),
            Category = cat,
            Summary = reader.IsDBNull(6) ? null : reader.GetString(6),
            ExtractedMetadata = meta,
            FileContentText = reader.IsDBNull(8) ? null : reader.GetString(8),
            FileUrl = reader.IsDBNull(9) ? null : reader.GetString(9),
            CreatedAt = reader.GetDateTime(10),
            UpdatedAt = reader.GetDateTime(11)
        };
    }
}
