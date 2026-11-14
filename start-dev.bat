@echo off
echo ========================================================
echo  NORTHSTAR - AI CONTINUITY GUARDIAN
echo ========================================================
echo Starting FastAPI Backend on http://localhost:8000 ...
start "NorthStar Backend" cmd /k "python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload"

echo Starting Vite Frontend on http://localhost:5173 ...
start "NorthStar Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application is starting!
echo Backend Swagger API: http://localhost:8000/docs
echo Frontend Workspace:  http://localhost:5173
echo ========================================================
pause
