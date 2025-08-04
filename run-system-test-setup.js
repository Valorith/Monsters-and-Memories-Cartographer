import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine which database URL to use (same as main app)
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL');
    return process.env.DATABASE_URL;
  }
  
  if (process.env.DATABASE_PUBLIC_URL) {
    console.log('Using DATABASE_PUBLIC_URL (development)');
    return process.env.DATABASE_PUBLIC_URL;
  }
  
  throw new Error('No database URL configured. Please set DATABASE_URL or DATABASE_PUBLIC_URL in .env');
};

// Configure SSL based on environment (same as main app)
const getSSLConfig = () => {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true') {
    return {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT && { ca: process.env.DATABASE_CA_CERT })
    };
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')) {
    return { rejectUnauthorized: false };
  }
  
  return false;
};

// Database connection
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: getSSLConfig()
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting system test POIs setup...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. First ensure the shared POI system is set up
    console.log('1️⃣ Checking shared POI system...');
    const sharedPoiSystemSQL = await fs.readFile(
      path.join(__dirname, 'src/db/update-shared-poi-system.sql'), 
      'utf8'
    );
    await client.query(sharedPoiSystemSQL);
    console.log('✅ Shared POI system ready\n');
    
    // 2. Add custom POI columns if needed
    console.log('2️⃣ Ensuring custom POI columns exist...');
    const customPoiColumnsSQL = await fs.readFile(
      path.join(__dirname, 'src/db/add-custom-poi-columns.sql'), 
      'utf8'
    );
    await client.query(customPoiColumnsSQL);
    console.log('✅ Custom POI columns ready\n');
    
    // 3. Create system test POIs
    console.log('3️⃣ Creating system test POIs...');
    const systemTestPOIsSQL = await fs.readFile(
      path.join(__dirname, 'src/db/create-system-test-pois.sql'), 
      'utf8'
    );
    await client.query(systemTestPOIsSQL);
    console.log('✅ System test POIs created\n');
    
    // 4. Verify the setup
    console.log('4️⃣ Verifying setup...');
    
    // Check if System user exists
    const userCheck = await client.query(
      'SELECT id, name, email FROM users WHERE id = 999999'
    );
    if (userCheck.rows.length > 0) {
      console.log('✅ System user found:', userCheck.rows[0]);
    } else {
      throw new Error('System user was not created');
    }
    
    // Check if test POI with share code exists
    const poiCheck = await client.query(
      'SELECT id, name, share_code, x, y FROM custom_pois WHERE user_id = 999999 AND share_code = $1',
      ['SYSTEST001']
    );
    if (poiCheck.rows.length > 0) {
      console.log('✅ Test POI with share code found:', poiCheck.rows[0]);
    } else {
      throw new Error('Test POI with share code was not created');
    }
    
    // Check total POIs created
    const poiCount = await client.query(
      'SELECT COUNT(*) as count FROM custom_pois WHERE user_id = 999999'
    );
    console.log(`✅ Total POIs created for System user: ${poiCount.rows[0].count}\n`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('🎉 System test setup completed successfully!');
    console.log('\n📝 Instructions:');
    console.log('1. Log in as an admin user');
    console.log('2. Go to Account → Custom POIs');
    console.log('3. Click "Add Shared POI"');
    console.log('4. Click "🧪 Insert System Test Code" (admin only)');
    console.log('5. Click "Add POI" to add the test POI');
    console.log('\nShare code: SYSTEST001');
    console.log('Test POI location: (650, 650) on the default map\n');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error during setup:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});