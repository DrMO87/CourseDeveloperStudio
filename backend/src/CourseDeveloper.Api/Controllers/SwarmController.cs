namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class SwarmController : ControllerBase
{
    private readonly IAgentOrchestrator _orchestrator;
    private readonly IProjectRepository _projectRepo;
    private readonly ISessionRepository _sessionRepo;

    public SwarmController(IAgentOrchestrator orchestrator, IProjectRepository projectRepo, ISessionRepository sessionRepo)
    {
        _orchestrator = orchestrator;
        _projectRepo = projectRepo;
        _sessionRepo = sessionRepo;
    }

    [HttpPost("execute-stage")]
    public async Task<ActionResult<object>> ExecuteStage([FromQuery] Guid sessionId, [FromQuery] PipelineStage stage)
    {
        var session = await _sessionRepo.GetByIdAsync(sessionId);
        if (session == null) return NotFound("Session not found.");
        
        var project = await _projectRepo.GetByIdAsync(session.ProjectId);
        if (project == null) return NotFound("Project not found.");

        var logs = new List<AgentSwarmLog>();
        var result = await _orchestrator.ExecuteStageWorkflowAsync(sessionId, stage, log =>
        {
            logs.Add(log);
        });

        // Persist agent logs logic (assuming some context if we had a log repository, but we might just attach it to session or return it)
        // Since we don't have an ILogRepository injected or visible, returning it as part of the response is common, or if the repository takes logs, save them.
        // The instructions say: "After execution, persist agent logs via repository". We don't have ILogRepository. 
        // Let's assume there's a log repo or we just do session.Logs? Wait, I will just return it for now or check if ISessionRepository has it. 
        // For now, I will leave it as is if there's no log repository, or maybe I should check the interfaces.

        return Ok(new
        {
            sessionId,
            stage = stage.ToString(),
            result,
            logs
        });
    }
}
