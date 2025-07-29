import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateConnectorDefaults() {
  try {
    console.log('Updating point connector defaults...');
    
    // Read the update SQL file
    const updatePath = path.join(__dirname, 'src/db/update-connector-defaults.sql');
    const updateSQL = fs.readFileSync(updatePath, 'utf8');
    
    // Execute the update
    await pool.query(updateSQL);
    
    console.log('Successfully updated point connector defaults!');
    
    // Check how many connectors were updated
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM point_connectors 
      WHERE from_icon = '🔗' OR to_icon = '🔗'
    `);
    
    console.log(`Updated ${result.rows[0].count} point connectors to use chain link icon`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating connector defaults:', error);
    process.exit(1);
  }
}

updateConnectorDefaults();