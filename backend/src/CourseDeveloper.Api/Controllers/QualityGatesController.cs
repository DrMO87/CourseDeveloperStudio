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
        try
        {
            var receipt = await _gateRunner.EvaluateAsync(orgId, request.ProjectId, request.SessionId, request.Stage, request.LearnerText, request.MappedAssets);
            return Ok(receipt.GateResults);
        }
        catch (QualityGateConfigurationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Quality gate configuration error");
        }
    }
}
