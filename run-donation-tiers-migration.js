import pool from './src/db/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Running donation tiers migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'src', 'db', 'create-donation-tiers-table.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Donation tiers migration completed successfully!');
    console.log('📊 Created tables:');
    console.log('   - donation_tiers');
    console.log('   - Added donation tier fields to users table');
    console.log('   - Inserted default tiers: Bronze, Silver, Gold, Platinum, Diamond');
    
    // Show current tiers
    const tiersResult = await pool.query('SELECT * FROM donation_tiers ORDER BY tier_order');
    console.log('\n📋 Current donation tiers:');
    tiersResult.rows.forEach(tier => {
      console.log(`   ${tier.tier_order}. ${tier.badge_icon} ${tier.name} - $${tier.required_amount}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Tables already exist, skipping migration');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
    process.exit();
  }
}

runMigration();