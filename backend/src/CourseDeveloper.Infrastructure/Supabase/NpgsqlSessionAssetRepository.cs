namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class NpgsqlSessionAssetRepository : ISessionAssetRepository
{
    private readonly IAuthenticatedConnectionFactory _connectionFactory;

    public NpgsqlSessionAssetRepository(IAuthenticatedConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<List<SessionAsset>> GetBySessionAsync(Guid sessionId)
    {
        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand("SELECT * FROM session_assets WHERE session_id = @sessionId");
        cmd.Parameters.AddWithValue("sessionId", sessionId);

        var list = new List<SessionAsset>();
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                list.Add(new SessionAsset
                {
                    Id = reader.GetGuid(reader.GetOrdinal("id")),
                    SessionId = reader.GetGuid(reader.GetOrdinal("session_id")),
                    AssetId = reader.GetString(reader.GetOrdinal("asset_id")),
                    DestinationSlide = reader.GetString(reader.GetOrdinal("destination_slide")),
                    AssetClass = Enum.Parse<AssetClass>(reader.GetString(reader.GetOrdinal("asset_class")), true),
                    FilePath = reader.GetString(reader.GetOrdinal("file_path")),
                    Sha256 = reader.IsDBNull(reader.GetOrdinal("sha256")) ? null : reader.GetString(reader.GetOrdinal("sha256")),
                    ProductionStatus = reader.GetString(reader.GetOrdinal("production_status")),
                    IsOverlaid = reader.GetBoolean(reader.GetOrdinal("is_overlaid")),
                    CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
                });
            }
        }
        await conn.CommitAsync();
        return list;
    }
}
