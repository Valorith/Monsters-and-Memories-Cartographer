import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addPOIType() {
  try {
    console.log('Adding type column to POIs table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/db/add-poi-type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('Successfully added type column!');
    
    // Now clear the icon field for all POIs so they use type-based icons
    console.log('Clearing hardcoded icons from POIs...');
    await pool.query("UPDATE pois SET icon = NULL, custom_icon = NULL");
    
    const result = await pool.query("SELECT COUNT(*) as count FROM pois");
    console.log(`Updated ${result.rows[0].count} POIs to use type-based icons`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding POI type:', error);
    process.exit(1);
  }
}

addPOIType();