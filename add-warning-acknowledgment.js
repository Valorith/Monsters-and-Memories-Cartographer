import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addWarningAcknowledgment() {
  try {
    console.log('Checking user_warnings table structure...');
    
    // Check if acknowledged_at column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_warnings' 
      AND column_name = 'acknowledged_at'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding acknowledged_at column to user_warnings table...');
      
      // Add the column
      await pool.query(`
        ALTER TABLE user_warnings 
        ADD COLUMN acknowledged_at TIMESTAMP DEFAULT NULL
      `);
      
      // Create index for faster lookup
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_warnings_unacknowledged 
        ON user_warnings(user_id) 
        WHERE acknowledged_at IS NULL
      `);
      
      console.log('✅ Successfully added acknowledged_at column!');
    } else {
      console.log('✅ acknowledged_at column already exists!');
    }
    
    // Show current table structure
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_warnings'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent user_warnings table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'NO' ? 'required' : 'optional'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Details:', error.detail);
  } finally {
    await pool.end();
  }
}

// Run the script
addWarningAcknowledgment();