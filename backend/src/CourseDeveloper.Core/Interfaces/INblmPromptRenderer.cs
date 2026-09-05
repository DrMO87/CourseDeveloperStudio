namespace CourseDeveloper.Core.Interfaces;

using System.Threading;
using System.Threading.Tasks;

// STEP 11 Phase B, Batch 3, option (a): shells out to nblm_prompt_template.py to render the
// NBLM prompt file's `$FIELD` placeholders with resolved job-snapshot facts. `templatePath`
// is the course's one immutable, shared template — never written to. `renderedPath` is a
// per-session output file: a session can be re-rendered any number of times (idempotent,
// see that script's doc comment) without ever touching the shared template another session
// still needs to render with different facts (fixed after Codex review — the original
// design rendered in place at `templatePath`, which meant substituting one session's
// duration destroyed the markers a later or different-duration session needed).
public sealed record NblmPromptRenderResult(string RenderedPath, string RenderedSha256, int TemplateVersion);

public interface INblmPromptRenderer
{
    Task<NblmPromptRenderResult> RenderAsync(
        string templatePath,
        string renderedPath,
        string durationMinutesText,
        string audienceDescriptor,
        string orgDisplayName,
        string brandingClause,
        CancellationToken ct);
}
