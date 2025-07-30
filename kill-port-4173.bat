@echo off
echo Finding process using port 4173...

:: Find the PID using port 4173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4173 ^| findstr LISTENING') do (
    set PID=%%a
)

if defined PID (
    echo Found process with PID %PID% using port 4173
    echo Killing process...
    taskkill /F /PID %PID%
    echo Process killed successfully.
) else (
    echo No process found using port 4173
)

:: Also kill all node processes just to be sure
echo.
echo Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul

echo.
echo Done! Port 4173 should now be free.
pause