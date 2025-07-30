import { fileURLToPath } from 'url';
import pool from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Quick fix for avatar extension mismatches
 * Updates database to use .jpg for all avatars
 */
async function fixAvatarExtensions() {
  console.log('Fixing avatar extensions in database...');
  
  try {
    // Update all .png avatars to .jpg
    const result = await pool.query(`
      UPDATE users 
      SET avatar_filename = REPLACE(avatar_filename, '.png', '.jpg')
      WHERE avatar_filename LIKE '%.png'
      RETURNING id, avatar_filename
    `);
    
    console.log(`Updated ${result.rowCount} avatar filenames from .png to .jpg`);
    
    if (result.rows.length > 0) {
      console.log('Updated records:');
      result.rows.forEach(row => {
        console.log(`  User ${row.id}: ${row.avatar_filename}`);
      });
    }
    
  } catch (error) {
    console.error('Error fixing avatar extensions:', error);
    throw error;
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  fixAvatarExtensions()
    .then(() => {
      console.log('Avatar extension fix completed');
      pool.end();
    })
    .catch((error) => {
      console.error('Avatar extension fix failed:', error);
      pool.end();
      process.exit(1);
    });
}

export default fixAvatarExtensions;