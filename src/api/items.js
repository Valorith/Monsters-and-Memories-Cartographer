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
          attack_speed, health, mana, ac, block,
          resist_cold, resist_corruption, resist_disease, resist_electricity, resist_fire, resist_magic, resist_poison,
          weight, size, skill, damage, delay,
          item_type, slot, slots, description,
          race, class,
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
          attack_speed, health, mana, ac, block,
          resist_cold, resist_corruption, resist_disease, resist_electricity, resist_fire, resist_magic, resist_poison,
          weight, size, skill, damage, delay,
          item_type, slot, slots, description,
          race, class,
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
        attack_speed, health, mana, ac, block,
        resist_cold, resist_corruption, resist_disease, resist_electricity, 
        resist_fire, resist_magic, resist_poison,
        weight, size, skill, damage, delay,
        item_type, slot, slots, description,
        race, class: itemClass
      } = req.body;
      
      // Validate required fields
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Item name is required' });
      }
      
      if (!icon_type || !icon_value) {
        return res.status(400).json({ error: 'Item icon is required' });
      }
      
      // Handle slots array - if slots provided use it, otherwise convert slot to array
      const slotsArray = slots || (slot ? [slot] : []);
      
      const result = await pool.query(`
        INSERT INTO items (
          name, icon_type, icon_value,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, health, mana, ac, block,
          resist_cold, resist_corruption, resist_disease, resist_electricity,
          resist_fire, resist_magic, resist_poison,
          weight, size, skill, damage, delay,
          item_type, slot, slots, description,
          race, class,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                  $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
        RETURNING *
      `, [
        name, icon_type, icon_value,
        str || 0, sta || 0, agi || 0, dex || 0, wis || 0, int || 0, cha || 0,
        attack_speed || 0, health || 0, mana || 0, ac || 0, block || 0,
        resist_cold || 0, resist_corruption || 0, resist_disease || 0, resist_electricity || 0,
        resist_fire || 0, resist_magic || 0, resist_poison || 0,
        weight || 0.0, size || 'Medium', skill || null, damage || 0, delay || 0,
        item_type, slot, slotsArray, description,
        race || null, itemClass || null,
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
        attack_speed, health, mana, ac, block,
        resist_cold, resist_corruption, resist_disease, resist_electricity, 
        resist_fire, resist_magic, resist_poison,
        weight, size, skill, damage, delay,
        item_type, slot, slots, description,
        race, class: itemClass
      } = req.body;
      
      // Handle slots array - if slots provided use it, otherwise convert slot to array
      const slotsArray = slots || (slot ? [slot] : []);
      
      const result = await pool.query(`
        UPDATE items SET
          name = $2, icon_type = $3, icon_value = $4,
          str = $5, sta = $6, agi = $7, dex = $8, 
          wis = $9, int = $10, cha = $11,
          attack_speed = $12, health = $13, mana = $14, ac = $15, block = $16,
          resist_cold = $17, resist_corruption = $18, resist_disease = $19,
          resist_electricity = $20, resist_fire = $21, resist_magic = $22, resist_poison = $23,
          weight = $24, size = $25, skill = $26, damage = $27, delay = $28,
          item_type = $29, slot = $30, slots = $31, description = $32,
          race = $33, class = $34,
          updated_by = $35, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        id, name, icon_type, icon_value,
        str || 0, sta || 0, agi || 0, dex || 0, wis || 0, int || 0, cha || 0,
        attack_speed || 0, health || 0, mana || 0, ac || 0, block || 0,
        resist_cold || 0, resist_corruption || 0, resist_disease || 0, resist_electricity || 0,
        resist_fire || 0, resist_magic || 0, resist_poison || 0,
        weight || 0.0, size || 'Medium', skill || null, damage || 0, delay || 0,
        item_type, slot, slotsArray, description,
        race || null, itemClass || null,
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

  // POST /api/items/check-existing - Check for existing items by names (Admin only)
  app.post('/api/items/check-existing', requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { names } = req.body;
      
      if (!names || !Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ error: 'No names provided' });
      }
      
      // Get existing items with matching names
      const result = await pool.query(`
        SELECT 
          id, name, icon_type, icon_value,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, health, mana, ac, block,
          resist_cold, resist_corruption, resist_disease, resist_electricity, 
          resist_fire, resist_magic, resist_poison,
          weight, size, skill, damage, delay,
          item_type, slot, slots, description,
          race, class
        FROM items 
        WHERE LOWER(name) = ANY($1)
      `, [names.map(n => n.toLowerCase())]);
      
      // Create a map of existing items by lowercase name
      const existingItems = {};
      result.rows.forEach(item => {
        existingItems[item.name.toLowerCase()] = item;
      });
      
      res.json(existingItems);
    } catch (error) {
      console.error('Error checking existing items:', error);
      res.status(500).json({ error: 'Failed to check existing items' });
    }
  });

  // POST /api/items/batch - Batch insert items (Admin only)
  app.post('/api/items/batch', requireAdmin, validateCSRF, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
      }
      
      // Validate all items first
      const errors = [];
      const validItems = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check required fields
        if (!item.name || item.name.trim() === '') {
          errors.push(`Item ${i + 1}: Name is required`);
          continue;
        }
        
        if (!item.icon_type || !item.icon_value) {
          errors.push(`Item ${i + 1}: Icon is required`);
          continue;
        }
        
        // Check for duplicate names within batch
        const duplicate = validItems.find(v => v.name.toLowerCase() === item.name.toLowerCase());
        if (duplicate) {
          errors.push(`Item ${i + 1}: Duplicate name "${item.name}" in batch`);
          continue;
        }
        
        validItems.push(item);
      }
      
      if (errors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation errors', 
          details: errors 
        });
      }
      
      // Check for existing names in database
      const names = validItems.map(item => item.name.toLowerCase());
      const existingCheck = await client.query(
        'SELECT name FROM items WHERE LOWER(name) = ANY($1)',
        [names]
      );
      
      if (existingCheck.rows.length > 0) {
        const existingNames = existingCheck.rows.map(r => r.name);
        return res.status(400).json({ 
          error: 'Items with these names already exist', 
          existing: existingNames 
        });
      }
      
      // Begin transaction
      await client.query('BEGIN');
      
      let inserted = 0;
      const insertedItems = [];
      
      // Insert each item
      for (const item of validItems) {
        try {
          const slotsArray = item.slots || (item.slot ? [item.slot] : []);
          
          const result = await client.query(`
            INSERT INTO items (
              name, icon_type, icon_value,
              str, sta, agi, dex, wis, int, cha,
              attack_speed, health, mana, ac, block,
              resist_cold, resist_corruption, resist_disease, resist_electricity,
              resist_fire, resist_magic, resist_poison,
              weight, size, skill, damage, delay,
              item_type, slot, slots, description,
              race, class,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                      $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
            RETURNING id, name
          `, [
            item.name, item.icon_type, item.icon_value,
            item.str || 0, item.sta || 0, item.agi || 0, item.dex || 0, 
            item.wis || 0, item.int || 0, item.cha || 0,
            item.attack_speed || 0, item.health || 0, item.mana || 0, item.ac || 0, item.block || 0,
            item.resist_cold || 0, item.resist_corruption || 0, item.resist_disease || 0, 
            item.resist_electricity || 0, item.resist_fire || 0, item.resist_magic || 0, 
            item.resist_poison || 0,
            item.weight || 0.0, item.size || 'Medium', item.skill || null, 
            item.damage || 0, item.delay || 0,
            item.item_type, item.slot, slotsArray, item.description,
            item.race || null, item.class || null,
            req.user.id, req.user.id
          ]);
          
          inserted++;
          insertedItems.push(result.rows[0]);
          
        } catch (itemError) {
          // If one item fails, add to errors but continue
          errors.push(`Failed to insert "${item.name}": ${itemError.message}`);
        }
      }
      
      if (inserted === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ 
          error: 'Failed to insert any items', 
          details: errors 
        });
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.json({ 
        message: 'Batch insert completed',
        inserted: inserted,
        total: items.length,
        items: insertedItems,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in batch insert:', error);
      res.status(500).json({ error: 'Failed to batch insert items' });
    } finally {
      client.release();
    }
  });

  // GET /api/items/:id/npcs - Get NPCs that drop this item (alias for dropped-by)
  app.get('/api/items/:id/npcs', async (req, res) => {
    try {
      const { id } = req.params;
      
      // First check if item exists
      const itemCheck = await pool.query('SELECT name FROM items WHERE id = $1', [id]);
      if (itemCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      // Get NPCs that drop this item using the junction table
      const result = await pool.query(`
        SELECT 
          n.id,
          n.npcid,
          n.name,
          n.npc_type,
          n.level,
          n.hp,
          nl.drop_rate,
          nl.quantity
        FROM npc_loot nl
        JOIN npcs n ON nl.npc_id = n.id
        WHERE nl.item_id = $1
        ORDER BY n.level DESC, n.name ASC
      `, [id]);
      
      res.json({
        item: itemCheck.rows[0].name,
        npcs: result.rows
      });
      
    } catch (error) {
      console.error('Error fetching NPCs for item:', error);
      res.status(500).json({ error: 'Failed to fetch NPCs' });
    }
  });

  // GET /api/items/:id/dropped-by - Get NPCs that drop this item
  app.get('/api/items/:id/dropped-by', async (req, res) => {
    try {
      const { id } = req.params;
      
      // First check if item exists
      const itemCheck = await pool.query('SELECT name FROM items WHERE id = $1', [id]);
      if (itemCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      // Get NPCs that drop this item using the junction table
      const result = await pool.query(`
        SELECT 
          n.id,
          n.npcid,
          n.name,
          n.npc_type,
          n.level,
          n.hp,
          nl.drop_rate,
          nl.quantity
        FROM npc_loot nl
        JOIN npcs n ON nl.npc_id = n.id
        WHERE nl.item_id = $1
        ORDER BY n.level DESC, n.name ASC
      `, [id]);
      
      res.json({
        item: itemCheck.rows[0].name,
        dropped_by: result.rows
      });
      
    } catch (error) {
      console.error('Error fetching item drop sources:', error);
      res.status(500).json({ error: 'Failed to fetch drop sources' });
    }
  });

}