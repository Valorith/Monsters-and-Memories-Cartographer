@echo off
echo Testing database connection...
echo.

:: Change to the directory where this batch file is located
cd /d "%~dp0"

:: Set DATABASE_URL from DATABASE_PUBLIC_URL for the test
set DATABASE_URL=%DATABASE_PUBLIC_URL%

:: Run the test
node test-db.js

pause