import pool from '../db/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for icon uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/poi-icons');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'poi-type-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 // 1MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export default function poiTypesRouter(app, validateCSRF) {
  // Get all POI types
  app.get('/api/poi-types', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, icon_type, icon_value, display_order, is_default, multi_mob
        FROM poi_types
        ORDER BY display_order, id
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching POI types:', error);
      res.status(500).json({ error: 'Failed to fetch POI types' });
    }
  });

  // Create new POI type (admin only)
  app.post('/api/poi-types', validateCSRF, async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, icon_type, icon_value, display_order, multi_mob } = req.body;

    if (!name || !icon_type || !icon_value) {
      return res.status(400).json({ error: 'Name, icon type, and icon value are required' });
    }

    try {
      const result = await pool.query(`
        INSERT INTO poi_types (name, icon_type, icon_value, display_order, multi_mob)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, icon_type, icon_value, display_order, is_default, multi_mob
      `, [name, icon_type, icon_value, display_order || 0, multi_mob || false]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating POI type:', error);
      console.error('Error details:', {
        name,
        icon_type,
        icon_value,
        display_order,
        error_code: error.code,
        error_detail: error.detail
      });
      if (error.code === '23505') { // Unique violation
        res.status(400).json({ error: 'POI type with this name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create POI type: ' + error.message });
      }
    }
  });

  // Update POI type (admin only)
  app.put('/api/poi-types/:id', validateCSRF, async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, icon_type, icon_value, display_order, multi_mob } = req.body;

    try {
      const result = await pool.query(`
        UPDATE poi_types
        SET name = COALESCE($1, name),
            icon_type = COALESCE($2, icon_type),
            icon_value = COALESCE($3, icon_value),
            display_order = COALESCE($4, display_order),
            multi_mob = COALESCE($5, multi_mob),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, name, icon_type, icon_value, display_order, is_default, multi_mob
      `, [name, icon_type, icon_value, display_order, multi_mob, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'POI type not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating POI type:', error);
      res.status(500).json({ error: 'Failed to update POI type' });
    }
  });

  // Delete POI type (admin only)
  app.delete('/api/poi-types/:id', validateCSRF, async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    try {
      // Check if this is the default type
      const checkDefault = await pool.query(
        'SELECT is_default FROM poi_types WHERE id = $1',
        [id]
      );

      if (checkDefault.rows.length > 0 && checkDefault.rows[0].is_default) {
        return res.status(400).json({ error: 'Cannot delete the default POI type' });
      }

      // Check if any POIs are using this type
      const checkUsage = await pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT 1 FROM pois WHERE type_id = $1
          UNION ALL
          SELECT 1 FROM custom_pois WHERE type_id = $1
          UNION ALL
          SELECT 1 FROM pending_pois WHERE type_id = $1
        ) as usage
      `, [id]);

      if (parseInt(checkUsage.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete POI type that is in use. Please reassign POIs first.' 
        });
      }

      // Delete associated uploaded icon if exists
      const iconResult = await pool.query(
        'SELECT filename FROM poi_type_icons WHERE type_id = $1',
        [id]
      );

      if (iconResult.rows.length > 0) {
        const iconPath = path.join(__dirname, '../../public/poi-icons', iconResult.rows[0].filename);
        try {
          await fs.unlink(iconPath);
        } catch (error) {
          console.error('Error deleting icon file:', error);
        }
      }

      await pool.query('DELETE FROM poi_types WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting POI type:', error);
      res.status(500).json({ error: 'Failed to delete POI type' });
    }
  });

  // Set default POI type (admin only)
  app.put('/api/poi-types/:id/set-default', async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    try {
      await pool.query('BEGIN');

      // Remove current default
      await pool.query('UPDATE poi_types SET is_default = false WHERE is_default = true');

      // Set new default
      const result = await pool.query(`
        UPDATE poi_types 
        SET is_default = true, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
        RETURNING id, name, icon_type, icon_value, display_order, is_default, multi_mob
      `, [id]);

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'POI type not found' });
      }

      await pool.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error setting default POI type:', error);
      res.status(500).json({ error: 'Failed to set default POI type' });
    }
  });

  // Upload icon for POI type (admin only)
  app.post('/api/poi-types/:id/upload-icon', upload.single('icon'), async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No icon file provided' });
    }

    try {
      // Delete old icon if exists
      const oldIcon = await pool.query(
        'SELECT filename FROM poi_type_icons WHERE type_id = $1',
        [id]
      );

      if (oldIcon.rows.length > 0) {
        const oldPath = path.join(__dirname, '../../public/poi-icons', oldIcon.rows[0].filename);
        try {
          await fs.unlink(oldPath);
        } catch (error) {
          console.error('Error deleting old icon:', error);
        }
      }

      // Store new icon info
      await pool.query(`
        INSERT INTO poi_type_icons (type_id, filename, original_name, mime_type, size)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (type_id) DO UPDATE
        SET filename = $2, original_name = $3, mime_type = $4, size = $5, uploaded_at = CURRENT_TIMESTAMP
      `, [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]);

      // Update POI type to use uploaded icon
      const iconUrl = `/poi-icons/${req.file.filename}`;
      await pool.query(`
        UPDATE poi_types 
        SET icon_type = 'upload', icon_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [iconUrl, id]);

      res.json({ 
        success: true, 
        icon_url: iconUrl 
      });
    } catch (error) {
      console.error('Error uploading icon:', error);
      res.status(500).json({ error: 'Failed to upload icon' });
    }
  });

  // Reorder POI types (admin only)
  app.put('/api/poi-types/reorder', validateCSRF, async (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { order } = req.body; // Array of { id, display_order }

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    try {
      await pool.query('BEGIN');

      for (const item of order) {
        await pool.query(
          'UPDATE poi_types SET display_order = $1 WHERE id = $2',
          [item.display_order, item.id]
        );
      }

      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error reordering POI types:', error);
      res.status(500).json({ error: 'Failed to reorder POI types' });
    }
  });
}