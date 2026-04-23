@echo off
setlocal EnableDelayedExpansion
title HarvestERP - Dev Environment

set "ERP_ROOT=%~dp0"
set "BACKEND=%~dp0backend"
set "FRONTEND=%~dp0frontend"
set "NEXTJS=%~dp0..\harvesterp-web\apps\web"

echo.
echo ============================================================
echo   HarvestERP ^| Dev Environment
echo ============================================================
echo.

:: ── Step 1: Ensure Docker Desktop is running ─────────────────
echo [1/5] Checking Docker Desktop...
docker info >nul 2>&1
if not errorlevel 1 goto docker_ready

echo   Docker is not running. Starting Docker Desktop...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo.
    echo   Cannot find Docker Desktop at the default install path.
    echo   Please open Docker Desktop manually from the Start Menu,
    echo   wait for the whale icon in the taskbar to stop animating,
    echo   then re-run this script.
    echo.
    pause
    exit /b 1
)

echo   Waiting for Docker to start (up to 120 seconds)...
set WAITED=0

:docker_wait_loop
timeout /t 5 /nobreak >nul
set /a WAITED+=5
docker info >nul 2>&1
if not errorlevel 1 goto docker_ready
if !WAITED! lss 120 goto docker_wait_loop

echo.
echo   Docker did not start within 120 seconds.
echo   Open Docker Desktop manually, wait for it to fully start,
echo   then re-run this script.
echo.
pause
exit /b 1

:docker_ready
echo   Docker is ready.
echo.

:: ── Step 2: Start PostgreSQL ──────────────────────────────────
echo [2/5] Starting PostgreSQL container...
cd /d "%ERP_ROOT%"
docker compose up db -d
if errorlevel 1 (
    echo.
    echo   ERROR: Failed to start the PostgreSQL container.
    echo.
    pause
    exit /b 1
)

echo   Waiting for PostgreSQL to accept connections...
:pg_wait_loop
docker compose exec -T db pg_isready -U erp -d harvestdb >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto pg_wait_loop
)
echo   PostgreSQL is ready.
echo.

:: ── Step 3: Run migrations ────────────────────────────────────
echo [3/5] Running database migrations...
cd /d "%BACKEND%"
python -m alembic upgrade head
if errorlevel 1 (
    echo.
    echo   WARNING: Migrations reported an error. Check output above.
    echo   Press any key to continue starting the servers anyway...
    pause
)
echo.

:: ── Step 4: Start FastAPI backend ────────────────────────────
echo [4/5] Starting FastAPI backend (port 8080)...
start "HarvestERP | Backend" cmd /k "cd /d "%BACKEND%" && python -m uvicorn main:app --reload --port 8080"
timeout /t 3 /nobreak >nul
echo.

:: ── Step 5: Start frontends ───────────────────────────────────
echo [5/5] Starting frontends...
start "HarvestERP | Next.js" cmd /k "cd /d "%NEXTJS%" && pnpm dev"
start "HarvestERP | Vue"     cmd /k "cd /d "%FRONTEND%" && npm run dev"

echo.
echo ============================================================
echo   All services started.
echo.
echo   Backend     http://localhost:8080
echo   API Docs    http://localhost:8080/api/docs
echo   Next.js     http://localhost:3000
echo   Vue         http://localhost:5173
echo.
echo   Close individual windows to stop each service.
echo   Press any key to close this launcher window.
echo ============================================================
echo.
pause
