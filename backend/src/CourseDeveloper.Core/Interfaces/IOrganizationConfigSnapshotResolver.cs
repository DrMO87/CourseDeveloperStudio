namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// STEP 12: the named resolver for GenerationJob -> CourseProject.OrganizationId ->
// Organization -> serialized org-config snapshot. Intended caller: whichever future
// enqueue/pre-execution path creates a GenerationJob (none exists yet — see STEP 8b) writes
// this resolver's result into GenerationJob.Payload once, before the job becomes immutable.
// Must fail closed (throw) rather than guess when identity/config is missing, ambiguous, or
// inconsistent — this is the Standing Rule 10a(ii) exception: a data-isolation safety guard,
// not a content-quality gate.
public interface IOrganizationConfigSnapshotResolver
{
    Task<OrganizationConfigSnapshot> ResolveAsync(Guid projectId, Guid sessionId, CancellationToken ct);
}
