@echo off
echo Starting MMC in development mode with hot reload...
echo.

:: Change to the directory where this batch file is located
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting development servers...
echo - Frontend will run on: http://localhost:5173
echo - Backend API will run on: http://localhost:4173
echo.
echo Press Ctrl+C to stop both servers
echo.

:: Run both frontend and backend with hot reload
call npm run dev:full

pause