namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlOrganizationRepository : IOrganizationRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlOrganizationRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    private Organization MapRow(NpgsqlDataReader reader)
    {
        return new Organization
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            Slug = reader.GetString(reader.GetOrdinal("slug")),
            Name = reader.GetString(reader.GetOrdinal("name")),
            InstitutionType = Enum.Parse<InstitutionType>(reader.GetString(reader.GetOrdinal("institution_type")), true),
            LogoUrl = reader.IsDBNull(reader.GetOrdinal("logo_url")) ? null : reader.GetString(reader.GetOrdinal("logo_url")),
            BrandPalette = JsonSerializer.Deserialize<BrandPalette>(reader.GetString(reader.GetOrdinal("brand_palette")), _jsonOptions) ?? new(),
            LanguagePolicy = JsonSerializer.Deserialize<LanguagePolicy>(reader.GetString(reader.GetOrdinal("language_policy")), _jsonOptions) ?? new(),
            MascotConfig = JsonSerializer.Deserialize<MascotConfig>(reader.GetString(reader.GetOrdinal("mascot_config")), _jsonOptions) ?? new(),
            BoundaryTerms = JsonSerializer.Deserialize<BoundaryTermsConfig>(reader.GetString(reader.GetOrdinal("boundary_terms")), _jsonOptions) ?? new(),
            QualityGuidelines = JsonSerializer.Deserialize<QualityGuidelinesConfig>(reader.GetString(reader.GetOrdinal("quality_guidelines")), _jsonOptions) ?? new(),
            AssetCitationPattern = reader.GetString(reader.GetOrdinal("asset_citation_pattern")),
            EvidenceMarkerPattern = reader.GetString(reader.GetOrdinal("evidence_marker_pattern")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"))
        };
    }

    public async Task<List<Organization>> GetAllAsync()
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("SELECT * FROM organizations ORDER BY created_at DESC", conn);
        using var reader = await cmd.ExecuteReaderAsync();
        
        var list = new List<Organization>();
        while (await reader.ReadAsync())
        {
            list.Add(MapRow(reader));
        }
        return list;
    }

    public async Task<Organization?> GetByIdAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("SELECT * FROM organizations WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        return null;
    }

    public async Task<Organization?> GetBySlugAsync(string slug)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("SELECT * FROM organizations WHERE slug = @slug", conn);
        cmd.Parameters.AddWithValue("slug", slug);
        
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        return null;
    }

    public async Task<Organization> CreateAsync(Organization organization)
    {
        organization.Id = organization.Id == Guid.Empty ? Guid.NewGuid() : organization.Id;
        organization.CreatedAt = DateTime.UtcNow;
        organization.UpdatedAt = DateTime.UtcNow;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            INSERT INTO organizations (
                id, slug, name, institution_type, logo_url, brand_palette, 
                language_policy, mascot_config, boundary_terms, quality_guidelines,
                asset_citation_pattern, evidence_marker_pattern, created_at, updated_at
            ) VALUES (
                @id, @slug, @name, @institution_type::text, @logo_url, @brand_palette::jsonb, 
                @language_policy::jsonb, @mascot_config::jsonb, @boundary_terms::jsonb, @quality_guidelines::jsonb,
                @asset_citation_pattern, @evidence_marker_pattern, @created_at, @updated_at
            ) RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", organization.Id);
        cmd.Parameters.AddWithValue("slug", organization.Slug);
        cmd.Parameters.AddWithValue("name", organization.Name);
        cmd.Parameters.AddWithValue("institution_type", organization.InstitutionType.ToString());
        cmd.Parameters.AddWithValue("logo_url", organization.LogoUrl ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("brand_palette", JsonSerializer.Serialize(organization.BrandPalette, _jsonOptions));
        cmd.Parameters.AddWithValue("language_policy", JsonSerializer.Serialize(organization.LanguagePolicy, _jsonOptions));
        cmd.Parameters.AddWithValue("mascot_config", JsonSerializer.Serialize(organization.MascotConfig, _jsonOptions));
        cmd.Parameters.AddWithValue("boundary_terms", JsonSerializer.Serialize(organization.BoundaryTerms, _jsonOptions));
        cmd.Parameters.AddWithValue("quality_guidelines", JsonSerializer.Serialize(organization.QualityGuidelines, _jsonOptions));
        cmd.Parameters.AddWithValue("asset_citation_pattern", organization.AssetCitationPattern);
        cmd.Parameters.AddWithValue("evidence_marker_pattern", organization.EvidenceMarkerPattern);
        cmd.Parameters.AddWithValue("created_at", organization.CreatedAt);
        cmd.Parameters.AddWithValue("updated_at", organization.UpdatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to insert organization.");
    }

    public async Task<Organization> UpdateAsync(Organization organization)
    {
        organization.UpdatedAt = DateTime.UtcNow;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            UPDATE organizations SET 
                name = @name, 
                institution_type = @institution_type::text, 
                logo_url = @logo_url, 
                brand_palette = @brand_palette::jsonb, 
                language_policy = @language_policy::jsonb, 
                mascot_config = @mascot_config::jsonb, 
                boundary_terms = @boundary_terms::jsonb, 
                quality_guidelines = @quality_guidelines::jsonb,
                asset_citation_pattern = @asset_citation_pattern, 
                evidence_marker_pattern = @evidence_marker_pattern, 
                updated_at = @updated_at
            WHERE id = @id
            RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", organization.Id);
        cmd.Parameters.AddWithValue("name", organization.Name);
        cmd.Parameters.AddWithValue("institution_type", organization.InstitutionType.ToString());
        cmd.Parameters.AddWithValue("logo_url", organization.LogoUrl ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("brand_palette", JsonSerializer.Serialize(organization.BrandPalette, _jsonOptions));
        cmd.Parameters.AddWithValue("language_policy", JsonSerializer.Serialize(organization.LanguagePolicy, _jsonOptions));
        cmd.Parameters.AddWithValue("mascot_config", JsonSerializer.Serialize(organization.MascotConfig, _jsonOptions));
        cmd.Parameters.AddWithValue("boundary_terms", JsonSerializer.Serialize(organization.BoundaryTerms, _jsonOptions));
        cmd.Parameters.AddWithValue("quality_guidelines", JsonSerializer.Serialize(organization.QualityGuidelines, _jsonOptions));
        cmd.Parameters.AddWithValue("asset_citation_pattern", organization.AssetCitationPattern);
        cmd.Parameters.AddWithValue("evidence_marker_pattern", organization.EvidenceMarkerPattern);
        cmd.Parameters.AddWithValue("updated_at", organization.UpdatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to update organization.");
    }

    public async Task DeleteAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("DELETE FROM organizations WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
