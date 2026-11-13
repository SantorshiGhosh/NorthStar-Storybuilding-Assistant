@echo off
echo ========================================================
echo  LIVING STORY BIBLE - AI CONTINUITY GUARDIAN
echo ========================================================
echo Starting FastAPI Backend on http://localhost:8000 ...
start "Story Bible Backend" cmd /k "python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload"

echo Starting Vite Frontend on http://localhost:5173 ...
start "Story Bible Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application is starting!
echo Backend Swagger API: http://localhost:8000/docs
echo Frontend Workspace:  http://localhost:5173
echo ========================================================
pause
