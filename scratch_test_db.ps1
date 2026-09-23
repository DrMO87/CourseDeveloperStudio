try {
    Add-Type -Path "backend\src\CourseDeveloper.Worker\bin\Debug\net9.0\Npgsql.dll"
    $connStr = "Host=aws-0-eu-central-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.gjxhfyfonjdcaimxjipp;Password=BEV4LIGStoNRFHHo;SSL Mode=Require;Trust Server Certificate=true;Timeout=10;"
    $conn = New-Object Npgsql.NpgsqlConnection($connStr)
    Write-Host "Connecting..."
    $conn.Open()
    Write-Host "Connected! Server version: $($conn.ServerVersion)"
    
    $tx = $conn.BeginTransaction()
    $cmd1 = $conn.CreateCommand()
    $cmd1.Transaction = $tx
    $cmd1.CommandText = "SET LOCAL ROLE authenticated;"
    $cmd1.ExecuteNonQuery()
    Write-Host "SET LOCAL ROLE authenticated succeeded!"
    
    $cmd2 = $conn.CreateCommand()
    $cmd2.Transaction = $tx
    $cmd2.CommandText = "SELECT count(*) FROM course_projects;"
    $cnt = $cmd2.ExecuteScalar()
    Write-Host "course_projects count: $cnt"
    
    $conn.Close()
} catch {
    Write-Host "ERROR TYPE: $($_.Exception.GetType().FullName)"
    Write-Host "ERROR MESSAGE: $($_.Exception.Message)"
    if ($_.Exception.InnerException) {
        Write-Host "INNER ERROR: $($_.Exception.InnerException.Message)"
    }
}
