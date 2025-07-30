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
    
    // Execute the users table migration
    const usersSchemaPath = path.join(__dirname, 'create-users-table.sql');
    if (fs.existsSync(usersSchemaPath)) {
      const usersSchema = fs.readFileSync(usersSchemaPath, 'utf8');
      await pool.query(usersSchema);
      console.log('Users table migration completed');
    }
    
    // Execute the session table migration
    const sessionSchemaPath = path.join(__dirname, 'create-session-table.sql');
    if (fs.existsSync(sessionSchemaPath)) {
      const sessionSchema = fs.readFileSync(sessionSchemaPath, 'utf8');
      await pool.query(sessionSchema);
      console.log('Session table migration completed');
    }
    
    // Execute the custom POIs table migration
    const customPoisSchemaPath = path.join(__dirname, 'create-custom-pois-table.sql');
    if (fs.existsSync(customPoisSchemaPath)) {
      const customPoisSchema = fs.readFileSync(customPoisSchemaPath, 'utf8');
      await pool.query(customPoisSchema);
      console.log('Custom POIs table migration completed');
    }
    
    // Execute the share code update migration
    const shareCodePath = path.join(__dirname, 'update-share-code.sql');
    if (fs.existsSync(shareCodePath)) {
      const shareCodeSchema = fs.readFileSync(shareCodePath, 'utf8');
      await pool.query(shareCodeSchema);
      console.log('Share code migration completed');
    }
    
    // Execute the XP field migration
    const xpFieldPath = path.join(__dirname, 'add-xp-field.sql');
    if (fs.existsSync(xpFieldPath)) {
      const xpFieldSchema = fs.readFileSync(xpFieldPath, 'utf8');
      await pool.query(xpFieldSchema);
      console.log('XP field migration completed');
    }
    
    // Execute the pending POIs migration
    const pendingPoisPath = path.join(__dirname, 'create-pending-pois-table.sql');
    if (fs.existsSync(pendingPoisPath)) {
      const pendingPoisSchema = fs.readFileSync(pendingPoisPath, 'utf8');
      await pool.query(pendingPoisSchema);
      console.log('Pending POIs migration completed');
    }
    
    // Execute the XP config migration
    const xpConfigPath = path.join(__dirname, 'create-xp-config-table.sql');
    if (fs.existsSync(xpConfigPath)) {
      const xpConfigSchema = fs.readFileSync(xpConfigPath, 'utf8');
      await pool.query(xpConfigSchema);
      console.log('XP config migration completed');
    }
    
    // Execute the XP history migration
    const xpHistoryPath = path.join(__dirname, 'create-xp-history-table.sql');
    if (fs.existsSync(xpHistoryPath)) {
      const xpHistorySchema = fs.readFileSync(xpHistoryPath, 'utf8');
      await pool.query(xpHistorySchema);
      console.log('XP history migration completed');
    }
    
    // Add custom fields to pending_pois table
    const customFieldsPath = path.join(__dirname, 'add-custom-fields-to-pending-pois.sql');
    if (fs.existsSync(customFieldsPath)) {
      const customFieldsSchema = fs.readFileSync(customFieldsPath, 'utf8');
      await pool.query(customFieldsSchema);
      console.log('Custom fields migration for pending POIs completed');
    }
    
    // Remove redundant poi_rejected config
    const removePoiRejectedPath = path.join(__dirname, 'remove-poi-rejected-config.sql');
    if (fs.existsSync(removePoiRejectedPath)) {
      const removePoiRejectedSchema = fs.readFileSync(removePoiRejectedPath, 'utf8');
      await pool.query(removePoiRejectedSchema);
      console.log('Removed redundant poi_rejected config');
    }
    
    // Add user management fields
    const userMgmtPath = path.join(__dirname, 'add-user-management-fields.sql');
    if (fs.existsSync(userMgmtPath)) {
      const userMgmtSchema = fs.readFileSync(userMgmtPath, 'utf8');
      await pool.query(userMgmtSchema);
      console.log('User management fields migration completed');
    }
    
    // Add admin_id to xp_history
    const adminIdPath = path.join(__dirname, 'add-admin-id-to-xp-history.sql');
    if (fs.existsSync(adminIdPath)) {
      const adminIdSchema = fs.readFileSync(adminIdPath, 'utf8');
      await pool.query(adminIdSchema);
      console.log('Admin ID field added to XP history');
    }
    
    // Add profile customization fields
    const profileCustomPath = path.join(__dirname, 'add-profile-customization.sql');
    if (fs.existsSync(profileCustomPath)) {
      const profileCustomSchema = fs.readFileSync(profileCustomPath, 'utf8');
      await pool.query(profileCustomSchema);
      console.log('Profile customization fields added');
    }
    
    // Update avatar to base64 storage
    const avatarBase64Path = path.join(__dirname, 'update-avatar-to-base64.sql');
    if (fs.existsSync(avatarBase64Path)) {
      const avatarBase64Schema = fs.readFileSync(avatarBase64Path, 'utf8');
      await pool.query(avatarBase64Schema);
      console.log('Avatar storage updated to base64');
    }
    
    // Add POI attribution fields
    const poiAttributionPath = path.join(__dirname, 'add-poi-attribution.sql');
    if (fs.existsSync(poiAttributionPath)) {
      const poiAttributionSchema = fs.readFileSync(poiAttributionPath, 'utf8');
      await pool.query(poiAttributionSchema);
      console.log('POI attribution fields added');
    }
    
    // Add nickname unique constraint
    const nicknameUniquePath = path.join(__dirname, 'add-nickname-unique-constraint.sql');
    if (fs.existsSync(nicknameUniquePath)) {
      const nicknameUniqueSchema = fs.readFileSync(nicknameUniquePath, 'utf8');
      await pool.query(nicknameUniqueSchema);
      console.log('Nickname unique constraint added');
    }
    
    // Add performance indexes
    const performanceIndexesPath = path.join(__dirname, 'add-performance-indexes.sql');
    if (fs.existsSync(performanceIndexesPath)) {
      const performanceIndexesSchema = fs.readFileSync(performanceIndexesPath, 'utf8');
      await pool.query(performanceIndexesSchema);
      console.log('Performance indexes added');
    }
    
    // Migrate avatar storage to filesystem
    const avatarMigrationPath = path.join(__dirname, 'migrate-avatar-to-filesystem.sql');
    if (fs.existsSync(avatarMigrationPath)) {
      const avatarMigrationSchema = fs.readFileSync(avatarMigrationPath, 'utf8');
      await pool.query(avatarMigrationSchema);
      console.log('Avatar filesystem migration completed');
    }
    
    // Remove custom_avatar field migration
    const removeCustomAvatarPath = path.join(__dirname, 'remove-custom-avatar-field.sql');
    if (fs.existsSync(removeCustomAvatarPath)) {
      const removeCustomAvatarSchema = fs.readFileSync(removeCustomAvatarPath, 'utf8');
      await pool.query(removeCustomAvatarSchema);
      console.log('Removed custom_avatar field from users table');
    }
    
    // Add avatar missing count field
    const avatarMissingCountPath = path.join(__dirname, 'add-avatar-missing-count.sql');
    if (fs.existsSync(avatarMissingCountPath)) {
      const avatarMissingCountSchema = fs.readFileSync(avatarMissingCountPath, 'utf8');
      await pool.query(avatarMissingCountSchema);
      console.log('Added avatar_missing_count field to users table');
    }
    
    // Update shared POI system
    const updateSharedPOIPath = path.join(__dirname, 'update-shared-poi-system.sql');
    if (fs.existsSync(updateSharedPOIPath)) {
      const updateSharedPOISchema = fs.readFileSync(updateSharedPOIPath, 'utf8');
      await pool.query(updateSharedPOISchema);
      console.log('Updated shared POI system with persistent codes');
    }
    
    // Clean up old share system
    const cleanupOldSharePath = path.join(__dirname, 'cleanup-old-share-system.sql');
    if (fs.existsSync(cleanupOldSharePath)) {
      const cleanupOldShareSchema = fs.readFileSync(cleanupOldSharePath, 'utf8');
      await pool.query(cleanupOldShareSchema);
      console.log('Cleaned up old share system components');
    }
    
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