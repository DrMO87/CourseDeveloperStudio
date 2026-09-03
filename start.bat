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

:: 1. Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found on your system PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check .NET SDK (Optional)
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [INFO] .NET SDK is not found on PATH. Launching Frontend Studio...
) else (
    echo [1/2] Launching Backend Web API on http://localhost:5000 ...
    start "Session Master - Backend API" cmd.exe /k "cd /d "%BACKEND_DIR%" && dotnet run"
)

:: 3. Start Frontend Next.js Dev Server
echo [2/2] Launching Next.js Frontend on http://localhost:3000 ...
start "Session Master - Frontend" cmd.exe /k "cd /d "%FRONTEND_DIR%" && npm.cmd run dev"

:: 4. Wait briefly and launch browser
timeout /t 3 /nobreak >nul
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
