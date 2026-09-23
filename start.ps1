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

# Prepend local .NET SDK to PATH if present
$dotnetLocal = Join-Path $env:LocalAppData "Microsoft\dotnet"
if (Test-Path (Join-Path $dotnetLocal "dotnet.exe")) {
    $env:PATH = "$dotnetLocal;$env:PATH"
}

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on your system PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Check Backend (Already running, .NET SDK, or Docker)
$backendRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://localhost:5000/swagger/index.html" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "[1/2] Backend API is already active and healthy on http://localhost:5000 [OK]" -ForegroundColor Green
    }
} catch {}

if (-not $backendRunning) {
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        Write-Host "[1/2] Launching Backend Web API on http://localhost:5000 ..." -ForegroundColor Green
        Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$BackendDir`" && dotnet run"
    } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "[1/2] Starting Backend API in Docker container on http://localhost:5000 ..." -ForegroundColor Green
        Start-Process docker -ArgumentList "compose", "up", "-d", "backend" -NoNewWindow
    } else {
        Write-Host "[INFO] .NET SDK is not in PATH. Starting Frontend Studio..." -ForegroundColor Yellow
    }
}

# 3. Check Frontend (Already running or start dev server)
$frontendRunning = $false
try {
    $fRes = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($fRes.StatusCode -eq 200) {
        $frontendRunning = $true
        Write-Host "[2/2] Frontend Studio is already running on http://localhost:3000 [OK]" -ForegroundColor Green
    }
} catch {}

if (-not $frontendRunning) {
    Write-Host "[2/2] Launching Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Green
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$FrontendDir`" && npm.cmd run dev"
}

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
