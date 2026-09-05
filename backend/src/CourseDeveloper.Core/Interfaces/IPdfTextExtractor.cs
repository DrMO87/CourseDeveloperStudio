namespace CourseDeveloper.Core.Interfaces;

using System.Threading;
using System.Threading.Tasks;

// STEP 11 Phase B, Batch 2: the one real bridge from a generated pass PDF
// (VAULT/80-generation/<sessionId>/<pass>.pdf) to gate-checkable text. No PDF library
// exists in this C# codebase; academy-brain's Python side already depends on PyMuPDF
// (fitz), so extraction happens there via a small sibling script rather than duplicating
// a second PDF text-extraction implementation in .NET.
public interface IPdfTextExtractor
{
    Task<string> ExtractTextAsync(string pdfPath, CancellationToken ct);
}
