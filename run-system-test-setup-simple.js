const { Pool } = require('pg');
require('dotenv').config();

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

async function setup() {
  console.log('Setting up system test POIs...');
  
  try {
    // Run all migrations in sequence
    await pool.query(`
      -- Ensure shared POI system columns exist
      ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code VARCHAR(10) UNIQUE;
      ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code_created_at TIMESTAMP;
      ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code_revoked BOOLEAN DEFAULT FALSE;
      
      -- Ensure custom POI columns exist
      ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);
      ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
      
      -- Create shared_pois table if it doesn't exist
      CREATE TABLE IF NOT EXISTS shared_pois (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        custom_poi_id INTEGER NOT NULL REFERENCES custom_pois(id) ON DELETE CASCADE,
        share_code VARCHAR(10) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(user_id, custom_poi_id)
      );
      
      -- Create System user
      INSERT INTO users (id, google_id, email, name, nickname, is_admin, created_at, last_login)
      VALUES (999999, 'system-test-user', 'system@mmc.test', 'System', 'System', false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          nickname = EXCLUDED.nickname;
      
      -- Delete existing test POIs
      DELETE FROM custom_pois WHERE user_id = 999999;
      
      -- Create test POI with share code
      INSERT INTO custom_pois (
        user_id, map_id, name, description, x, y, type_id, 
        share_code, share_code_created_at, share_code_revoked, created_at
      )
      VALUES (
          999999, 
          1, 
          'System Test Location', 
          'This is a test POI shared by the System account. It demonstrates the POI sharing functionality for testing purposes.',
          650, 
          650, 
          13, -- Landmark type 
          'SYSTEST001',
          NOW(),
          false,
          NOW()
      );
      
      -- Create additional private test POIs
      INSERT INTO custom_pois (user_id, map_id, name, description, x, y, type_id, created_at)
      VALUES 
      (
          999999, 
          1, 
          'Private Test Combat Zone', 
          'This POI is owned by System but not shared.',
          500, 
          500, 
          11, -- Combat NPC type 
          NOW()
      ),
      (
          999999, 
          1, 
          'Private Test Merchant', 
          'This POI is owned by System but not shared.',
          600, 
          600, 
          14, -- Merchant type 
          NOW()
      );
    `);
    
    console.log('✅ System test POIs setup completed!');
    console.log('\nShare code: SYSTEST001');
    console.log('Test POI: "System Test Location" at (650, 650)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();