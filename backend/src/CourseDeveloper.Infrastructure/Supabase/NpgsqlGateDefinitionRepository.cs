namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Npgsql;

public class NpgsqlGateDefinitionRepository : IGateDefinitionRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlGateDefinitionRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    private QualityGateDefinition MapRow(NpgsqlDataReader reader)
    {
        return new QualityGateDefinition
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            OrganizationId = reader.GetGuid(reader.GetOrdinal("organization_id")),
            GateCode = reader.GetString(reader.GetOrdinal("gate_code")),
            DisplayName = reader.GetString(reader.GetOrdinal("display_name")),
            IsEnabled = reader.GetBoolean(reader.GetOrdinal("is_enabled")),
            GateConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("gate_config")), _jsonOptions) ?? new(),
            SortOrder = reader.GetInt32(reader.GetOrdinal("sort_order")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at"))
        };
    }

    public async Task<List<QualityGateDefinition>> GetByOrganizationAsync(Guid organizationId)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("SELECT * FROM quality_gate_definitions WHERE organization_id = @organizationId ORDER BY sort_order", conn);
        cmd.Parameters.AddWithValue("organizationId", organizationId);
        
        using var reader = await cmd.ExecuteReaderAsync();
        var list = new List<QualityGateDefinition>();
        while (await reader.ReadAsync())
        {
            list.Add(MapRow(reader));
        }
        return list;
    }

    public async Task<QualityGateDefinition> UpsertAsync(QualityGateDefinition definition)
    {
        if (definition.Id == Guid.Empty) definition.Id = Guid.NewGuid();
        if (definition.CreatedAt == default) definition.CreatedAt = DateTime.UtcNow;

        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand(@"
            INSERT INTO quality_gate_definitions (
                id, organization_id, gate_code, display_name, is_enabled, gate_config, sort_order, created_at
            ) VALUES (
                @id, @organization_id, @gate_code, @display_name, @is_enabled, @gate_config::jsonb, @sort_order, @created_at
            ) ON CONFLICT (organization_id, gate_code) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                is_enabled = EXCLUDED.is_enabled,
                gate_config = EXCLUDED.gate_config,
                sort_order = EXCLUDED.sort_order
            RETURNING *", conn);

        cmd.Parameters.AddWithValue("id", definition.Id);
        cmd.Parameters.AddWithValue("organization_id", definition.OrganizationId);
        cmd.Parameters.AddWithValue("gate_code", definition.GateCode);
        cmd.Parameters.AddWithValue("display_name", definition.DisplayName);
        cmd.Parameters.AddWithValue("is_enabled", definition.IsEnabled);
        cmd.Parameters.AddWithValue("gate_config", JsonSerializer.Serialize(definition.GateConfig, _jsonOptions));
        cmd.Parameters.AddWithValue("sort_order", definition.SortOrder);
        cmd.Parameters.AddWithValue("created_at", definition.CreatedAt);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return MapRow(reader);
        }
        throw new InvalidOperationException("Failed to upsert gate definition.");
    }

    public async Task ToggleAsync(Guid definitionId, bool isEnabled)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("UPDATE quality_gate_definitions SET is_enabled = @isEnabled WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", definitionId);
        cmd.Parameters.AddWithValue("isEnabled", isEnabled);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        using var conn = await _dataSource.OpenConnectionAsync();
        using var cmd = new NpgsqlCommand("DELETE FROM quality_gate_definitions WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
