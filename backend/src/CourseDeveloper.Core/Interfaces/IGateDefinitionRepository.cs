namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IGateDefinitionRepository
{
    Task<List<QualityGateDefinition>> GetByOrganizationAsync(Guid organizationId);
    Task<QualityGateDefinition> UpsertAsync(QualityGateDefinition definition);
    Task ToggleAsync(Guid definitionId, bool isEnabled);
    Task DeleteAsync(Guid id);
}
