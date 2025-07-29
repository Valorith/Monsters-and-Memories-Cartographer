import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function reduceIconSizes() {
  try {
    console.log('Reducing all icon sizes by 30%...');
    
    // Read the update SQL file
    const updatePath = path.join(__dirname, 'src/db/reduce-icon-sizes.sql');
    const updateSQL = fs.readFileSync(updatePath, 'utf8');
    
    // Execute the update
    await pool.query(updateSQL);
    
    console.log('Successfully reduced icon sizes!');
    
    // Report how many items were updated
    const poiResult = await pool.query('SELECT COUNT(*) as count FROM pois WHERE icon_size IS NOT NULL');
    const pcResult = await pool.query('SELECT COUNT(*) as count FROM point_connectors');
    const zcResult = await pool.query('SELECT COUNT(*) as count FROM zone_connectors');
    
    console.log(`Updated sizes for:`);
    console.log(`- ${poiResult.rows[0].count} POIs`);
    console.log(`- ${pcResult.rows[0].count} point connectors`);
    console.log(`- ${zcResult.rows[0].count} zone connectors`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error reducing icon sizes:', error);
    process.exit(1);
  }
}

reduceIconSizes();