@echo off
echo Testing database insert...
echo.

:: Change to the directory where this batch file is located
cd /d "%~dp0"

:: Create a temporary Node.js script to test insert
echo import pool from './src/db/database.js'; > temp-test-insert.js
echo. >> temp-test-insert.js
echo async function testInsert() { >> temp-test-insert.js
echo   try { >> temp-test-insert.js
echo     // Try to insert a test map >> temp-test-insert.js
echo     const result = await pool.query( >> temp-test-insert.js
echo       'INSERT INTO maps (name, image_url, width, height, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *', >> temp-test-insert.js
echo       ['Test Map', 'https://example.com/map.jpg', 1000, 1000, 1] >> temp-test-insert.js
echo     ); >> temp-test-insert.js
echo     console.log('Successfully inserted test map:', result.rows[0]); >> temp-test-insert.js
echo     >> temp-test-insert.js
echo     // Clean up - delete the test map >> temp-test-insert.js
echo     await pool.query('DELETE FROM maps WHERE id = $1', [result.rows[0].id]); >> temp-test-insert.js
echo     console.log('Test map deleted'); >> temp-test-insert.js
echo   } catch (error) { >> temp-test-insert.js
echo     console.error('Insert failed:', error.message); >> temp-test-insert.js
echo     console.error('Full error:', error); >> temp-test-insert.js
echo   } finally { >> temp-test-insert.js
echo     await pool.end(); >> temp-test-insert.js
echo   } >> temp-test-insert.js
echo } >> temp-test-insert.js
echo. >> temp-test-insert.js
echo testInsert(); >> temp-test-insert.js

:: Run the script
node temp-test-insert.js

:: Clean up
del temp-test-insert.js

pause