namespace CourseDeveloper.Core.Models;

using System.Collections.Generic;

// STEP 11 Phase B, Batch 3: the shape every academy-brain `gates.GateResult` is adapted
// into once it crosses the subprocess boundary (pedagogy-coverage, nblm-prompt-preflight —
// both Python-only, never ported to a Studio C# IQualityGate). Verdict is the gate's own
// string ("PASS" | "FAIL" | "UNVERIFIED"), not re-typed as GateVerdict here, so a caller
// decides how to react without this model guessing.
public sealed record PythonGateResult(string Gate, string Verdict, string Detail, Dictionary<string, object> Evidence);
