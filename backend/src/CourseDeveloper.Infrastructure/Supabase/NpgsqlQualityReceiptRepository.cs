namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class NpgsqlQualityReceiptRepository : IQualityReceiptRepository
{
    private readonly IAuthenticatedConnectionFactory _connectionFactory;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NpgsqlQualityReceiptRepository(IAuthenticatedConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<QualityReceipt> CreateAsync(QualityReceipt receipt)
    {
        receipt.Id = receipt.Id == Guid.Empty ? Guid.NewGuid() : receipt.Id;
        receipt.CreatedAt = receipt.CreatedAt == default ? DateTime.UtcNow : receipt.CreatedAt;

        await using var conn = await _connectionFactory.OpenAsync();
        using var cmd = conn.CreateCommand(@"
            INSERT INTO quality_receipts (
                id, project_id, session_id, stage_name, overall_verdict, detailed_receipt, created_at
            ) VALUES (
                @id, @project_id, @session_id, @stage_name::pipeline_stage, @overall_verdict::gate_verdict, @detailed_receipt::jsonb, @created_at
            )");

        cmd.Parameters.AddWithValue("id", receipt.Id);
        cmd.Parameters.AddWithValue("project_id", receipt.ProjectId);
        cmd.Parameters.AddWithValue("session_id", receipt.SessionId);
        cmd.Parameters.AddWithValue("stage_name", receipt.StageName.ToString());
        cmd.Parameters.AddWithValue("overall_verdict", receipt.OverallVerdict.ToString());
        cmd.Parameters.AddWithValue("detailed_receipt", JsonSerializer.Serialize(receipt.DetailedReceipt, _jsonOptions));
        cmd.Parameters.AddWithValue("created_at", receipt.CreatedAt);

        await cmd.ExecuteNonQueryAsync();

        foreach (var result in receipt.GateResults)
        {
            result.Id = result.Id == Guid.Empty ? Guid.NewGuid() : result.Id;
            result.ReceiptId = receipt.Id;
            result.CreatedAt = result.CreatedAt == default ? DateTime.UtcNow : result.CreatedAt;

            using var resCmd = conn.CreateCommand(@"
                INSERT INTO quality_gate_results (
                    id, receipt_id, gate_code, verdict, metric_value, detail, evidence, created_at
                ) VALUES (
                    @id, @receipt_id, @gate_code, @verdict::gate_verdict, @metric_value, @detail, @evidence::jsonb, @created_at
                )");

                resCmd.Parameters.AddWithValue("id", result.Id);
                resCmd.Parameters.AddWithValue("receipt_id", result.ReceiptId);
                resCmd.Parameters.AddWithValue("gate_code", result.GateCode);
                resCmd.Parameters.AddWithValue("verdict", result.Verdict.ToString());
                resCmd.Parameters.AddWithValue("metric_value", result.MetricValue ?? (object)DBNull.Value);
                resCmd.Parameters.AddWithValue("detail", result.Detail ?? (object)DBNull.Value);
                resCmd.Parameters.AddWithValue("evidence", JsonSerializer.Serialize(result.Evidence, _jsonOptions));
                resCmd.Parameters.AddWithValue("created_at", result.CreatedAt);

            await resCmd.ExecuteNonQueryAsync();
        }

        await conn.CommitAsync();
        return receipt;
    }

    public async Task<List<QualityReceipt>> GetBySessionAsync(Guid sessionId)
    {
        await using var conn = await _connectionFactory.OpenAsync();

        using var cmd = conn.CreateCommand(@"
            SELECT r.*, g.id as gid, g.gate_code, g.verdict, g.metric_value, g.detail, g.evidence, g.created_at as g_created_at
            FROM quality_receipts r
            LEFT JOIN quality_gate_results g ON r.id = g.receipt_id
            WHERE r.session_id = @sessionId
            ORDER BY r.created_at DESC");

        cmd.Parameters.AddWithValue("sessionId", sessionId);

        var receipts = new Dictionary<Guid, QualityReceipt>();

        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var receiptId = reader.GetGuid(reader.GetOrdinal("id"));
                if (!receipts.TryGetValue(receiptId, out var receipt))
                {
                    receipt = new QualityReceipt
                    {
                        Id = receiptId,
                        ProjectId = reader.GetGuid(reader.GetOrdinal("project_id")),
                        SessionId = reader.GetGuid(reader.GetOrdinal("session_id")),
                        StageName = Enum.Parse<PipelineStage>(reader.GetString(reader.GetOrdinal("stage_name")), true),
                        OverallVerdict = Enum.Parse<GateVerdict>(reader.GetString(reader.GetOrdinal("overall_verdict")), true),
                        DetailedReceipt = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("detailed_receipt")), _jsonOptions) ?? new(),
                        CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at"))
                    };
                    receipts[receiptId] = receipt;
                }

                if (!reader.IsDBNull(reader.GetOrdinal("gid")))
                {
                    receipt.GateResults.Add(new QualityGateResult
                    {
                        Id = reader.GetGuid(reader.GetOrdinal("gid")),
                        ReceiptId = receiptId,
                        GateCode = reader.GetString(reader.GetOrdinal("gate_code")),
                        Verdict = Enum.Parse<GateVerdict>(reader.GetString(reader.GetOrdinal("verdict")), true),
                        MetricValue = reader.IsDBNull(reader.GetOrdinal("metric_value")) ? null : reader.GetDecimal(reader.GetOrdinal("metric_value")),
                        Detail = reader.IsDBNull(reader.GetOrdinal("detail")) ? null : reader.GetString(reader.GetOrdinal("detail")),
                        Evidence = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(reader.GetOrdinal("evidence")), _jsonOptions) ?? new(),
                        CreatedAt = reader.GetDateTime(reader.GetOrdinal("g_created_at"))
                    });
                }
            }
        }

        await conn.CommitAsync();
        return new List<QualityReceipt>(receipts.Values);
    }
}
