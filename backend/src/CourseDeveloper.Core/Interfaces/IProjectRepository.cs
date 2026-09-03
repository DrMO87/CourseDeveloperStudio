namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IProjectRepository
{
    Task<List<CourseProject>> GetAllAsync(Guid? organizationId = null);
    Task<CourseProject?> GetByIdAsync(Guid id);
    Task<CourseProject> CreateAsync(CourseProject project);
    Task<CourseProject> UpdateAsync(CourseProject project);
    Task DeleteAsync(Guid id);
}
