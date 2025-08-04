import pool from '../db/database.js';

export default function itemsRouter(app, validateCSRF) {
  // Middleware to check if user is admin
  const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated() || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // GET /api/items - Get all items
  app.get('/api/items', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          id, name, icon_type, icon_value,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, health, mana, ac,
          item_type, slot, description,
          created_at, updated_at
        FROM items
        ORDER BY name ASC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  // GET /api/items/:id - Get single item by ID
  app.get('/api/items/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT 
          id, name, icon_type, icon_value,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, health, mana, ac,
          item_type, slot, description,
          created_at, updated_at
        FROM items
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching item:', error);
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  });

  // POST /api/items - Create new item (Admin only)
  app.post('/api/items', requireAdmin, validateCSRF, async (req, res) => {
    try {
      const {
        name, icon_type, icon_value,
        str, sta, agi, dex, wis, int, cha,
        attack_speed, health, mana, ac,
        item_type, slot, description
      } = req.body;
      
      // Validate required fields
      if (!name || !icon_type || !icon_value) {
        return res.status(400).json({ error: 'Name and icon are required' });
      }
      
      const result = await pool.query(`
        INSERT INTO items (
          name, icon_type, icon_value,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, health, mana, ac,
          item_type, slot, description,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        name, icon_type, icon_value,
        str || 0, sta || 0, agi || 0, dex || 0, wis || 0, int || 0, cha || 0,
        attack_speed || 0, health || 0, mana || 0, ac || 0,
        item_type, slot, description,
        req.user.id, req.user.id
      ]);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating item:', error);
      if (error.constraint === 'items_name_key') {
        res.status(400).json({ error: 'An item with this name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create item' });
      }
    }
  });

  // PUT /api/items/:id - Update item (Admin only)
  app.put('/api/items/:id', requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, icon_type, icon_value,
        str, sta, agi, dex, wis, int, cha,
        attack_speed, health, mana, ac,
        item_type, slot, description
      } = req.body;
      
      const result = await pool.query(`
        UPDATE items SET
          name = $2, icon_type = $3, icon_value = $4,
          str = $5, sta = $6, agi = $7, dex = $8, 
          wis = $9, int = $10, cha = $11,
          attack_speed = $12, health = $13, mana = $14, ac = $15,
          item_type = $16, slot = $17, description = $18,
          updated_by = $19, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        id, name, icon_type, icon_value,
        str || 0, sta || 0, agi || 0, dex || 0, wis || 0, int || 0, cha || 0,
        attack_speed || 0, health || 0, mana || 0, ac || 0,
        item_type, slot, description,
        req.user.id
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating item:', error);
      if (error.constraint === 'items_name_key') {
        res.status(400).json({ error: 'An item with this name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to update item' });
      }
    }
  });

  // DELETE /api/items/:id - Delete item (Admin only)
  app.delete('/api/items/:id', requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'DELETE FROM items WHERE id = $1 RETURNING name',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  // GET /api/items/:id - Get single item
  app.get('/api/items/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'SELECT * FROM items WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching item:', error);
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  });

}