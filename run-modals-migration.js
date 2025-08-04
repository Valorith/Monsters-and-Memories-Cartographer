import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runModalsMigration() {
  try {
    console.log('Running modals migration...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'sql', 'migrations', 'add-modals-schema.sql'), 
      'utf8'
    );
    
    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // Run each statement separately
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await pool.query(statement);
    }
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('welcome_messages', 'user_warnings')
      ORDER BY table_name
    `);
    
    console.log('\nTables found:');
    tableCheck.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check user_warnings columns
    const warningsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_warnings' 
      AND column_name = 'acknowledged_at'
    `);
    
    if (warningsColumns.rows.length > 0) {
      console.log('\nSuccessfully added acknowledged_at column to user_warnings table');
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
  } finally {
    await pool.end();
  }
}

// Run the migration
runModalsMigration();