namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository _projectRepo;
    private readonly ISessionRepository _sessionRepo;

    public ProjectsController(IProjectRepository projectRepo, ISessionRepository sessionRepo)
    {
        _projectRepo = projectRepo;
        _sessionRepo = sessionRepo;
    }

    [HttpGet]
    public async Task<ActionResult<List<CourseProject>>> GetAll([FromQuery] Guid? organizationId)
    {
        var projects = await _projectRepo.GetAllAsync(organizationId);
        return Ok(projects);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CourseProject>> GetById(Guid id)
    {
        var proj = await _projectRepo.GetByIdAsync(id);
        if (proj == null) return NotFound();
        return Ok(proj);
    }

    [HttpPost]
    public async Task<ActionResult<CourseProject>> Create([FromBody] CourseProject project)
    {
        project.Id = Guid.NewGuid();
        project.CreatedAt = DateTime.UtcNow;
        var created = await _projectRepo.CreateAsync(project);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CourseProject>> Update(Guid id, [FromBody] CourseProject project)
    {
        if (id != project.Id) return BadRequest("ID mismatch");

        var existing = await _projectRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        var updated = await _projectRepo.UpdateAsync(project);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var existing = await _projectRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        await _projectRepo.DeleteAsync(id);
        return NoContent();
    }

    [HttpGet("{id:guid}/sessions")]
    public async Task<ActionResult<List<CourseSession>>> GetSessions(Guid id)
    {
        var sessions = await _sessionRepo.GetByProjectAsync(id);
        return Ok(sessions);
    }

    [HttpPost("{id:guid}/sessions")]
    public async Task<ActionResult<CourseSession>> CreateSession(Guid id, [FromBody] CourseSession session)
    {
        session.ProjectId = id;
        if (session.Id == Guid.Empty)
        {
            session.Id = Guid.NewGuid();
        }
        var created = await _sessionRepo.CreateAsync(session);
        return Ok(created);
    }
}
