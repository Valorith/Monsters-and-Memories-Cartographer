import fs from 'fs/promises';
import path from 'path';
import pool from '../db/database.js';

/**
 * Clean up orphaned avatar files that are no longer referenced in the database
 * Also removes old versions of avatars, keeping only the latest version
 */
export async function cleanupOrphanedAvatars(avatarsDir) {
  console.log('Starting avatar cleanup...');
  
  try {
    // Get all avatar filenames currently in use
    const result = await pool.query(
      'SELECT id, avatar_filename FROM users WHERE avatar_filename IS NOT NULL'
    );
    
    const activeAvatars = new Set(result.rows.map(row => row.avatar_filename));
    const userToCurrentAvatar = new Map(result.rows.map(row => [row.id, row.avatar_filename]));
    console.log(`Found ${activeAvatars.size} active avatars in database`);
    
    // Read all files in avatars directory
    const files = await fs.readdir(avatarsDir);
    const avatarFiles = files.filter(f => 
      f.match(/^\d+_\d+\.(jpg|jpeg|png|gif|webp)$/) && f !== '.gitkeep'
    );
    
    console.log(`Found ${avatarFiles.length} avatar files on disk`);
    
    // Group files by user ID
    const filesByUser = new Map();
    for (const file of avatarFiles) {
      const match = file.match(/^(\d+)_(\d+)\.(jpg|jpeg|png|gif|webp)$/);
      if (match) {
        const userId = parseInt(match[1]);
        const timestamp = parseInt(match[2]);
        if (!filesByUser.has(userId)) {
          filesByUser.set(userId, []);
        }
        filesByUser.get(userId).push({ file, timestamp });
      }
    }
    
    // Find files to delete (orphaned + old versions)
    const filesToDelete = [];
    
    // Check each user's files
    for (const [userId, userFiles] of filesByUser) {
      const currentAvatar = userToCurrentAvatar.get(userId);
      
      if (!currentAvatar) {
        // User has no avatar in DB, all files are orphaned
        filesToDelete.push(...userFiles.map(f => f.file));
      } else {
        // User has an avatar, delete all except the current one
        for (const fileInfo of userFiles) {
          if (fileInfo.file !== currentAvatar) {
            filesToDelete.push(fileInfo.file);
          }
        }
      }
    }
    
    console.log(`Found ${filesToDelete.length} files to delete (orphaned + old versions)`);
    
    // Delete the files
    let deleted = 0;
    for (const file of filesToDelete) {
      try {
        await fs.unlink(path.join(avatarsDir, file));
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error.message);
      }
    }
    
    console.log(`Deleted ${deleted} avatar files`);
    return { orphaned: filesToDelete.length, deleted };
    
  } catch (error) {
    console.error('Avatar cleanup failed:', error);
    throw error;
  }
}

/**
 * Delete all avatar files for a specific user
 */
export async function deleteAllUserAvatars(avatarsDir, userId) {
  try {
    const files = await fs.readdir(avatarsDir);
    const userAvatarFiles = files.filter(f => 
      f.match(new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`))
    );
    
    console.log(`Found ${userAvatarFiles.length} avatar files for user ${userId}`);
    
    let deleted = 0;
    for (const file of userAvatarFiles) {
      try {
        await fs.unlink(path.join(avatarsDir, file));
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error.message);
      }
    }
    
    console.log(`Deleted ${deleted} avatar files for user ${userId}`);
    return { found: userAvatarFiles.length, deleted };
  } catch (error) {
    console.error(`Failed to delete avatars for user ${userId}:`, error);
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