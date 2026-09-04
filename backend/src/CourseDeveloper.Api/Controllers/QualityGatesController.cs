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
    private readonly IQualityReceiptRepository _receiptRepo;

    public QualityGatesController(IQualityGateRunner gateRunner, IQualityReceiptRepository receiptRepo)
    {
        _gateRunner = gateRunner;
        _receiptRepo = receiptRepo;
    }

    [HttpGet("session/{sessionId:guid}")]
    public async Task<ActionResult<List<QualityReceipt>>> GetReceiptsForSession(Guid sessionId)
    {
        var receipts = await _receiptRepo.GetBySessionAsync(sessionId);
        return Ok(receipts);
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
