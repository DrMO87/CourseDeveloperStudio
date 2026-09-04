---
status: pending
---

# STEP 3 handoff — generic quality gate registry

## What changed

### 1. New `IQualityGate` contract (`backend/src/CourseDeveloper.Core/Interfaces/IQualityGate.cs`, new file)

```csharp
public record GateContext(Organization Organization, string LearnerText, List<SessionAsset> MappedAssets);

public interface IQualityGate
{
    string Code { get; }
    Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config);
}
```

`GateContext` carries whatever any gate might need (the org's config sub-objects, the learner text, the mapped assets) instead of each gate declaring its own bespoke parameter list. `config` is `QualityGateDefinition.GateConfig` — the per-org, per-gate JSON blob that already existed in the database model but was loaded and never passed anywhere. It now reaches every gate's `EvaluateAsync` and supplies receipt policy metadata (`severity`, plus an optional remedy override).

### 2. The 4 existing gates ported to `IQualityGate`

`LanguageRatioGate`, `BoundaryCheckGate`, `BrandPaletteGate`, `AssetReconciliationGate` each gained a `Code` property and an `EvaluateAsync(GateContext, config)` method that forwards to their existing `Evaluate(...)` method. The original `Evaluate` signatures remain available, so the pre-existing standalone gate tests continue to call them directly without changes.

### 3. `GateRunnerService` — switch statement replaced with a dictionary-backed registry

Before: a hardcoded `switch (gateDef.GateCode)` over 4 string literals, `new LanguageRatioGate()` etc. constructed inline, unknown gate codes silently produced no result (the `if (result != null)` guard).

After: `GateRunnerService` takes `IEnumerable<IQualityGate> gates` via DI and builds `Dictionary<string, IQualityGate> _registry` keyed by `Code`. Adding a 5th or 6th gate (academy-brain's citation-filtering or pedagogy-coverage, per the ticket's constraint that the registry must support 6 gate kinds, not 4) means registering one more `IQualityGate` implementation in `Program.cs` — no change to `GateRunnerService` itself.

**Unknown gate code now fails loudly:** if an enabled `QualityGateDefinition.GateCode` has no matching registry entry, `EvaluateAsync` throws `QualityGateConfigurationException` (a dedicated `InvalidOperationException` subtype) naming the missing code and organization. `QualityGatesController` catches that specific configuration exception and returns an HTTP 500 Problem Details response whose title is `Quality gate configuration error` and whose detail names the missing code. The API no longer depends on environment-specific default exception rendering to make the failure visible.

The four gate-specific methods were removed from `IQualityGateRunner`, and the three gate-specific controller routes (`check-arabic`, `check-boundary`, `check-palette`) were removed. `POST /api/QualityGates/evaluate` is the generic enabled-gates execution endpoint.

### 4. The `QualityReceipt` bug fixed

**Before:** `EvaluateAsync` wrote to `receipt.ArabicRatioVerdict`, `receipt.ArabicRatioValue`, `receipt.BoundaryCheckVerdict`, `receipt.BrandPaletteVerdict`, `receipt.AssetGateVerdict` — none of which exist on the `QualityReceipt` model (only `Id`, `ProjectId`, `SessionId`, `StageName`, `OverallVerdict`, `GateResults`, `DetailedReceipt`, `CreatedAt` do). This did not compile; the backend could not have been building on this path before STEP 3.

**After:** each gate's result is converted into a `QualityGateResult` (the model `GateResults` is actually typed as) and appended to `receipt.GateResults`:

```csharp
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
```

`QualityGatesController.EvaluateGates` returns `receipt.GateResults` directly, so this is the exact list the API responds with. `GateResult` now has an optional `MetricValue`; `LanguageRatioGate` supplies its measured ratio and the runner preserves it in `QualityGateResult.MetricValue` instead of discarding the numeric measurement.

**Before/after `GateResults` output sample** (abridged to the relevant fields; 4 gates enabled, one Arabic-heavy learner text with a leaked lecturer marker). The API currently uses ASP.NET Core's default numeric enum serialization, so `PASS = 0`, `FAIL = 1`, and `UNVERIFIED = 2`:

Before: `[]` — always, regardless of what ran, because nothing ever populated `GateResults`.

After:
```json
[
  {
    "gateCode": "language_ratio",
    "verdict": 0,
    "metricValue": 0.78,
    "detail": "Primary script ratio 78% within tolerance [60%-80%]",
    "evidence": { "primary_ratio": 0.78, "primary_count": 120, "secondary_count": 34, "severity": "blocking" }
  },
  {
    "gateCode": "boundary_check",
    "verdict": 1,
    "detail": "1 lecturer-only marker(s) leaked into student output",
    "evidence": { "leaked_markers": ["[INSTRUCTOR NOTE]"], "severity": "blocking", "reason": "1 lecturer-only marker(s) leaked into student output", "remedy": "Remove the listed lecturer-only markers from learner-facing content." }
  },
  {
    "gateCode": "brand_palette",
    "verdict": 2,
    "detail": "no hex color codes found",
    "evidence": { "severity": "blocking" }
  },
  {
    "gateCode": "asset_reconciliation",
    "verdict": 0,
    "detail": "all slide asset citations map to registered assets",
    "evidence": { "referenced_count": 2, "mapped_count": 2, "dangling_references": [], "severity": "blocking" }
  }
]
```

### 5. DI registration (`Program.cs`)

```csharp
builder.Services.AddSingleton<IQualityGate, LanguageRatioGate>();
builder.Services.AddSingleton<IQualityGate, BoundaryCheckGate>();
builder.Services.AddSingleton<IQualityGate, BrandPaletteGate>();
builder.Services.AddSingleton<IQualityGate, AssetReconciliationGate>();
```

Singleton is safe here — none of the 4 gate classes has mutable instance state or a constructor dependency (no scoped repository and no captive-dependency risk like the one STEP 1 fixed for `AgentOrchestrator`/`GateRunnerService`). The earlier concrete-plus-factory registration pattern also produced shared instances correctly, but became unnecessary once the gate-specific runner methods and concrete injections were removed.

### 6. Severity and blocking guidance

Every receipt result includes `evidence.severity`, read from `GateConfig.severity`; existing definitions with empty config default to `blocking`. Supported values are exactly `advisory`, `approvalRequired`, and `blocking`. Invalid value types or names fail with `QualityGateConfigurationException`. A failed blocking result also includes a human-readable `reason` and a concrete gate-owned `remedy`; `GateConfig.remedy` can override that text without changing the gate implementation. Advisory failures remain visible in `GateResults` but do not change `OverallVerdict`, so they cannot block advancement. This uses the existing JSON config/evidence fields, so `QualityGateDefinition` and the database schema remain unchanged.

## Incidental fix (outside STEP 3's scope, but blocking verification)

`backend/src/CourseDeveloper.Api/Controllers/DossierController.cs:82` had `return NoContent;` (missing parentheses) — a pre-existing typo from STEP 1's commit (`339dbc6`), unrelated to quality gates. It failed the whole-solution `dotnet build` with `CS0428`, which meant STEP 3's own exit criterion (`dotnet test` passes) could not be checked at all. Fixed to `return NoContent();` — one line, no behavior change beyond making the method actually return a response instead of failing to compile. Flagging this here rather than silently folding it into STEP 3's diff.

## Constraints check

- **6 gate kinds, not 4:** satisfied structurally — the registry is `Dictionary<string, IQualityGate>` built from whatever is DI-registered; adding citation-filtering or pedagogy-coverage later is a new class plus one interface registration in `Program.cs`, with no change to `GateRunnerService`, `IQualityGateRunner`, or the controller. Their actual gate *logic* is not implemented here (scope lock).
- **Unknown gate code fails loudly:** `QualityGateConfigurationException` thrown, not swallowed, and mapped to a visible Problem Details 500 response.
- **`GateConfig` reaches `EvaluateAsync`:** it's a required parameter on the interface; `GateRunnerService` passes `gateDef.GateConfig` on every call.
- **Internal severity:** every result carries one of the three permitted severities; blocking failures carry reason and remedy strings.

## Scope lock check

- Did not implement citation-filtering or pedagogy-coverage gate logic — only the registry/dispatch mechanism and the 4 existing gates ported to the new interface.
- Did not change `QualityGateDefinition`'s database shape.

## Exit criteria check

- `dotnet test` passes on the gate test suite. ✅ (`Passed! - Failed: 0, Passed: 11, Skipped: 0, Total: 11`)
- With all 4 existing gates enabled, `GateRunnerServiceTests.EnabledGatesPopulateReceiptWithMatchingReceiptIdsAndPolicyMetadata` proves that the returned receipt contains four results, every `ReceiptId` equals the parent receipt ID, all four registered codes appear, and severity/reason/remedy metadata is present as required. ✅
- `GateRunnerServiceTests.UnknownEnabledGateThrowsVisibleConfigurationError` proves an enabled unknown code throws the dedicated configuration exception. Code inspection confirms the controller maps that exact exception to a visible Problem Details 500 response; this response mapping was not exercised through a live HTTP host. ✅
- `GateRunnerServiceTests.GateCodesAreMatchedWithoutCaseSensitivity` proves configured code casing does not affect registry dispatch. ✅
- `GateRunnerServiceTests.AdvisoryFailureDoesNotBlockTheOverallReceipt` proves an advisory failure remains reported without making the overall receipt fail. ✅
