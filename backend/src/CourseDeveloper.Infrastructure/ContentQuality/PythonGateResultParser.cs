namespace CourseDeveloper.Infrastructure.ContentQuality;

using System.Collections.Generic;
using System.Text.Json;
using CourseDeveloper.Core.Models;

// Shared by every Batch 3 Python-registry-gate adapter: both evaluate_pedagogy_coverage.py
// and evaluate_nblm_prompt_preflight.py print the same {"gate","verdict","detail","evidence"}
// JSON shape academy-brain's gates.GateResult always carries.
internal static class PythonGateResultParser
{
    public static PythonGateResult Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var gate = root.GetProperty("gate").GetString()!;
        var verdict = root.GetProperty("verdict").GetString()!;
        var detail = root.TryGetProperty("detail", out var d) ? d.GetString() ?? string.Empty : string.Empty;
        var evidence = root.TryGetProperty("evidence", out var e) && e.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Deserialize<Dictionary<string, object>>(e.GetRawText())!
            : new Dictionary<string, object>();
        return new PythonGateResult(gate, verdict, detail, evidence);
    }
}
