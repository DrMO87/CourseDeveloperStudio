namespace CourseDeveloper.Api.Controllers;

using System;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

// STEP 7: creation stays on ProjectsController ("POST /api/Projects/{id}/sessions", STEP 4)
// — this controller only adds the by-id read/update/delete ISessionRepository already
// supported but nothing exposed, which the frontend needs to stop faking those in
// localStorage.
[ApiController]
[Route("api/[controller]")]
public class SessionsController : ControllerBase
{
    private readonly ISessionRepository _sessionRepo;

    public SessionsController(ISessionRepository sessionRepo)
    {
        _sessionRepo = sessionRepo;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CourseSession>> GetById(Guid id)
    {
        var session = await _sessionRepo.GetByIdAsync(id);
        if (session == null) return NotFound();
        return Ok(session);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CourseSession>> Update(Guid id, [FromBody] CourseSession session)
    {
        if (id != session.Id) return BadRequest("ID mismatch");

        var existing = await _sessionRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        var updated = await _sessionRepo.UpdateAsync(session);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var existing = await _sessionRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        await _sessionRepo.DeleteAsync(id);
        return NoContent();
    }
}
