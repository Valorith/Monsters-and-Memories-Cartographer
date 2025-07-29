import pool from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('Starting database migration...');
    
    // Check existing tables first
    const existingTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    if (existingTables.rows.length > 0) {
      console.log('Found existing tables:', existingTables.rows.map(r => r.table_name).join(', '));
    }
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('Database migration completed successfully!');
    
    // Check tables after migration
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('Current tables:', result.rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't exit on error - tables might already exist
    if (error.code !== '42P07') { // 42P07 is "relation already exists"
      throw error;
    }
  }
}

// Run migration if this file is executed directly
if (process.argv[1] === __filename) {
  migrate().then(() => {
    pool.end();
  }).catch((error) => {
    console.error('Migration failed:', error);
    pool.end();
    process.exit(1);
  });
}

export default migrate;