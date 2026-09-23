@echo off
setlocal EnableDelayedExpansion
title Session Master - Course Developer Studio Launcher
color 0B
cls

echo ===============================================================================
echo            SESSION MASTER : COURSE DEVELOPER STUDIO - LAUNCHER
echo          Multi-Agent Curriculum Engineering ^& Supabase Platform
echo ===============================================================================
echo.

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BACKEND_DIR=%ROOT_DIR%backend\src\CourseDeveloper.Api"

:: Prepend local .NET SDK to PATH if present
if exist "%LocalAppData%\Microsoft\dotnet\dotnet.exe" (
    set "PATH=%LocalAppData%\Microsoft\dotnet;!PATH!"
)

:: 1. Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found on your system PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check Backend (Already running, .NET SDK, or Docker)
set "BACKEND_HTTP=000"
for /f "tokens=*" %%a in ('curl.exe -s -o nul -w "%%{http_code}" --connect-timeout 2 http://localhost:5000/swagger/index.html 2^>nul') do set "BACKEND_HTTP=%%a"

if "!BACKEND_HTTP!"=="200" (
    echo [1/2] Backend API is already active and healthy on http://localhost:5000 [OK]
) else (
    where dotnet >nul 2>&1
    if not errorlevel 1 (
        echo [1/2] Launching Backend Web API on http://localhost:5000 ...
        start "Session Master - Backend API" cmd.exe /k "cd /d "%BACKEND_DIR%" && dotnet run"
    ) else (
        echo [INFO] .NET SDK is not found on PATH.
        where docker >nul 2>&1
        if not errorlevel 1 (
            echo [1/2] Starting Backend API in Docker container on http://localhost:5000 ...
            start /b "" docker compose up -d backend
            timeout /t 3 /nobreak >nul
        ) else (
            echo [WARN] Neither .NET SDK nor Docker found. Backend may be offline.
        )
    )
)

:: 3. Check Frontend (Already running or start Next.js dev server)
set "FRONTEND_HTTP=000"
for /f "tokens=*" %%a in ('curl.exe -s -o nul -w "%%{http_code}" --connect-timeout 2 http://localhost:3000 2^>nul') do set "FRONTEND_HTTP=%%a"

if "!FRONTEND_HTTP!"=="200" (
    echo [2/2] Frontend Studio is already running on http://localhost:3000 [OK]
) else (
    echo [2/2] Launching Next.js Frontend on http://localhost:3000 ...
    start "Session Master - Frontend" cmd.exe /k "cd /d "%FRONTEND_DIR%" && npm.cmd run dev"
    timeout /t 3 /nobreak >nul
)

:: 4. Open browser
echo.
echo Launching Session Master: Course Developer Studio in your default browser...
start http://localhost:3000

echo.
echo ===============================================================================
echo                SESSION MASTER STUDIO IS RUNNING!
echo ===============================================================================
echo.
echo   * Studio Dashboard:      http://localhost:3000
echo   * Course Dossier Hub:    http://localhost:3000/dossier
echo   * Institutions ^& Rules:  http://localhost:3000/organizations
echo   * Curriculum Projects:   http://localhost:3000/projects
echo   * Backend Swagger Docs:  http://localhost:5000/swagger
echo.
echo Note: Keep the frontend terminal window open while using the app.
echo ===============================================================================
echo.
pause
