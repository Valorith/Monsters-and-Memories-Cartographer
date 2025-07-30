import fs from 'fs/promises';
import path from 'path';
import pool from '../db/database.js';

/**
 * Clean up orphaned avatar files that are no longer referenced in the database
 */
export async function cleanupOrphanedAvatars(avatarsDir) {
  console.log('Starting avatar cleanup...');
  
  try {
    // Get all avatar filenames currently in use
    const result = await pool.query(
      'SELECT avatar_filename FROM users WHERE avatar_filename IS NOT NULL'
    );
    
    const activeAvatars = new Set(result.rows.map(row => row.avatar_filename));
    console.log(`Found ${activeAvatars.size} active avatars in database`);
    
    // Read all files in avatars directory
    const files = await fs.readdir(avatarsDir);
    const avatarFiles = files.filter(f => 
      f.match(/^\d+_\d+\.(jpg|jpeg|png|gif|webp)$/) && f !== '.gitkeep'
    );
    
    console.log(`Found ${avatarFiles.length} avatar files on disk`);
    
    // Find orphaned files
    const orphaned = avatarFiles.filter(file => !activeAvatars.has(file));
    console.log(`Found ${orphaned.length} orphaned avatar files`);
    
    // Delete orphaned files
    let deleted = 0;
    for (const file of orphaned) {
      try {
        await fs.unlink(path.join(avatarsDir, file));
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error.message);
      }
    }
    
    console.log(`Deleted ${deleted} orphaned avatar files`);
    return { orphaned: orphaned.length, deleted };
    
  } catch (error) {
    console.error('Avatar cleanup failed:', error);
    throw error;
  }
}

/**
 * Schedule periodic cleanup of orphaned avatars
 */
export function scheduleAvatarCleanup(avatarsDir, intervalHours = 24) {
  // Run cleanup on startup
  cleanupOrphanedAvatars(avatarsDir).catch(console.error);
  
  // Schedule periodic cleanup
  setInterval(() => {
    cleanupOrphanedAvatars(avatarsDir).catch(console.error);
  }, intervalHours * 60 * 60 * 1000);
  
  console.log(`Avatar cleanup scheduled every ${intervalHours} hours`);
}