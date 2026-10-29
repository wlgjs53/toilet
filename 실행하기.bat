@echo off
rem Toilet Issue - double-click to run on this PC (http://localhost:5173)
cd /d "%~dp0"

if not exist node_modules (
  echo [1/2] Installing packages... first run only
  call npm install
)

if not exist .env (
  echo.
  echo [!] .env file not found. Copy .env.example to .env and fill in TOILET_API_KEY.
  pause
  exit /b 1
)

echo [2/2] Starting server... close this window to stop.
start "" "http://localhost:5173"
call npm run dev -- --port 5173 --strictPort
pause
