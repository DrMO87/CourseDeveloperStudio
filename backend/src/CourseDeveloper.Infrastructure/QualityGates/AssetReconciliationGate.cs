namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class AssetReconciliationGate : IQualityGate
{
    private static readonly string DefaultCitationPattern = @"\*\*Asset:\*\*\s*`([^`]+)`";

    public string Code => "asset_reconciliation";

    public Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config)
        => Task.FromResult(Evaluate(context.LearnerText, context.MappedAssets, context.Organization.AssetCitationPattern));

    public GateResult Evaluate(string slideMarkdown, List<SessionAsset> mappedAssets, string? citationPattern = null)
    {
        if (string.IsNullOrWhiteSpace(slideMarkdown))
        {
            return new GateResult("asset_reconciliation", GateVerdict.UNVERIFIED, "no slide markdown to scan", new Dictionary<string, object>());
        }

        string patternToUse = string.IsNullOrWhiteSpace(citationPattern) ? DefaultCitationPattern : citationPattern;
        var regex = new Regex(patternToUse, RegexOptions.Compiled);

        var referencedAssetIds = regex.Matches(slideMarkdown)
            .Select(m => m.Groups[1].Value.Trim())
            .Distinct()
            .ToList();

        var resolvedMap = mappedAssets.ToDictionary(a => a.AssetId, StringComparer.OrdinalIgnoreCase);
        var missingOrUnresolved = new List<string>();

        foreach (var refId in referencedAssetIds)
        {
            if (!resolvedMap.TryGetValue(refId, out var asset) && !resolvedMap.Any(kv => kv.Value.FilePath.Contains(refId)))
            {
                missingOrUnresolved.Add(refId);
            }
        }

        var evidence = new Dictionary<string, object>
        {
            ["referenced_count"] = referencedAssetIds.Count,
            ["mapped_count"] = mappedAssets.Count,
            ["dangling_references"] = missingOrUnresolved
        };

        if (missingOrUnresolved.Any())
        {
            evidence["remedy"] = "Map each dangling asset reference to a registered asset or remove the reference.";
            return new GateResult("asset_reconciliation", GateVerdict.FAIL, $"Dangling asset reference(s) found in slides: {string.Join(", ", missingOrUnresolved)}", evidence);
        }

        return new GateResult("asset_reconciliation", GateVerdict.PASS, "all slide asset citations map to registered assets", evidence);
    }
}
