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
    private readonly IAuthenticatedConnectionFactory _connectionFactory;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlGateDefinitionRepository(IAuthenticatedConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
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
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("SELECT * FROM quality_gate_definitions WHERE organization_id = @organizationId ORDER BY sort_order");
        cmd.Parameters.AddWithValue("organizationId", organizationId);

        var list = new List<QualityGateDefinition>();
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

    public async Task<QualityGateDefinition> UpsertAsync(QualityGateDefinition definition)
    {
        if (definition.Id == Guid.Empty) definition.Id = Guid.NewGuid();
        if (definition.CreatedAt == default) definition.CreatedAt = DateTime.UtcNow;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            INSERT INTO quality_gate_definitions (
                id, organization_id, gate_code, display_name, is_enabled, gate_config, sort_order, created_at
            ) VALUES (
                @id, @organization_id, @gate_code, @display_name, @is_enabled, @gate_config::jsonb, @sort_order, @created_at
            ) ON CONFLICT (organization_id, gate_code) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                is_enabled = EXCLUDED.is_enabled,
                gate_config = EXCLUDED.gate_config,
                sort_order = EXCLUDED.sort_order
            RETURNING *");

        cmd.Parameters.AddWithValue("id", definition.Id);
        cmd.Parameters.AddWithValue("organization_id", definition.OrganizationId);
        cmd.Parameters.AddWithValue("gate_code", definition.GateCode);
        cmd.Parameters.AddWithValue("display_name", definition.DisplayName);
        cmd.Parameters.AddWithValue("is_enabled", definition.IsEnabled);
        cmd.Parameters.AddWithValue("gate_config", JsonSerializer.Serialize(definition.GateConfig, _jsonOptions));
        cmd.Parameters.AddWithValue("sort_order", definition.SortOrder);
        cmd.Parameters.AddWithValue("created_at", definition.CreatedAt);

        QualityGateDefinition result;
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Failed to upsert gate definition.");
            }
            result = MapRow(reader);
        }
        await conn.CommitAsync();
        return result;
    }

    public async Task ToggleAsync(Guid definitionId, bool isEnabled)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("UPDATE quality_gate_definitions SET is_enabled = @isEnabled WHERE id = @id");
        cmd.Parameters.AddWithValue("id", definitionId);
        cmd.Parameters.AddWithValue("isEnabled", isEnabled);
        await cmd.ExecuteNonQueryAsync();
        await conn.CommitAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("DELETE FROM quality_gate_definitions WHERE id = @id");
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
        await conn.CommitAsync();
    }
}
