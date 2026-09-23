$p = Start-Process -FilePath "docker.exe" -ArgumentList "ps" -NoNewWindow -PassThru
if ($p.WaitForExit(4000)) {
    Write-Host "Docker responded quickly! Exit code: $($p.ExitCode)"
} else {
    $p.Kill()
    Write-Host "Docker CLI timed out after 4 seconds."
}
