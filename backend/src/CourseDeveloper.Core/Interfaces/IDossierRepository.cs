namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IDossierRepository
{
    Task<List<ProjectDossierFile>> GetByProjectAsync(Guid projectId);
    Task<ProjectDossierFile?> GetByIdAsync(Guid id);
    Task<ProjectDossierFile> CreateAsync(ProjectDossierFile file);
    Task<ProjectDossierFile> UpdateAsync(ProjectDossierFile file);
    Task DeleteAsync(Guid id);
}
