namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class LanguageRatioGate : IQualityGate
{
    public string Code => "language_ratio";

    public Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config)
        => Task.FromResult(Evaluate(context.LearnerText, context.Organization.LanguagePolicy));

    private bool IsScript(char ch, string script)
    {
        int code = ch;
        return script.ToLowerInvariant() switch
        {
            "arabic" => (code >= 0x0600 && code <= 0x06FF) ||
                        (code >= 0x0750 && code <= 0x077F) ||
                        (code >= 0xFB50 && code <= 0xFDFF) ||
                        (code >= 0xFE70 && code <= 0xFEFF),
            "latin" => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'),
            "cyrillic" => (code >= 0x0400 && code <= 0x04FF),
            "cjk" => (code >= 0x4E00 && code <= 0x9FFF),
            "devanagari" => (code >= 0x0900 && code <= 0x097F),
            _ => false
        };
    }

    public GateResult Evaluate(string text, LanguagePolicy policy)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new GateResult("language_ratio", GateVerdict.UNVERIFIED, "no text content to measure", new Dictionary<string, object>());
        }

        int primary = 0;
        int secondary = 0;

        foreach (char ch in text)
        {
            if (IsScript(ch, policy.PrimaryScript)) primary++;
            else if (IsScript(ch, policy.SecondaryScript)) secondary++;
        }

        int total = primary + secondary;
        if (total == 0)
        {
            return new GateResult("language_ratio", GateVerdict.UNVERIFIED, "no valid script characters found", new Dictionary<string, object>());
        }

        double ratio = (double)primary / total;
        var evidence = new Dictionary<string, object>
        {
            ["primary_ratio"] = Math.Round(ratio, 3),
            ["primary_count"] = primary,
            ["secondary_count"] = secondary
        };

        if (Math.Abs(ratio - policy.TargetRatio) <= policy.Tolerance)
        {
            return new GateResult("language_ratio", GateVerdict.PASS, $"Primary script ratio {ratio:P0} within tolerance [{policy.TargetRatio - policy.Tolerance:P0}-{policy.TargetRatio + policy.Tolerance:P0}]", evidence, Convert.ToDecimal(Math.Round(ratio, 4)));
        }

        string direction = ratio < policy.TargetRatio ? $"too little {policy.PrimaryScript}" : $"too little {policy.SecondaryScript}";
        evidence["remedy"] = $"Adjust the {policy.PrimaryScript}/{policy.SecondaryScript} script balance to the configured target range.";
        return new GateResult("language_ratio", GateVerdict.FAIL, $"Primary script ratio {ratio:P0} outside target {policy.TargetRatio:P0} ({direction})", evidence, Convert.ToDecimal(Math.Round(ratio, 4)));
    }
}
