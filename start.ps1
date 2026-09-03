# Course Developer Studio - PowerShell Startup Script
$Host.UI.RawUI.WindowTitle = "Course Developer Studio Launcher"
Clear-Host

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "               COURSE DEVELOPER STUDIO - STARTUP LAUNCHER" -ForegroundColor Cyan
Write-Host "         Multi-Agent Curriculum Engineering & Supabase Platform" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$RootDir = $PSScriptRoot
$FrontendDir = Join-Path $RootDir "frontend"
$BackendDir = Join-Path $RootDir "backend\src\CourseDeveloper.Api"

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on your system PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Check .NET SDK (Optional)
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    Write-Host "[1/2] Launching Backend Web API on http://localhost:5000 ..." -ForegroundColor Green
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$BackendDir`" && dotnet run"
} else {
    Write-Host "[INFO] .NET SDK is not in PATH. Starting Frontend Studio..." -ForegroundColor Yellow
}

# 3. Start Frontend Next.js Dev Server
Write-Host "[2/2] Launching Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$FrontendDir`" && npm.cmd run dev"

# 4. Wait briefly and open browser
Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Launching Course Developer Studio in your default browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "               COURSE DEVELOPER STUDIO IS RUNNING!" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  * Studio Dashboard:      http://localhost:3000"
Write-Host "  * Institutions & Rules:  http://localhost:3000/organizations"
Write-Host "  * Curriculum Projects:   http://localhost:3000/projects"
Write-Host "  * Backend Swagger Docs:  http://localhost:5000/swagger"
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close this launcher window..."
