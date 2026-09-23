Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  NotebookLM Google Authentication Helper   " -ForegroundColor Cyan
Write-Host "  (Edge InPrivate + CDP Session Capture)    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ─── Resolve nlm.exe ───
$candidates = @(
    "$PSScriptRoot\.venv\Scripts\nlm.exe",
    "D:\HUE\DEVELOPED SOFTWARE\CourseDeveloperStudio\.venv\Scripts\nlm.exe",
    "D:\HUE\DEVELOPED SOFTWARE\Course Developer\.venv\Scripts\nlm.exe"
)

$nlmExe = $null
foreach ($c in $candidates) {
    if (Test-Path $c) {
        $nlmExe = $c
        break
    }
}

if (-not $nlmExe) {
    $cmd = Get-Command nlm -ErrorAction SilentlyContinue
    if ($cmd) { $nlmExe = $cmd.Source }
}

if (-not $nlmExe) {
    Write-Host "ERROR: nlm.exe could not be found in .venv or PATH." -ForegroundColor Red
    Pause
    exit 1
}

Write-Host "Using NotebookLM CLI: $nlmExe" -ForegroundColor Gray

# ─── Resolve Microsoft Edge ───
$edgeExe = $null
$edgeCandidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
foreach ($e in $edgeCandidates) {
    if (Test-Path $e) {
        $edgeExe = $e
        break
    }
}

if (-not $edgeExe) {
    Write-Host "ERROR: Microsoft Edge not found. Please install Edge." -ForegroundColor Red
    Pause
    exit 1
}

Write-Host "Using Edge: $edgeExe" -ForegroundColor Gray

# ─── Clean stale lockfiles ───
Write-Host "Cleaning stale browser lockfiles..." -ForegroundColor Gray

$profileDir = "$env:USERPROFILE\.notebooklm-mcp-cli\chrome-profiles\default"
Remove-Item -Path "$profileDir\lockfile" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$profileDir\SingletonLock" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.notebooklm-mcp-cli\chrome-port-map.json" -Force -ErrorAction SilentlyContinue

# ─── Configuration ───
$cdpPort = 18800
$edgeProfileDir = Join-Path $PSScriptRoot ".nlm-edge-profile"

# ─── Step 1: Launch Edge InPrivate with CDP ───
Write-Host ""
Write-Host "Step 1: Launching Edge InPrivate with Google Sign-In..." -ForegroundColor Green
Write-Host ""

$edgeArgs = @(
    "--new-window",
    "--user-data-dir=$edgeProfileDir",
    "--remote-debugging-port=$cdpPort",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fnotebooklm.google.com"
)

$edgeProcess = Start-Process -FilePath $edgeExe -ArgumentList $edgeArgs -PassThru

Write-Host "Edge InPrivate is open (PID: $($edgeProcess.Id), CDP port: $cdpPort)" -ForegroundColor Cyan
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  INSTRUCTIONS:                             " -ForegroundColor Yellow
Write-Host "  1. Sign in with your Google account       " -ForegroundColor Yellow
Write-Host "  2. Wait until you see the NotebookLM page " -ForegroundColor Yellow
Write-Host "  3. Come back here and press ENTER          " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press ENTER after completing Google sign-in in Edge"

# ─── Step 2: Capture session via CDP ───
Write-Host ""
Write-Host "Step 2: Capturing session credentials from Edge..." -ForegroundColor Green
Write-Host ""

try {
    & $nlmExe login --provider openclaw --cdp-url "http://127.0.0.1:$cdpPort" --force
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host "  Session captured successfully!             " -ForegroundColor Green
    Write-Host "  Return to Studio and click 'Verify Auth'  " -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to capture session: $_" -ForegroundColor Red
    Write-Host "Make sure you completed Google sign-in in the Edge window." -ForegroundColor Yellow
}

# ─── Step 3: Cleanup ───
Write-Host ""
Write-Host "Closing Edge InPrivate window..." -ForegroundColor Gray
try {
    Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
} catch {}

Write-Host ""
Pause
