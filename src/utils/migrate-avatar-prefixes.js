import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migrate existing avatar files to include environment prefix
 */
async function migrateAvatarPrefixes() {
  // Check multiple environment indicators
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.RAILWAY_ENVIRONMENT === 'production' ||
                      process.env.RENDER_SERVICE_NAME ||
                      process.env.HEROKU_APP_NAME ||
                      (process.env.PORT && process.env.PORT !== '4173');
  
  const envPrefix = isProduction ? 'prod' : 'dev';
  const avatarsDir = path.join(__dirname, '../../public/avatars');
  
  console.log(`Starting avatar prefix migration for ${envPrefix} environment (NODE_ENV=${process.env.NODE_ENV})...`);
  
  try {
    // Read all files in avatars directory
    const files = await fs.readdir(avatarsDir);
    const avatarFiles = files.filter(f => 
      f.match(/^\d+_\d+\.(jpg|jpeg|png|gif|webp)$/) // Files without prefix
    );
    
    console.log(`Found ${avatarFiles.length} avatar files without environment prefix`);
    
    let migrated = 0;
    let updated = 0;
    
    for (const oldFilename of avatarFiles) {
      const newFilename = `${envPrefix}_${oldFilename}`;
      const oldPath = path.join(avatarsDir, oldFilename);
      const newPath = path.join(avatarsDir, newFilename);
      
      try {
        // Rename the file
        await fs.rename(oldPath, newPath);
        migrated++;
        console.log(`Renamed: ${oldFilename} -> ${newFilename}`);
        
        // Update database if this file is referenced
        const result = await pool.query(
          'UPDATE users SET avatar_filename = $1 WHERE avatar_filename = $2 RETURNING id',
          [newFilename, oldFilename]
        );
        
        if (result.rowCount > 0) {
          updated++;
          console.log(`Updated database for user ${result.rows[0].id}`);
        }
      } catch (error) {
        console.error(`Failed to migrate ${oldFilename}:`, error.message);
      }
    }
    
    console.log(`Migration complete: ${migrated} files renamed, ${updated} database records updated`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (process.argv[1] === __filename) {
  migrateAvatarPrefixes()
    .then(() => {
      console.log('Avatar prefix migration completed successfully');
      pool.end();
    })
    .catch((error) => {
      console.error('Avatar prefix migration failed:', error);
      pool.end();
      process.exit(1);
    });
}

export default migrateAvatarPrefixes;