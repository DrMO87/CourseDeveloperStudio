namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 1's honest placeholder for gate reevaluation. Deliberately
// throws rather than returning an empty "all clear" violation list: a reevaluator that
// silently claimed no violations exist would let the cascade report false success before
// any real gate-input evidence extraction (per-pass PDF text/page evidence, rendered
// style evidence, etc. — Batch 2/3 scope) exists. Fail loudly, never fake a PASS.
public sealed class NotYetImplementedContentQualityGateReevaluator : IContentQualityGateReevaluator
{
    public Task<List<ContentQualityViolation>> ReevaluateAsync(
        GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
        => throw new NotSupportedException(
            "Content-quality gate reevaluation is not wired yet. Batch 2/3 must supply a real " +
            "IContentQualityGateReevaluator backed by actual gate-input evidence extraction " +
            "(docs/tickets/handoffs/step11-nblm-prompt-authoring.md, 'The new integration point') " +
            "before the repair cascade can run against real generated content.");
}
