# Living Story Bible - Development Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " LIVING STORY BIBLE - AI CONTINUITY GUARDIAN" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "Launching FastAPI backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload"

Write-Host "Launching React Vite frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host "`nWorkspace is launching!" -ForegroundColor Cyan
Write-Host "Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
