@echo off
setlocal EnableDelayedExpansion
title Course Developer Studio - Docker Launcher
color 0A
cls

echo ===============================================================================
echo            COURSE DEVELOPER STUDIO : DOCKER CONTAINER LAUNCHER
echo              .NET 9 Web API + Next.js 15 Standalone Containers
echo ===============================================================================
echo.

:: Check Docker CLI
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in your system PATH.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

:: Check Docker Engine Running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker daemon is not running.
    echo Please launch Docker Desktop and wait until the engine starts, then retry.
    echo.
    pause
    exit /b 1
)

echo [1/3] Building and starting containers with Docker Compose...
docker compose up -d --build

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start Docker containers. Check output above for details.
    pause
    exit /b 1
)

echo.
echo [2/3] Waiting for containers to become healthy...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Opening Course Developer Studio in your browser...
start http://localhost:3000

echo.
echo ===============================================================================
echo                COURSE DEVELOPER STUDIO CONTAINERS ARE ACTIVE!
echo ===============================================================================
echo.
echo   * Web Studio Frontend:   http://localhost:3000
echo   * Backend Swagger API:   http://localhost:5000/swagger
echo   * View live logs:        docker compose logs -f
echo   * Stop containers:       docker compose down
echo.
echo ===============================================================================
pause
