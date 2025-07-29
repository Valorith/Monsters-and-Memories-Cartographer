@echo off
echo Running database migration...
echo.

:: Change to the directory where this batch file is located
cd /d "%~dp0"

:: Run the migration
node src/db/migrate.js

pause