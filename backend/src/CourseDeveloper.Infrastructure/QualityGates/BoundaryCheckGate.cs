namespace CourseDeveloper.Infrastructure.QualityGates;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 12: TRAINER_MARKERS/TRAINER_PATTERNS below mirror academy-brain's
// scripts/swarm/gates/boundary_check.py exactly — academy-wide student-facing-content
// hygiene (Brain OS, Academy_Language_and_Output_Rules.md), not an institute-specific
// brand rule. They are a mandatory baseline that always runs; Organization.BoundaryTerms.
// ForbiddenStrings are additive institute-specific terms unioned on top, never a
// replacement — an institute must not be able to silently erase the baseline leakage check
// by supplying an empty or partial override list. This also fixes the previous bug where an
// empty ForbiddenStrings list made this gate report UNVERIFIED instead of running the
// baseline check.
public class BoundaryCheckGate : IQualityGate
{
    private static readonly string[] TrainerMarkers =
    {
        "trainer note", "trainer script", "trainer question", "expected answer",
        "common mistakes", "classroom management", "assessment checklist",
        "minutes for this", "trainer timing", "session flow", "trainer flow",
        "debugging note", "reflection question", "exit ticket",
        "ملاحظة للمدرب", "إجابة متوقعة", "دليل المدرب",
    };

    // Trainer-guide session flow is stated as a clock-time timeline (00:00-00:10) — trainer-
    // only by function, no plain-word marker catches it. See boundary_check.py's comment for
    // why a video-timestamp false positive is not a real concern here.
    private static readonly Regex ClockTimeTimeline = new(
        @"\b(?:[01]?\d|2[0-3]):[0-5]\d\s*[-–—]\s*(?:[01]?\d|2[0-3]):[0-5]\d\b",
        RegexOptions.Compiled);

    public string Code => "boundary_check";

    public Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config)
        => Task.FromResult(Evaluate(context.LearnerText, context.Organization.BoundaryTerms));

    public GateResult Evaluate(string text, BoundaryTermsConfig boundaryTerms)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new GateResult("boundary_check", GateVerdict.UNVERIFIED, "no content to scan", new Dictionary<string, object>());
        }

        var lowered = text.ToLowerInvariant();
        var extraTerms = boundaryTerms?.ForbiddenStrings ?? new List<string>();
        var markers = TrainerMarkers.Concat(extraTerms);
        var detected = markers.Where(marker => lowered.Contains(marker.ToLowerInvariant())).ToList();

        if (ClockTimeTimeline.IsMatch(text))
        {
            detected.Add("clock-time timeline");
        }

        if (detected.Any())
        {
            var evidence = new Dictionary<string, object>
            {
                ["leaked_markers"] = detected,
                ["remedy"] = "Remove the listed lecturer-only markers from learner-facing content."
            };
            return new GateResult("boundary_check", GateVerdict.FAIL, $"{detected.Count} lecturer-only marker(s) leaked into student output", evidence);
        }

        return new GateResult("boundary_check", GateVerdict.PASS, "no lecturer-only content detected in student text", new Dictionary<string, object>());
    }
}

