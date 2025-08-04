import pool from './src/db/database.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runVisibilityMigration() {
  try {
    console.log('🔄 Running user visibility migration...');
    
    // Read the migration SQL
    const migrationPath = join(__dirname, 'migrations', 'add_user_visible_flag.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    // Run the migration
    await pool.query(sql);
    
    console.log('✅ User visibility migration completed successfully!');
    
    // Verify the migration
    const result = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'visible'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Visible column added to users table');
      console.log('  - Type:', result.rows[0].data_type);
      console.log('  - Default:', result.rows[0].column_default);
      console.log('  - Nullable:', result.rows[0].is_nullable);
      
      // Check if System user was updated
      const systemUser = await pool.query(
        "SELECT id, name, visible FROM users WHERE name = 'System' OR email = 'system@mmcartographer.com'"
      );
      
      if (systemUser.rows.length > 0) {
        console.log('\n📊 System user visibility status:');
        systemUser.rows.forEach(user => {
          console.log(`  - User "${user.name}" (ID: ${user.id}): visible = ${user.visible}`);
        });
      }
      
      // Check index creation
      const indexResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users' AND indexname = 'idx_users_visible'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('\n✅ Index created:', indexResult.rows[0].indexname);
      }
    } else {
      console.error('❌ Visible column was not created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runVisibilityMigration();