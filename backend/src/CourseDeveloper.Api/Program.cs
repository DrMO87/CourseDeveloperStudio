using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Infrastructure.Agents;
using CourseDeveloper.Infrastructure.Obsidian;
using CourseDeveloper.Infrastructure.QualityGates;
using CourseDeveloper.Infrastructure.Supabase;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DI Configuration
builder.Services.AddSingleton<IObsidianVaultService, ObsidianVaultService>();
builder.Services.AddSingleton<IAgentOrchestrator, AgentOrchestrator>();
builder.Services.AddSingleton<IQualityGateRunner, GateRunnerService>();

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

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
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

app.UseCors("AllowAll");

if (string.Equals(Environment.GetEnvironmentVariable("ENABLE_HTTPS_REDIRECTION"), "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseHttpsRedirection();
}

app.UseAuthorization();
app.MapControllers();

app.Run();
