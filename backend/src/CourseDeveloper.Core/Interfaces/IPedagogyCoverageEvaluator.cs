namespace CourseDeveloper.Core.Interfaces;

using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 3: pedagogy-coverage is Python-only (academy-brain's
// gates/pedagogy_coverage.py, never ported to a Studio C# IQualityGate) — this shells out
// to evaluate_pedagogy_coverage.py, which reuses generate_session.py's own
// `pedagogy_summary` so the result can never drift from the one already exported in every
// job's RESULT_JSON.
public interface IPedagogyCoverageEvaluator
{
    Task<PythonGateResult> EvaluateAsync(string sessionCode, string courseVaultRoot, CancellationToken ct);
}
