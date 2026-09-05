namespace CourseDeveloper.Core.Interfaces;

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 3, option (b): shells out to evaluate_nblm_prompt_preflight.py,
// which runs the new academy-brain `nblm-prompt-preflight` registry gate against the
// fully-resolved prompt file text plus the resolved facts this interface's caller already
// knows (never invented here) — see that gate's doc comment for the six checks.
public interface INblmPromptPreflightEvaluator
{
    Task<PythonGateResult> EvaluateAsync(
        string promptPath,
        string? expectedDurationText,
        string? expectedAudienceText,
        string? expectedBrandingText,
        IReadOnlyList<string> forbiddenStrings,
        CancellationToken ct);
}
