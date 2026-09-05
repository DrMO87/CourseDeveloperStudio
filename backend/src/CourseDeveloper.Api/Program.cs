using CourseDeveloper.Api.Auth;
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
// STEP 7: the frontend's existing types (Organization, CourseSession, etc.) use the
// snake_case field names Supabase's Postgres-column-derived REST API always used —
// matching the API's JSON to that convention means zero changes to the frontend's
// existing type definitions instead of a parallel camelCase-to-snake_case mapping layer.
// Every enum here (PipelineStage, GateVerdict, ApprovalKind, InstitutionType) already has
// members spelled exactly as the frontend/Postgres expect them (STEP 7 renamed
// InstitutionType to match) — the default JsonStringEnumConverter (no naming policy of its
// own) serializes/parses the literal member name, so "BRAND_SETUP" and "academy" both
// round-trip correctly without a second, conflicting naming policy for enum values.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
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
// ---------------------------------------------------------------------------
// Environment variable reference (see backend/.env.example for full fallback details):
//   API:
//     SUPABASE_CONNECTION_STRING — required for database access; should use studio_api
//     SUPABASE_URL               — required for valid Supabase JWT authority metadata
//     CORS_ALLOWED_ORIGINS       — optional comma-separated origin allow-list
//     ENABLE_SWAGGER             — optional; false disables Swagger outside Development
//     ENABLE_HTTPS_REDIRECTION   — optional; true enables HTTPS redirection
//   Worker (CourseDeveloper.Worker):
//     GENERATION_WORKER_CONNECTION_STRING — full Npgsql string as generation_worker role (required, no fallback)
//     ACADEMY_BRAIN_SCRIPT_PATH            — required main generation script path; no fallback
//     ACADEMY_BRAIN_PEDAGOGY_SCRIPT_PATH  — required pedagogy evaluator path; no fallback
//     ACADEMY_BRAIN_PDF_TEXT_SCRIPT_PATH  — required PDF text extractor path; no fallback
//     ACADEMY_BRAIN_PDF_COLOR_SCRIPT_PATH — required PDF color extractor path; no fallback
//     ACADEMY_BRAIN_NBLM_RENDER_SCRIPT_PATH — required prompt renderer path; no fallback
//     ACADEMY_BRAIN_NBLM_PREFLIGHT_SCRIPT_PATH — required prompt evaluator path; no fallback
//     GENERATION_WORKER_PYTHON_EXECUTABLE — optional; defaults to python
//     GENERATION_WORKER_POLL_INTERVAL_SECONDS / GENERATION_WORKER_LEASE_SECONDS — optional; default to 2 / 30
//     SUPABASE_PROJECT_URL + SUPABASE_SERVICE_ROLE_KEY — optional pair; both are needed for Storage uploads
//     GENERATION_ARTIFACT_BUCKET          — optional; defaults to course-artifacts
//     STUDIO_COMMIT_SHA                   — optional; defaults to unknown
//     GENERATION_WORKER_STUB_DURATION_SECONDS — optional; only used by the unregistered stub executor
//   Shared:
//     VAULT_ROOT — optional; falls back to Obsidian:VaultPath, then an application-relative vault
// ---------------------------------------------------------------------------
var supabaseConnectionString = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING") 
    ?? builder.Configuration.GetConnectionString("SupabaseDb")
    ?? "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=PLACEHOLDER-SET-SUPABASE_CONNECTION_STRING;";

builder.Services.AddSingleton(_ =>
{
    var dataSourceBuilder = new NpgsqlDataSourceBuilder(supabaseConnectionString);
    return dataSourceBuilder.Build();
});

// RLS/auth-context (STEP 2 blocker #3, folded into STEP 4): every repository operation
// runs inside a transaction that sets the session's identity from the validated JWT
// (SET LOCAL ROLE authenticated + request.jwt.claims), so Supabase's auth.uid()-keyed
// RLS policies see the real caller instead of one fixed connection-string role.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IRequestIdentity, HttpContextRequestIdentity>();
builder.Services.AddScoped<IAuthenticatedConnectionFactory, AuthenticatedConnectionFactory>();

// Register Repositories
builder.Services.AddScoped<IOrganizationRepository, NpgsqlOrganizationRepository>();
builder.Services.AddScoped<IProjectRepository, NpgsqlProjectRepository>();
builder.Services.AddScoped<ISessionRepository, NpgsqlSessionRepository>();
builder.Services.AddScoped<IGateDefinitionRepository, NpgsqlGateDefinitionRepository>();
builder.Services.AddScoped<IDossierRepository, NpgsqlDossierRepository>();
builder.Services.AddScoped<IQualityReceiptRepository, NpgsqlQualityReceiptRepository>();

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
    ?? "https://PLACEHOLDER-SET-SUPABASE_URL.supabase.co";
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
