import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addPOIDescription() {
  try {
    console.log('Adding description column to POIs table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/db/add-poi-description.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('Successfully added description column!');
    
    const result = await pool.query("SELECT COUNT(*) as count FROM pois");
    console.log(`POIs table now supports descriptions for ${result.rows[0].count} POIs`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding POI description:', error);
    process.exit(1);
  }
}

addPOIDescription();