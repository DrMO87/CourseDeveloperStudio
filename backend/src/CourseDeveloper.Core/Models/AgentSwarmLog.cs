namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;
using CourseDeveloper.Core.Enums;

public class AgentSwarmLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid? SessionId { get; set; }
    public PipelineStage StageName { get; set; }
    public string AgentRole { get; set; } = string.Empty; // e.g. "CURRICULUM_DECONSTRUCTOR"
    public string AgentThoughts { get; set; } = string.Empty;
    public List<string> ToolInvocations { get; set; } = new();
    public string? InputPayload { get; set; }
    public string? OutputData { get; set; }
    public int TokensConsumed { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
