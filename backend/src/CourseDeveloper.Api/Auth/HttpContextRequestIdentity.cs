namespace CourseDeveloper.Api.Auth;

using System.Security.Claims;
using CourseDeveloper.Core.Interfaces;
using Microsoft.AspNetCore.Http;

public sealed class HttpContextRequestIdentity : IRequestIdentity
{
    private readonly IHttpContextAccessor _accessor;

    public HttpContextRequestIdentity(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    // Supabase-issued JWTs carry the user id in the standard "sub" claim; JwtBearer
    // also surfaces it as ClaimTypes.NameIdentifier depending on the mapped claim type.
    public string? UserId =>
        _accessor.HttpContext?.User?.FindFirst("sub")?.Value
        ?? _accessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
}
