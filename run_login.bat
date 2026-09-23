@echo off
title NotebookLM Google Authentication Helper (Edge InPrivate)
cls
echo ========================================================
echo   NotebookLM Google Sign-In (Edge InPrivate + CDP)
echo ========================================================
echo.

:: ─── Resolve nlm.exe ───
set "NLM_EXE="
if exist "%~dp0.venv\Scripts\nlm.exe" (
    set "NLM_EXE=%~dp0.venv\Scripts\nlm.exe"
) else if exist "D:\HUE\DEVELOPED SOFTWARE\CourseDeveloperStudio\.venv\Scripts\nlm.exe" (
    set "NLM_EXE=D:\HUE\DEVELOPED SOFTWARE\CourseDeveloperStudio\.venv\Scripts\nlm.exe"
) else if exist "D:\HUE\DEVELOPED SOFTWARE\Course Developer\.venv\Scripts\nlm.exe" (
    set "NLM_EXE=D:\HUE\DEVELOPED SOFTWARE\Course Developer\.venv\Scripts\nlm.exe"
) else (
    echo ERROR: nlm.exe not found in .venv or known paths.
    pause
    exit /b 1
)
echo Using NLM CLI: %NLM_EXE%

:: ─── Resolve Edge ───
set "EDGE_EXE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else (
    echo ERROR: Microsoft Edge not found.
    pause
    exit /b 1
)
echo Using Edge: %EDGE_EXE%

:: ─── Clean stale lockfiles ───
echo Cleaning stale browser lockfiles...
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-profiles\default\lockfile" >nul 2>&1
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-profiles\default\SingletonLock" >nul 2>&1
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-port-map.json" >nul 2>&1
echo.

:: ─── Step 1: Launch Edge InPrivate with CDP ───
echo Step 1: Launching Edge InPrivate for Google Sign-In...
echo.
start "" "%EDGE_EXE%" --new-window --user-data-dir="%~dp0.nlm-edge-profile" --remote-debugging-port=18800 --no-first-run --no-default-browser-check --disable-sync --disable-extensions --disable-background-networking --disable-default-apps "https://accounts.google.com/ServiceLogin?continue=https%%3A%%2F%%2Fnotebooklm.google.com"

echo ========================================================
echo   Edge InPrivate is open. Complete these steps:
echo   1. Sign in with your Google account
echo   2. Wait until you see the NotebookLM dashboard
echo   3. Come back here and press any key
echo ========================================================
echo.
pause

:: ─── Step 2: Capture session via CDP ───
echo.
echo Step 2: Capturing session credentials from Edge...
echo.
"%NLM_EXE%" login --provider openclaw --cdp-url "http://127.0.0.1:18800" --force

echo.
echo ========================================================
echo   Done! Return to Course Developer Studio
echo   and click "Verify Auth".
echo ========================================================
echo.

:: ─── Cleanup: kill Edge InPrivate ───
echo Closing Edge InPrivate window...
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq *InPrivate*" >nul 2>&1

pause