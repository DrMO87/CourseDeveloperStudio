using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Infrastructure.Supabase;
using CourseDeveloper.Worker;
using Npgsql;

var builder = Host.CreateApplicationBuilder(args);

// Connects as the narrowly-scoped generation_worker Postgres role (see database/schema.sql),
// not the studio_api role CourseDeveloper.Api uses — the worker has no per-request JWT to
// propagate, so it gets table-level grants on generation_job/generation_job_event instead
// of going through SET LOCAL ROLE authenticated.
var workerConnectionString = Environment.GetEnvironmentVariable("GENERATION_WORKER_CONNECTION_STRING")
    ?? Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING")
    ?? builder.Configuration.GetConnectionString("SupabaseDb")
    ?? "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;";

builder.Services.AddSingleton(_ =>
{
    var dataSourceBuilder = new NpgsqlDataSourceBuilder(workerConnectionString);
    return dataSourceBuilder.Build();
});

builder.Services.AddSingleton<IGenerationJobRepository, NpgsqlGenerationJobRepository>();
builder.Services.AddSingleton<IGenerationJobExecutor, StubGenerationJobExecutor>();
builder.Services.AddHostedService<GenerationJobPollingService>();

var host = builder.Build();
host.Run();
