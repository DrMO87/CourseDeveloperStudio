@echo off
title NotebookLM Google Authentication Helper
cls
echo ========================================================
echo   NotebookLM Google Sign-In (Dedicated Window)
echo ========================================================
echo.
echo Cleaning stale browser lockfiles...
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-profiles\default\lockfile" >nul 2>&1
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-profiles\default\SingletonLock" >nul 2>&1
del /f /q "%USERPROFILE%\.notebooklm-mcp-cli\chrome-port-map.json" >nul 2>&1
echo.
echo Launching Microsoft Edge for Google Sign-In...
echo Please complete your sign-in in the opened browser window.
echo.
"D:\HUE\DEVELOPED SOFTWARE\Course Developer\.venv\Scripts\nlm.exe" login
echo.
echo ========================================================
echo   Sign-in complete! Return to Course Developer Studio
echo   and click "Verify Auth".
echo ========================================================
pause