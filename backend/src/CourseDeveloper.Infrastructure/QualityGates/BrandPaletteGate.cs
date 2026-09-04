namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class BrandPaletteGate : IQualityGate
{
    private static readonly Regex HexRegex = new(@"#[0-9A-Fa-f]{6}", RegexOptions.Compiled);

    public string Code => "brand_palette";

    public Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config)
        => Task.FromResult(Evaluate(context.LearnerText, context.Organization.BrandPalette));

    public GateResult Evaluate(string text, BrandPalette palette)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new GateResult("brand_palette", GateVerdict.UNVERIFIED, "no text to scan", new Dictionary<string, object>());
        }

        var matches = HexRegex.Matches(text).Select(m => m.Value.ToUpperInvariant()).Distinct().ToList();
        if (!matches.Any())
        {
            return new GateResult("brand_palette", GateVerdict.UNVERIFIED, "no hex color codes found", new Dictionary<string, object>());
        }

        var retiredSet = new HashSet<string>(palette.Retired, StringComparer.OrdinalIgnoreCase);
        var foundRetired = matches.Where(c => retiredSet.Contains(c)).ToList();
        var evidence = new Dictionary<string, object>
        {
            ["found_colors"] = matches,
            ["retired_colors"] = foundRetired
        };

        if (foundRetired.Any())
        {
            evidence["remedy"] = "Replace the listed retired colors with colors from the approved brand palette.";
            return new GateResult("brand_palette", GateVerdict.FAIL, $"Retired placeholder color(s) present: {string.Join(", ", foundRetired)}", evidence);
        }

        return new GateResult("brand_palette", GateVerdict.PASS, "all colors comply with brand palette", evidence);
    }
}
