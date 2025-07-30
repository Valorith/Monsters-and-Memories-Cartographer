import pool from './database.js';
import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateAvatarsToFiles() {
  console.log('Starting avatar migration from database to filesystem...');
  
  try {
    // Get all users with base64 avatars
    const result = await pool.query(
      'SELECT id, custom_avatar FROM users WHERE custom_avatar IS NOT NULL AND avatar_filename IS NULL'
    );
    
    console.log(`Found ${result.rows.length} avatars to migrate`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const user of result.rows) {
      try {
        // Extract base64 data from data URL
        const matches = user.custom_avatar.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`User ${user.id}: Invalid avatar format, skipping`);
          failed++;
          continue;
        }
        
        const [, mimeType, base64Data] = matches;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine file extension
        const mimeToExt = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp'
        };
        const extension = mimeToExt[mimeType] || 'jpg';
        
        // Generate filename
        const filename = `${user.id}_${Date.now()}.${extension}`;
        const filepath = join(__dirname, '../../public/avatars', filename);
        
        // Save file
        await fs.writeFile(filepath, buffer);
        
        // Update database
        await pool.query(
          'UPDATE users SET avatar_filename = $1, avatar_version = 1 WHERE id = $2',
          [filename, user.id]
        );
        
        migrated++;
        console.log(`Migrated avatar for user ${user.id}`);
      } catch (error) {
        console.error(`Failed to migrate avatar for user ${user.id}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\nMigration complete!`);
    console.log(`Successfully migrated: ${migrated}`);
    console.log(`Failed: ${failed}`);
    
    if (migrated > 0) {
      console.log('\nYou can now drop the custom_avatar column with:');
      console.log('ALTER TABLE users DROP COLUMN custom_avatar;');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (process.argv[1] === __filename) {
  migrateAvatarsToFiles();
}

export default migrateAvatarsToFiles;