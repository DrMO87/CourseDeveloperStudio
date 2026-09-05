namespace CourseDeveloper.Core.Models;

using System;

// Standing Rule 10a's "rescheduled automatically with backoff," with the concrete
// initial values from docs/tickets/handoffs/step11-nblm-prompt-authoring.md's numbers
// table: 5 -> 15 -> 60 minutes, then a 6-hour plateau until a real result succeeds or the
// platform owner resolves/cancels the job. These are explicit initial operating policy,
// not evidence-derived constants (the handoff itself flags them for telemetry review).
public static class ContentQualityBackoffSchedule
{
    private static readonly TimeSpan[] Steps =
    {
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(60),
    };

    private static readonly TimeSpan Plateau = TimeSpan.FromHours(6);

    // cycle is 1-based (the first reschedule is cycle 1).
    public static TimeSpan DelayForCycle(int cycle)
    {
        var index = (cycle < 1 ? 1 : cycle) - 1;
        return index < Steps.Length ? Steps[index] : Plateau;
    }
}
