namespace CourseDeveloper.Infrastructure.Supabase;

using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using Npgsql;

// STEP 11: lets CourseDeveloper.Worker reuse GateRunnerService and its repositories
// (NpgsqlOrganizationRepository, NpgsqlGateDefinitionRepository,
// NpgsqlQualityReceiptRepository), which all depend on IAuthenticatedConnectionFactory.
// Unlike CourseDeveloper.Api's AuthenticatedConnectionFactory, the worker has no
// per-request JWT to project via SET LOCAL ROLE authenticated — it already connects
// using its own narrowly-scoped `generation_worker` Postgres role (see
// GENERATION_WORKER_CONNECTION_STRING in Program.cs and the generation_worker grants in
// database/schema.sql), so no per-user identity switch is needed or possible here.
public sealed class WorkerConnectionFactory : IAuthenticatedConnectionFactory
{
    private readonly NpgsqlDataSource _dataSource;

    public WorkerConnectionFactory(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<AuthenticatedConnection> OpenAsync()
    {
        var connection = await _dataSource.OpenConnectionAsync();
        NpgsqlTransaction? transaction = null;
        try
        {
            transaction = await connection.BeginTransactionAsync();
            return new AuthenticatedConnection(connection, transaction);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
            await connection.DisposeAsync();
            throw;
        }
    }
}
