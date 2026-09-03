namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ObsidianSyncController : ControllerBase
{
    private readonly IObsidianVaultService _obsidianService;
    private readonly IProjectRepository _projectRepo;

    public ObsidianSyncController(IObsidianVaultService obsidianService, IProjectRepository projectRepo)
    {
        _obsidianService = obsidianService;
        _projectRepo = projectRepo;
    }

    [HttpGet("para-files")]
    public async Task<ActionResult<List<string>>> GetParaFiles([FromQuery] string category = "01_Projects")
    {
        var files = await _obsidianService.ListParaCategoryFilesAsync(category);
        return Ok(files);
    }

    [HttpGet("read-note")]
    public async Task<ActionResult<string>> ReadNote([FromQuery] string path)
    {
        try
        {
            var content = await _obsidianService.ReadNoteAsync(path);
            return Ok(content);
        }
        catch (Exception ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("sync-session")]
    public async Task<ActionResult<ObsidianSyncRecord>> SyncSession([FromBody] CourseSession session)
    {
        var project = await _projectRepo.GetByIdAsync(session.ProjectId);
        if (project == null) return NotFound("Project not found.");

        var projectName = !string.IsNullOrEmpty(project.ObsidianVaultProjectPath) 
            ? project.ObsidianVaultProjectPath.Split('/').Last()
            : project.Slug;

        var record = await _obsidianService.SyncSessionToVaultAsync(session, projectName);
        return Ok(record);
    }
}
