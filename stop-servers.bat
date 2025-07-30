@echo off
echo Stopping all Node.js processes...

:: Kill all node processes
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
    echo Node processes stopped successfully.
) else (
    echo No Node processes were running.
)

:: Wait a moment for ports to be released
timeout /t 2 /nobreak >nul

echo.
echo All servers stopped. You can now run dev.bat to start fresh.
pause