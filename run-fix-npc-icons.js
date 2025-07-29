import pool from './src/db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixNPCIcons() {
  try {
    console.log('Fixing NPC POI icons...');
    
    // Read the update SQL file
    const updatePath = path.join(__dirname, 'src/db/fix-npc-icons.sql');
    const updateSQL = fs.readFileSync(updatePath, 'utf8');
    
    // Execute the update
    await pool.query(updateSQL);
    
    console.log('Successfully updated NPC icons!');
    
    // Report how many items were updated
    const result = await pool.query("SELECT COUNT(*) as count FROM pois WHERE type = 'npc'");
    console.log(`Updated ${result.rows[0].count} NPC POIs to use default skull icon`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing NPC icons:', error);
    process.exit(1);
  }
}

fixNPCIcons();