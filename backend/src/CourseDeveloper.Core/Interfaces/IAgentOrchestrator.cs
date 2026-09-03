namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;

public interface IAgentOrchestrator
{
    Task<string> ExecuteStageWorkflowAsync(Guid sessionId, PipelineStage stage, Action<AgentSwarmLog> onThoughtLogged);
    Task<string> RunCollaborativeDigestAsync(string receiptJson, string vaultContext);
    Task<string> RunBundleAssemblyAsync(string sessionCode, string digestJson, List<SessionAsset> assets);
}
