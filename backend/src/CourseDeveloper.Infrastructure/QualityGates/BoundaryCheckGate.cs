namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

public class BoundaryCheckGate
{
    public GateResult Evaluate(string text, BoundaryTermsConfig boundaryTerms)
    {
        if (boundaryTerms == null || boundaryTerms.ForbiddenStrings == null || !boundaryTerms.ForbiddenStrings.Any())
        {
            return new GateResult("boundary_check", GateVerdict.UNVERIFIED, "No boundary terms configured", new Dictionary<string, object>());
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return new GateResult("boundary_check", GateVerdict.UNVERIFIED, "no content to scan", new Dictionary<string, object>());
        }

        var lowered = text.ToLowerInvariant();
        var detected = boundaryTerms.ForbiddenStrings.Where(marker => lowered.Contains(marker.ToLowerInvariant())).ToList();

        if (detected.Any())
        {
            var evidence = new Dictionary<string, object>
            {
                ["leaked_markers"] = detected
            };
            return new GateResult("boundary_check", GateVerdict.FAIL, $"{detected.Count} lecturer-only marker(s) leaked into student output", evidence);
        }

        return new GateResult("boundary_check", GateVerdict.PASS, "no lecturer-only content detected in student text", new Dictionary<string, object>());
    }
}

