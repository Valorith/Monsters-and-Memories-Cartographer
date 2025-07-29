@echo off
echo Checking maps in database...
echo.

:: Change to the directory where this batch file is located
cd /d "%~dp0"

:: Create a temporary Node.js script to check maps
echo import pool from './src/db/database.js'; > temp-check-maps.js
echo. >> temp-check-maps.js
echo async function checkMaps() { >> temp-check-maps.js
echo   try { >> temp-check-maps.js
echo     const result = await pool.query('SELECT * FROM maps ORDER BY display_order'); >> temp-check-maps.js
echo     console.log(`Found ${result.rows.length} maps:`); >> temp-check-maps.js
echo     result.rows.forEach(map =^> { >> temp-check-maps.js
echo       console.log(`  - ${map.name} (ID: ${map.id})`); >> temp-check-maps.js
echo     }); >> temp-check-maps.js
echo     if (result.rows.length === 0) { >> temp-check-maps.js
echo       console.log('\nNo maps found. You need to add maps via the Admin Panel.'); >> temp-check-maps.js
echo     } >> temp-check-maps.js
echo   } catch (error) { >> temp-check-maps.js
echo     console.error('Error:', error.message); >> temp-check-maps.js
echo   } finally { >> temp-check-maps.js
echo     await pool.end(); >> temp-check-maps.js
echo   } >> temp-check-maps.js
echo } >> temp-check-maps.js
echo. >> temp-check-maps.js
echo checkMaps(); >> temp-check-maps.js

:: Run the script
node temp-check-maps.js

:: Clean up
del temp-check-maps.js

pause