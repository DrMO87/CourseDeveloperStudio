namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

// STEP 11 Phase B, Batch 2: no read path to session_assets existed at all before this —
// GateContext.MappedAssets was always supplied by whichever caller already had the list in
// hand (the frontend, for QualityGatesController's HTTP endpoint). The worker's content-quality
// reevaluator needs to fetch the current registered assets for a session on its own. Read-only
// on purpose: database/schema.sql's generation_worker grant on session_assets is select-only,
// and no adapter in this batch registers or mutates an asset row.
public interface ISessionAssetRepository
{
    Task<List<SessionAsset>> GetBySessionAsync(Guid sessionId);
}
