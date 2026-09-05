namespace CourseDeveloper.Core.Interfaces;

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

// STEP 11 Phase B, Batch 2 slice 3: brand_palette's handoff row explicitly rejects scanning
// generated-PDF text for literal hex-code mentions — "existing gates scan hex strings in
// supplied text and do not inspect rendered PDF color objects" (step11-nblm-prompt-authoring.md,
// Part 2). This is the real bridge to actual rendered vector-drawing fill/stroke colors
// (VAULT/80-generation/<sessionId>/<pass>.pdf), distinct from IPdfTextExtractor's prose text.
public interface IPdfColorExtractor
{
    Task<List<string>> ExtractColorsAsync(string pdfPath, CancellationToken ct);
}
