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
      
      // Check if core tables exist
      const coreTableNames = ['maps', 'pois', 'connections', 'point_connectors', 'zone_connectors'];
      const existingTableNames = existingTables.rows.map(r => r.table_name);
      const hasCoreTables = coreTableNames.every(table => existingTableNames.includes(table));
      
      if (hasCoreTables) {
        console.log('Core tables already exist, skipping schema.sql');
      } else {
        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Executing schema.sql...');
        try {
          await pool.query(schema);
          console.log('Schema.sql completed');
        } catch (error) {
          console.error('Error executing schema.sql:', error.message);
          if (error.position) {
            const position = parseInt(error.position);
            const nearError = schema.substring(Math.max(0, position - 50), position + 50);
            console.error('Error near:', nearError);
          }
          throw error;
        }
      }
    } else {
      // No tables exist, run schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      console.log('Executing schema.sql...');
      try {
        await pool.query(schema);
        console.log('Schema.sql completed');
      } catch (error) {
        console.error('Error executing schema.sql:', error.message);
        throw error;
      }
    }
    
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
      try {
        console.log('Running custom POIs table migration...');
        const customPoisSchema = fs.readFileSync(customPoisSchemaPath, 'utf8');
        await pool.query(customPoisSchema);
        console.log('Custom POIs table migration completed');
      } catch (error) {
        console.error('Error in custom POIs migration:', error.message);
        // Skip this migration if it fails (table might already exist)
      }
    }
    
    // Execute the share code update migration
    const shareCodePath = path.join(__dirname, 'update-share-code.sql');
    if (fs.existsSync(shareCodePath)) {
      try {
        console.log('Running share code migration...');
        const shareCodeSchema = fs.readFileSync(shareCodePath, 'utf8');
        await pool.query(shareCodeSchema);
        console.log('Share code migration completed');
      } catch (error) {
        console.error('Error in share code migration:', error.message);
      }
    }
    
    // Execute the XP field migration
    const xpFieldPath = path.join(__dirname, 'add-xp-field.sql');
    if (fs.existsSync(xpFieldPath)) {
      try {
        console.log('Running XP field migration...');
        const xpFieldSchema = fs.readFileSync(xpFieldPath, 'utf8');
        await pool.query(xpFieldSchema);
        console.log('XP field migration completed');
      } catch (error) {
        console.error('Error in XP field migration:', error.message);
      }
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
    
    // Add avatar dev tracking for shared DB scenarios
    const avatarDevTrackingPath = path.join(__dirname, 'add-avatar-dev-tracking.sql');
    if (fs.existsSync(avatarDevTrackingPath)) {
      const avatarDevTrackingSchema = fs.readFileSync(avatarDevTrackingPath, 'utf8');
      await pool.query(avatarDevTrackingSchema);
      console.log('Added avatar development environment tracking');
    }
    
    // Create POI types table
    const poiTypesPath = path.join(__dirname, 'create-poi-types-table.sql');
    if (fs.existsSync(poiTypesPath)) {
      const poiTypesSchema = fs.readFileSync(poiTypesPath, 'utf8');
      await pool.query(poiTypesSchema);
      console.log('POI types table created and existing POIs migrated');
    }
    
    // Add multi_mob column to POI types
    const multiMobPath = path.join(__dirname, 'add-multi-mob-column.sql');
    if (fs.existsSync(multiMobPath)) {
      try {
        const multiMobSchema = fs.readFileSync(multiMobPath, 'utf8');
        await pool.query(multiMobSchema);
        console.log('Added multi_mob column to POI types');
      } catch (error) {
        console.error('Error adding multi_mob column:', error.message);
        // Continue - column might already exist
      }
    }
    
    // Create POI-NPC associations tables
    const poiNpcAssociationsPath = path.join(__dirname, 'create-poi-npc-associations-table.sql');
    if (fs.existsSync(poiNpcAssociationsPath)) {
      try {
        const poiNpcAssociationsSchema = fs.readFileSync(poiNpcAssociationsPath, 'utf8');
        await pool.query(poiNpcAssociationsSchema);
        console.log('POI-NPC associations tables created');
      } catch (error) {
        console.error('Error creating POI-NPC associations:', error.message);
        // Continue - tables might already exist
      }
    }
    
    // Update POI types to support Iconify
    const updatePoiTypesIconifyPath = path.join(__dirname, 'update-poi-types-iconify.sql');
    if (fs.existsSync(updatePoiTypesIconifyPath)) {
      const updatePoiTypesIconifySchema = fs.readFileSync(updatePoiTypesIconifyPath, 'utf8');
      await pool.query(updatePoiTypesIconifySchema);
      console.log('POI types updated to support Iconify icons');
    }
    
    // Remove icon_size from custom POIs for consistent sizing
    const removeCustomPoiIconSizePath = path.join(__dirname, 'remove-custom-poi-icon-size.sql');
    if (fs.existsSync(removeCustomPoiIconSizePath)) {
      const removeCustomPoiIconSizeSchema = fs.readFileSync(removeCustomPoiIconSizePath, 'utf8');
      await pool.query(removeCustomPoiIconSizeSchema);
      console.log('Removed icon_size from custom POIs for consistent sizing');
    }
    
    // Create items table
    const createItemsTablePath = path.join(__dirname, 'create-items-table.sql');
    if (fs.existsSync(createItemsTablePath)) {
      const createItemsTableSchema = fs.readFileSync(createItemsTablePath, 'utf8');
      await pool.query(createItemsTableSchema);
      console.log('Items table created');
    }
    
    // Add AC field to items table
    const addAcPath = path.join(__dirname, 'add-ac-to-items.sql');
    if (fs.existsSync(addAcPath)) {
      const addAcSchema = fs.readFileSync(addAcPath, 'utf8');
      await pool.query(addAcSchema);
      console.log('Added AC field to items table');
    }
    
    // Remove dropped_by from items table (moved to NPC table)
    const removeDroppedByPath = path.join(__dirname, 'remove-dropped-by-from-items.sql');
    if (fs.existsSync(removeDroppedByPath)) {
      const removeDroppedBySchema = fs.readFileSync(removeDroppedByPath, 'utf8');
      await pool.query(removeDroppedBySchema);
      console.log('Removed dropped_by from items table (will be in NPC table instead)');
    }
    
    // Add resistances, weight, and size to items
    const addResistancesPath = path.join(__dirname, 'add-resistances-weight-size-to-items.sql');
    if (fs.existsSync(addResistancesPath)) {
      const addResistancesSchema = fs.readFileSync(addResistancesPath, 'utf8');
      await pool.query(addResistancesSchema);
      console.log('Added resistances, weight, and size fields to items table');
    }
    
    // Add skill to items
    const addSkillPath = path.join(__dirname, 'add-skill-to-items.sql');
    if (fs.existsSync(addSkillPath)) {
      const addSkillSchema = fs.readFileSync(addSkillPath, 'utf8');
      await pool.query(addSkillSchema);
      console.log('Added skill field to items table');
    }
    
    // Add damage and delay to items
    const addDamageDelayPath = path.join(__dirname, 'add-damage-delay-to-items.sql');
    if (fs.existsSync(addDamageDelayPath)) {
      const addDamageDelaySchema = fs.readFileSync(addDamageDelayPath, 'utf8');
      await pool.query(addDamageDelaySchema);
      console.log('Added damage and delay fields to items table');
    }
    
    // Add race and class to items
    const addRaceClassPath = path.join(__dirname, 'add-race-class-to-items.sql');
    if (fs.existsSync(addRaceClassPath)) {
      const addRaceClassSchema = fs.readFileSync(addRaceClassPath, 'utf8');
      await pool.query(addRaceClassSchema);
      console.log('Added race and class fields to items table');
    }
    
    // Create NPCs table
    const createNpcsTablePath = path.join(__dirname, 'create-npcs-table.sql');
    if (fs.existsSync(createNpcsTablePath)) {
      const createNpcsTableSchema = fs.readFileSync(createNpcsTablePath, 'utf8');
      await pool.query(createNpcsTableSchema);
      console.log('NPCs table created');
    }
    
    // Add npcid column to NPCs table
    const addNpcIdPath = path.join(__dirname, 'add-npcid-to-npcs.sql');
    if (fs.existsSync(addNpcIdPath)) {
      const addNpcIdSchema = fs.readFileSync(addNpcIdPath, 'utf8');
      await pool.query(addNpcIdSchema);
      console.log('Added npcid column to NPCs table');
    }
    
    // Add npc_id and item_id to POIs tables
    const addNpcItemIdsToPoisPath = path.join(__dirname, 'add-npc-item-ids-to-pois.sql');
    if (fs.existsSync(addNpcItemIdsToPoisPath)) {
      const addNpcItemIdsToPoisSchema = fs.readFileSync(addNpcItemIdsToPoisPath, 'utf8');
      await pool.query(addNpcItemIdsToPoisSchema);
      console.log('Added npc_id and item_id columns to POIs tables');
    }
    
    // Create change proposals table for voting system
    const changeProposalsPath = path.join(__dirname, 'create-change-proposals-table.sql');
    if (fs.existsSync(changeProposalsPath)) {
      const changeProposalsSchema = fs.readFileSync(changeProposalsPath, 'utf8');
      await pool.query(changeProposalsSchema);
      console.log('Created change proposals voting system tables');
    }
    
    // Migrate pending POIs to change proposals
    const migratePendingPoisPath = path.join(__dirname, 'migrate-pending-pois-to-change-proposals.sql');
    if (fs.existsSync(migratePendingPoisPath)) {
      const migratePendingPoisSchema = fs.readFileSync(migratePendingPoisPath, 'utf8');
      await pool.query(migratePendingPoisSchema);
      console.log('Migrated pending POIs to change proposals system');
    }
    
    // Optimize change proposals for performance
    const optimizeProposalsPath = path.join(__dirname, 'optimize-change-proposals.sql');
    if (fs.existsSync(optimizeProposalsPath)) {
      const optimizeProposalsSchema = fs.readFileSync(optimizeProposalsPath, 'utf8');
      await pool.query(optimizeProposalsSchema);
      console.log('Optimized change proposals system for performance');
    }
    
    // Add shared POI invalidation reason tracking
    const sharedPoiInvalidationPath = path.join(__dirname, 'add-shared-poi-invalidation-reason.sql');
    if (fs.existsSync(sharedPoiInvalidationPath)) {
      const sharedPoiInvalidationSchema = fs.readFileSync(sharedPoiInvalidationPath, 'utf8');
      await pool.query(sharedPoiInvalidationSchema);
      console.log('Added shared POI invalidation reason tracking');
    }
    
    // Add vote XP config
    const voteXpConfigPath = path.join(__dirname, 'add-vote-xp-config.sql');
    if (fs.existsSync(voteXpConfigPath)) {
      const voteXpConfigSchema = fs.readFileSync(voteXpConfigPath, 'utf8');
      await pool.query(voteXpConfigSchema);
      console.log('Vote XP config migration completed');
    }
    
    // Create donations table for Ko-fi integration
    const donationsTablePath = path.join(__dirname, 'create-donations-table.sql');
    if (fs.existsSync(donationsTablePath)) {
      const donationsTableSchema = fs.readFileSync(donationsTablePath, 'utf8');
      await pool.query(donationsTableSchema);
      console.log('Donations table created for Ko-fi integration');
    }
    
    // Create donation tiers table
    const donationTiersPath = path.join(__dirname, 'create-donation-tiers-table.sql');
    if (fs.existsSync(donationTiersPath)) {
      try {
        const donationTiersSchema = fs.readFileSync(donationTiersPath, 'utf8');
        await pool.query(donationTiersSchema);
        console.log('Donation tiers table migration completed');
      } catch (error) {
        console.error('Error in donation tiers migration:', error.message);
      }
    }
    
    // Add donation delete trigger
    const donationDeleteTriggerPath = path.join(__dirname, 'add-donation-delete-trigger.sql');
    if (fs.existsSync(donationDeleteTriggerPath)) {
      try {
        const donationDeleteTriggerSchema = fs.readFileSync(donationDeleteTriggerPath, 'utf8');
        await pool.query(donationDeleteTriggerSchema);
        console.log('Donation delete trigger added');
      } catch (error) {
        console.error('Error adding donation delete trigger:', error.message);
      }
    }
    
    // Add donation unmatch trigger
    const donationUnmatchTriggerPath = path.join(__dirname, 'add-donation-unmatch-trigger.sql');
    if (fs.existsSync(donationUnmatchTriggerPath)) {
      try {
        const donationUnmatchTriggerSchema = fs.readFileSync(donationUnmatchTriggerPath, 'utf8');
        await pool.query(donationUnmatchTriggerSchema);
        console.log('Donation unmatch trigger added');
      } catch (error) {
        console.error('Error adding donation unmatch trigger:', error.message);
      }
    }
    
    // Update donation matching function
    const updateDonationMatchingPath = path.join(__dirname, 'update-donation-matching.sql');
    if (fs.existsSync(updateDonationMatchingPath)) {
      try {
        const updateDonationMatchingSchema = fs.readFileSync(updateDonationMatchingPath, 'utf8');
        await pool.query(updateDonationMatchingSchema);
        console.log('Donation matching function updated');
      } catch (error) {
        console.error('Error updating donation matching:', error.message);
      }
    }
    
    // Create URL mappings table
    const urlMappingsPath = path.join(__dirname, 'create-url-mappings-table.sql');
    if (fs.existsSync(urlMappingsPath)) {
      try {
        const urlMappingsSchema = fs.readFileSync(urlMappingsPath, 'utf8');
        await pool.query(urlMappingsSchema);
        console.log('URL mappings table created');
      } catch (error) {
        console.error('Error creating URL mappings table:', error.message);
      }
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