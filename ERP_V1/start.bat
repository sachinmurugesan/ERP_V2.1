@echo off
title HarvestERP - Dev Server
echo ============================================
echo   HarvestERP - Starting Dev Servers
echo ============================================
echo.

:: Start backend in a new window
start "HarvestERP Backend" cmd /k "cd /d %~dp0backend && set DEBUG=true && set ALLOW_DEV_AUTH=true && python -m uvicorn main:app --reload --port 8080"

:: Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

:: Start frontend in a new window
start "HarvestERP Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo   Backend:  http://localhost:8080
echo   Frontend: http://localhost:5173
echo   API Docs: http://localhost:8080/api/docs
echo.
echo   Close this window to keep servers running,
echo   or close the individual server windows to stop them.
echo ============================================
