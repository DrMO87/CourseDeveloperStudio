namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

public class RunGatesRequest
{
    public Guid OrganizationId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid SessionId { get; set; }
    public PipelineStage Stage { get; set; }
    public string LearnerText { get; set; } = string.Empty;
    public List<SessionAsset> MappedAssets { get; set; } = new();
}

[ApiController]
[Route("api/[controller]")]
public class QualityGatesController : ControllerBase
{
    private readonly IQualityGateRunner _gateRunner;

    public QualityGatesController(IQualityGateRunner gateRunner)
    {
        _gateRunner = gateRunner;
    }

    [HttpPost("evaluate")]
    public async Task<ActionResult<List<QualityGateResult>>> EvaluateGates([FromBody] RunGatesRequest request, [FromQuery] Guid? organizationId)
    {
        var orgId = organizationId ?? request.OrganizationId;
        var receipt = await _gateRunner.EvaluateAsync(orgId, request.ProjectId, request.SessionId, request.Stage, request.LearnerText, request.MappedAssets);
        return Ok(receipt.GateResults);
    }

    [HttpPost("check-arabic")]
    public async Task<ActionResult<GateResult>> CheckArabic([FromBody] string text, [FromQuery] Guid organizationId) 
        => Ok(await _gateRunner.CheckArabicRatioAsync(organizationId, text));

    [HttpPost("check-boundary")]
    public async Task<ActionResult<GateResult>> CheckBoundary([FromBody] string text, [FromQuery] Guid organizationId) 
        => Ok(await _gateRunner.CheckBoundaryMarkersAsync(organizationId, text));

    [HttpPost("check-palette")]
    public async Task<ActionResult<GateResult>> CheckPalette([FromBody] string text, [FromQuery] Guid organizationId) 
        => Ok(await _gateRunner.CheckBrandPaletteAsync(organizationId, text));
}
