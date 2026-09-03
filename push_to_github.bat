@echo off
setlocal
echo ===================================================
echo   Pushing CourseDeveloperStudio to GitHub (DrMO87)
echo ===================================================

set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%"

echo Checking git status...
git status

echo.
echo Pushing to origin main...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo [SUCCESS] Repository uploaded successfully!
    echo URL: https://github.com/DrMO87/CourseDeveloperStudio
    echo ===================================================
) else (
    echo.
    echo [INFO] If this is your first push, please make sure you have created
    echo the repository "CourseDeveloperStudio" at:
    echo   https://github.com/new
    echo Then run this script again or sign in when prompted.
)
pause
