namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ObsidianSyncController : ControllerBase
{
    private readonly IObsidianVaultService _obsidianService;
    private readonly IProjectRepository _projectRepo;
    private readonly IOrganizationRepository _orgRepo;

    public ObsidianSyncController(IObsidianVaultService obsidianService, IProjectRepository projectRepo, IOrganizationRepository orgRepo)
    {
        _obsidianService = obsidianService;
        _projectRepo = projectRepo;
        _orgRepo = orgRepo;
    }

    [HttpGet("para-files")]
    public async Task<ActionResult<List<string>>> GetParaFiles([FromQuery] string category = "01_Projects")
    {
        try
        {
            var files = await _obsidianService.ListParaCategoryFilesAsync(category);
            return Ok(files);
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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

        var org = project.OrganizationId.HasValue ? await _orgRepo.GetByIdAsync(project.OrganizationId.Value) : null;
        if (org == null) return NotFound("Organization not found for this project.");

        var record = await _obsidianService.SyncSessionToVaultAsync(session, project, org);
        return Ok(record);
    }

    [HttpPost("sync-dossier-file")]
    public async Task<ActionResult<ObsidianSyncRecord>> SyncDossierFile([FromBody] ProjectDossierFile file)
    {
        var project = await _projectRepo.GetByIdAsync(file.ProjectId);
        if (project == null) return NotFound("Project not found.");

        var org = project.OrganizationId.HasValue ? await _orgRepo.GetByIdAsync(project.OrganizationId.Value) : null;
        if (org == null) return NotFound("Organization not found for this project.");

        var record = await _obsidianService.SyncDossierFileAsync(file, project, org);
        return Ok(record);
    }

    [HttpPost("sync-org-logo")]
    public async Task<ActionResult> SyncOrgLogo([FromForm] string organizationSlug, [FromForm] IFormFile file)
    {
        var org = await _orgRepo.GetBySlugAsync(organizationSlug);
        if (org == null) return NotFound("Organization not found.");

        var projects = await _projectRepo.GetAllAsync(org.Id);
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        var synced = await _obsidianService.SyncOrgLogoAsync(org, projects, file.FileName, stream.ToArray());
        return Ok(new { synced });
    }

    public class SyncNlmDownloadsRequest
    {
        public Guid ProjectId { get; set; }
        public string NotebookIdentifier { get; set; } = string.Empty;
    }

    [HttpPost("sync-nlm-downloads")]
    public async Task<ActionResult<ObsidianSyncRecord>> SyncNlmDownloads([FromBody] SyncNlmDownloadsRequest request)
    {
        var project = await _projectRepo.GetByIdAsync(request.ProjectId);
        if (project == null) return NotFound("Project not found.");

        var org = project.OrganizationId.HasValue ? await _orgRepo.GetByIdAsync(project.OrganizationId.Value) : null;
        if (org == null) return NotFound("Organization not found for this project.");

        try
        {
            var record = await _obsidianService.SyncNlmDownloadsAsync(project, org, request.NotebookIdentifier);
            return Ok(record);
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
