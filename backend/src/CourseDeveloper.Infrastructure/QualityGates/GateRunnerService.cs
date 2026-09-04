namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class GateRunnerService : IQualityGateRunner
{
    private readonly IGateDefinitionRepository _gateRepo;
    private readonly IOrganizationRepository _orgRepo;
    private readonly IQualityReceiptRepository _receiptRepo;

    private readonly Dictionary<string, IQualityGate> _registry;

    public GateRunnerService(
        IGateDefinitionRepository gateRepo,
        IOrganizationRepository orgRepo,
        IQualityReceiptRepository receiptRepo,
        IEnumerable<IQualityGate> gates)
    {
        _gateRepo = gateRepo;
        _orgRepo = orgRepo;
        _receiptRepo = receiptRepo;
        _registry = gates.ToDictionary(g => g.Code, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<QualityReceipt> EvaluateAsync(Guid organizationId, Guid projectId, Guid sessionId, PipelineStage stage, string learnerText, List<SessionAsset> mappedAssets)
    {
        var org = await _orgRepo.GetByIdAsync(organizationId);
        if (org == null) throw new InvalidOperationException("Organization not found.");

        var gateDefs = await _gateRepo.GetByOrganizationAsync(organizationId);
        var enabledGates = gateDefs.Where(g => g.IsEnabled).ToList();

        var context = new GateContext(org, learnerText, mappedAssets);
        var detailed = new Dictionary<string, object>();

        var receipt = new QualityReceipt
        {
            ProjectId = projectId,
            SessionId = sessionId,
            StageName = stage,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var gateDef in enabledGates)
        {
            if (!_registry.TryGetValue(gateDef.GateCode, out var gate))
            {
                throw new QualityGateConfigurationException(
                    $"Quality gate '{gateDef.GateCode}' is enabled for organization {organizationId} but no IQualityGate implementation is registered for that code.");
            }

            var result = await gate.EvaluateAsync(context, gateDef.GateConfig);
            AddPolicyMetadata(result, gateDef.GateConfig);
            detailed[gateDef.GateCode] = result;

            receipt.GateResults.Add(new QualityGateResult
            {
                Id = Guid.NewGuid(),
                ReceiptId = receipt.Id,
                GateCode = gateDef.GateCode,
                Verdict = result.Verdict,
                MetricValue = result.MetricValue,
                Detail = result.Detail,
                Evidence = result.Evidence,
                CreatedAt = DateTime.UtcNow
            });
        }

        var consequentialResults = receipt.GateResults
            .Where(gateResult => ReadEvidenceString(gateResult.Evidence, "severity") != "advisory")
            .ToList();
        receipt.OverallVerdict = GateVerdict.PASS;
        if (consequentialResults.Any(gateResult => gateResult.Verdict == GateVerdict.FAIL)) receipt.OverallVerdict = GateVerdict.FAIL;
        else if (consequentialResults.Any(gateResult => gateResult.Verdict == GateVerdict.UNVERIFIED)) receipt.OverallVerdict = GateVerdict.UNVERIFIED;

        receipt.DetailedReceipt = detailed;

        // STEP 7: this receipt used to be discarded after the HTTP response — nothing ever
        // called NpgsqlQualityReceiptRepository.CreateAsync, so a session's quality history
        // couldn't survive a page refresh. Persisting here is what lets the frontend fetch a
        // session's real past receipts instead of re-deriving fake ones client-side.
        return await _receiptRepo.CreateAsync(receipt);
    }

    private static void AddPolicyMetadata(GateResult gateResult, Dictionary<string, object> config)
    {
        var severity = ReadConfigString(config, "severity") ?? "blocking";
        if (severity is not ("advisory" or "approvalRequired" or "blocking"))
        {
            throw new QualityGateConfigurationException(
                $"Quality gate '{gateResult.GateName}' has unsupported severity '{severity}'.");
        }

        gateResult.Evidence["severity"] = severity;
        if (severity == "blocking" && gateResult.Verdict == GateVerdict.FAIL)
        {
            gateResult.Evidence["reason"] = gateResult.Detail;
            gateResult.Evidence["remedy"] = ReadConfigString(config, "remedy")
                ?? ReadEvidenceString(gateResult.Evidence, "remedy")
                ?? throw new QualityGateConfigurationException(
                    $"Blocking quality gate '{gateResult.GateName}' did not provide a remedy.");
        }
    }

    private static string? ReadConfigString(Dictionary<string, object> config, string key)
    {
        if (!config.TryGetValue(key, out var configuredValue)) return null;

        return configuredValue switch
        {
            string text => text,
            JsonElement { ValueKind: JsonValueKind.String } json => json.GetString(),
            _ => throw new QualityGateConfigurationException(
                $"Quality gate config value '{key}' must be a string.")
        };
    }

    private static string? ReadEvidenceString(Dictionary<string, object> evidence, string key)
    {
        if (!evidence.TryGetValue(key, out var evidenceValue)) return null;

        return evidenceValue switch
        {
            string text => text,
            JsonElement { ValueKind: JsonValueKind.String } json => json.GetString(),
            _ => null
        };
    }
}
