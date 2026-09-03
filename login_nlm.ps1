Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  NotebookLM Google Authentication Helper   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launching Google Sign-In Window in Microsoft Edge..." -ForegroundColor Green
Write-Host "Sign in with your Google account in the opened window." -ForegroundColor Yellow
Write-Host ""

& "D:\HUE\DEVELOPED SOFTWARE\Course Developer\.venv\Scripts\nlm.exe" login

