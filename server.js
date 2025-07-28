import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import pool from './src/db/database.js';
import migrate from './src/db/migrate.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// Initialize database on startup
async function initializeDatabase() {
  try {
    // Run migrations if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      console.log('Initializing database...');
      await migrate();
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// API Routes

// Get all maps
app.get('/api/maps', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maps ORDER BY display_order');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
});

// Get map with all its data
app.get('/api/maps/:id', async (req, res) => {
  try {
    const mapId = req.params.id;
    
    // Get map details
    const mapResult = await pool.query('SELECT * FROM maps WHERE id = $1', [mapId]);
    if (mapResult.rows.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    // Get POIs
    const poisResult = await pool.query('SELECT * FROM pois WHERE map_id = $1', [mapId]);
    
    // Get connections
    const connectionsResult = await pool.query(`
      SELECT c.*, 
        fp.name as from_poi_name, fp.x as from_x, fp.y as from_y,
        tp.name as to_poi_name, tp.x as to_x, tp.y as to_y
      FROM connections c
      JOIN pois fp ON c.from_poi_id = fp.id
      JOIN pois tp ON c.to_poi_id = tp.id
      WHERE fp.map_id = $1 OR tp.map_id = $1
    `, [mapId]);
    
    // Get point connectors
    const pointConnectorsResult = await pool.query('SELECT * FROM point_connectors WHERE map_id = $1', [mapId]);
    
    // Get zone connectors for this map
    const zoneConnectorsResult = await pool.query(`
      SELECT zc.*, fm.name as from_map_name, tm.name as to_map_name
      FROM zone_connectors zc
      JOIN maps fm ON zc.from_map_id = fm.id
      JOIN maps tm ON zc.to_map_id = tm.id
      WHERE zc.from_map_id = $1 OR zc.to_map_id = $1
    `, [mapId]);
    
    res.json({
      ...mapResult.rows[0],
      pois: poisResult.rows,
      connections: connectionsResult.rows,
      pointConnectors: pointConnectorsResult.rows,
      zoneConnectors: zoneConnectorsResult.rows
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// Create/Update map
app.post('/api/maps', async (req, res) => {
  try {
    const { id, name, image_url, width, height, display_order } = req.body;
    
    if (id) {
      // Update existing map
      const result = await pool.query(
        'UPDATE maps SET name = $1, image_url = $2, width = $3, height = $4, display_order = $5 WHERE id = $6 RETURNING *',
        [name, image_url, width, height, display_order, id]
      );
      res.json(result.rows[0]);
    } else {
      // Create new map
      const result = await pool.query(
        'INSERT INTO maps (name, image_url, width, height, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, image_url, width, height, display_order]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ error: 'Failed to save map' });
  }
});

// Delete map
app.delete('/api/maps/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM maps WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// Save POI
app.post('/api/pois', async (req, res) => {
  try {
    const { id, map_id, name, x, y, icon, icon_size, label_visible, label_position, custom_icon } = req.body;
    
    if (id) {
      // Update existing POI
      const result = await pool.query(
        `UPDATE pois SET name = $1, x = $2, y = $3, icon = $4, icon_size = $5, 
         label_visible = $6, label_position = $7, custom_icon = $8 WHERE id = $9 RETURNING *`,
        [name, x, y, icon, icon_size, label_visible, label_position, custom_icon, id]
      );
      res.json(result.rows[0]);
    } else {
      // Create new POI
      const result = await pool.query(
        `INSERT INTO pois (map_id, name, x, y, icon, icon_size, label_visible, label_position, custom_icon) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [map_id, name, x, y, icon, icon_size, label_visible, label_position, custom_icon]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving POI:', error);
    res.status(500).json({ error: 'Failed to save POI' });
  }
});

// Delete POI
app.delete('/api/pois/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pois WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting POI:', error);
    res.status(500).json({ error: 'Failed to delete POI' });
  }
});

// Save connection
app.post('/api/connections', async (req, res) => {
  try {
    const { from_poi_id, to_poi_id, bidirectional } = req.body;
    
    const result = await pool.query(
      `INSERT INTO connections (from_poi_id, to_poi_id, bidirectional) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (from_poi_id, to_poi_id) 
       DO UPDATE SET bidirectional = $3 
       RETURNING *`,
      [from_poi_id, to_poi_id, bidirectional]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving connection:', error);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// More endpoints can be added for point_connectors and zone_connectors...

// Handle all other routes by serving index.html (for Vue Router)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});