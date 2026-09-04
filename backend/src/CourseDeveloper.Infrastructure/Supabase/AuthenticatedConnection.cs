namespace CourseDeveloper.Infrastructure.Supabase;

using System;
using System.Text.Json;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using Npgsql;

// Wraps one Postgres connection + transaction that has had its session identity set
// (SET LOCAL ROLE authenticated + request.jwt.claims) so RLS policies keyed on
// auth.uid() evaluate correctly for this unit of work. Disposing without calling
// CommitAsync() rolls back (NpgsqlTransaction's default Dispose behavior) — callers
// must not treat "no exception" as "committed".
public sealed class AuthenticatedConnection : IAsyncDisposable
{
    private readonly NpgsqlConnection _connection;
    private readonly NpgsqlTransaction _transaction;
    private bool _committed;

    internal AuthenticatedConnection(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public NpgsqlCommand CreateCommand(string sql)
    {
        var cmd = _connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.Transaction = _transaction;
        return cmd;
    }

    public async Task CommitAsync()
    {
        await _transaction.CommitAsync();
        _committed = true;
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (!_committed)
            {
                await _transaction.RollbackAsync();
            }
        }
        finally
        {
            await _transaction.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }
}

public interface IAuthenticatedConnectionFactory
{
    Task<AuthenticatedConnection> OpenAsync();
}

// The Postgres role backing SUPABASE_CONNECTION_STRING must itself be a narrowly
// privileged "authenticator"-style role that is only allowed to SET ROLE authenticated —
// never service_role or another BYPASSRLS role — per STEP 2's handoff. That grant lives
// in the database, not here; this factory only sets the transaction-local identity.
public sealed class AuthenticatedConnectionFactory : IAuthenticatedConnectionFactory
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly IRequestIdentity _identity;

    public AuthenticatedConnectionFactory(NpgsqlDataSource dataSource, IRequestIdentity identity)
    {
        _dataSource = dataSource;
        _identity = identity;
    }

    public async Task<AuthenticatedConnection> OpenAsync()
    {
        var userId = _identity.UserId
            ?? throw new InvalidOperationException(
                "No authenticated user identity available for this database operation. " +
                "Refusing to open a connection with an unscoped role rather than silently bypassing RLS.");

        var connection = await _dataSource.OpenConnectionAsync();
        NpgsqlTransaction? transaction = null;
        try
        {
            transaction = await connection.BeginTransactionAsync();
            await using (var setRole = new NpgsqlCommand("SET LOCAL ROLE authenticated;", connection, transaction))
            {
                await setRole.ExecuteNonQueryAsync();
            }

            var claims = JsonSerializer.Serialize(new { sub = userId, role = "authenticated" });
            await using (var setClaims = new NpgsqlCommand("SELECT set_config('request.jwt.claims', $1, true);", connection, transaction))
            {
                setClaims.Parameters.AddWithValue(claims);
                await setClaims.ExecuteNonQueryAsync();
            }

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
