import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addConnectorToPOI() {
  try {
    console.log('Adding to_poi_id support to point_connectors table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/db/add-connector-to-poi.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('Successfully added to_poi_id support!');
    console.log('Point connectors can now connect to POIs.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding connector to POI support:', error);
    process.exit(1);
  }
}

addConnectorToPOI();