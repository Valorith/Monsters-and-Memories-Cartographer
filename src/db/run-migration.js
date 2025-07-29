import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres:EhlvmsdrgXwQQBxpvyJCdLPlKftwfsnx@mainline.proxy.rlwy.net:38728/railway',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Running connector migration...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrate-connectors.sql'), 'utf8');
    
    // Run migration
    await pool.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const connectorCheck = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'point_connectors' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nPoint Connectors table structure:');
    connectorCheck.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });
    
    const zoneCheck = await pool.query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'zone_connectors' 
      AND column_name IN ('from_icon', 'to_icon')
    `);
    
    console.log('\nZone Connectors icon defaults:', zoneCheck.rows);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.detail) console.error('Details:', error.detail);
  } finally {
    await pool.end();
  }
}

runMigration();