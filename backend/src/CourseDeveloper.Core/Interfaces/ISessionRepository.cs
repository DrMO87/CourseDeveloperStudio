namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface ISessionRepository
{
    Task<List<CourseSession>> GetByProjectAsync(Guid projectId);
    Task<CourseSession?> GetByIdAsync(Guid id);
    Task<CourseSession> CreateAsync(CourseSession session);
    Task<CourseSession> UpdateAsync(CourseSession session);
    Task DeleteAsync(Guid id);
}
