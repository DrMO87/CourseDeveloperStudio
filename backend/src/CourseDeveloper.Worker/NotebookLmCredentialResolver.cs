namespace CourseDeveloper.Worker;

using System.Threading;
using System.Threading.Tasks;
using Npgsql;

// STEP 6: resolves a job's notebooklm_account_key to that account's NotebookLM auth JSON —
// the value the notebooklm-py client accepts via its own NOTEBOOKLM_AUTH_JSON env var (see
// notebooklm.cli.services.auth_source in the notebooklm-py package). Resolved at the moment
// the worker is about to run a live job, not baked into the job payload at enqueue time —
// that is what lets a credential rotate (a new secret written to Supabase Vault) without a
// worker redeploy and without re-enqueuing jobs already in flight.
public interface INotebookLmCredentialResolver
{
    Task<string?> ResolveAsync(string accountKey, CancellationToken cancellationToken);
}

// Backed by Postgres/Supabase Vault (public.notebooklm_auth_json(text), see
// database/schema.sql) rather than a new secret-manager vendor — Studio's existing
// infrastructure is already Supabase, and Vault's pgsodium-encrypted secrets table lives in
// the same Postgres instance the worker already connects to for the job queue.
public sealed class NotebookLmCredentialResolver : INotebookLmCredentialResolver
{
    private readonly NpgsqlDataSource _dataSource;

    public NotebookLmCredentialResolver(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<string?> ResolveAsync(string accountKey, CancellationToken cancellationToken)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand("select public.notebooklm_auth_json(@accountKey)", conn);
        cmd.Parameters.AddWithValue("accountKey", accountKey);
        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return result is null or System.DBNull ? null : (string)result;
    }
}
