using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Infrastructure.Agents;
using CourseDeveloper.Infrastructure.Obsidian;
using CourseDeveloper.Infrastructure.QualityGates;
using CourseDeveloper.Infrastructure.Supabase;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DI Configuration
// AgentOrchestrator and GateRunnerService depend on scoped repositories (see below),
// so they must be Scoped too — a Singleton capturing a Scoped dependency pins the
// first-resolved repository instance for the app's lifetime (captive dependency bug).
builder.Services.AddSingleton<IObsidianVaultService, ObsidianVaultService>();
builder.Services.AddScoped<IAgentOrchestrator, AgentOrchestrator>();
builder.Services.AddScoped<IQualityGateRunner, GateRunnerService>();

// Gate implementations are stateless and have no scoped dependencies.
builder.Services.AddSingleton<IQualityGate, LanguageRatioGate>();
builder.Services.AddSingleton<IQualityGate, BoundaryCheckGate>();
builder.Services.AddSingleton<IQualityGate, BrandPaletteGate>();
builder.Services.AddSingleton<IQualityGate, AssetReconciliationGate>();

// Supabase PostgreSQL via Npgsql
var supabaseConnectionString = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING") 
    ?? builder.Configuration.GetConnectionString("SupabaseDb")
    ?? "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;";

builder.Services.AddSingleton(_ =>
{
    var dataSourceBuilder = new NpgsqlDataSourceBuilder(supabaseConnectionString);
    return dataSourceBuilder.Build();
});

// Register Repositories
builder.Services.AddScoped<IOrganizationRepository, NpgsqlOrganizationRepository>();
builder.Services.AddScoped<IProjectRepository, NpgsqlProjectRepository>();
builder.Services.AddScoped<ISessionRepository, NpgsqlSessionRepository>();
builder.Services.AddScoped<IGateDefinitionRepository, NpgsqlGateDefinitionRepository>();
builder.Services.AddScoped<IDossierRepository, NpgsqlDossierRepository>();

// CORS — explicit origin allow-list only, never AllowAnyOrigin (decision 5)
var corsAllowedOrigins = (Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS")
        ?? builder.Configuration["Cors:AllowedOrigins"]
        ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("StudioFrontend", policy =>
    {
        policy.WithOrigins(corsAllowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Authentication — validates JWTs issued by the same Supabase project the
// frontend and MVP already authenticate against (one identity boundary, decision 6).
var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")
    ?? builder.Configuration["Supabase:ProjectUrl"]
    ?? "https://gjxhfyfonjdcaimxjipp.supabase.co";
var supabaseIssuer = $"{supabaseUrl.TrimEnd('/')}/auth/v1";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // This project publishes an OIDC discovery document and rotating asymmetric
        // signing keys, so JwtBearer must resolve keys from its authority metadata.
        options.Authority = supabaseIssuer;
        options.Audience = "authenticated";
        options.TokenValidationParameters.ValidIssuer = supabaseIssuer;
        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateLifetime = true;
        options.TokenValidationParameters.ValidateIssuerSigningKey = true;
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    });

builder.Services.AddAuthorization(options =>
{
    // Every controller requires an authenticated caller by default; none are public yet.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

var app = builder.Build();

var enableSwagger = app.Environment.IsDevelopment() || 
                     string.Equals(Environment.GetEnvironmentVariable("ENABLE_SWAGGER"), "true", StringComparison.OrdinalIgnoreCase) ||
                     app.Configuration.GetValue<bool>("ENABLE_SWAGGER", true);

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("StudioFrontend");

if (string.Equals(Environment.GetEnvironmentVariable("ENABLE_HTTPS_REDIRECTION"), "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
