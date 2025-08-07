import pool from '../db/database.js';

export default function npcsRouter(app, validateCSRF) {
  // Middleware to check if user is admin
  const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated() || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // GET /api/npcs - Get all NPCs
  app.get('/api/npcs', async (req, res) => {
    // For non-authenticated users, return empty array
    if (!req.isAuthenticated()) {
      return res.json([]);
    }
    try {
    const result = await pool.query(`
      SELECT 
        n.id, n.npcid, n.npc_type, n.name, n.description,
        n.hp, n.mp, n.ac, n.str, n.sta, n.agi, n.dex, 
        n.wis, n.int, n.cha, n.attack_speed, n.min_dmg, 
        n.max_dmg, n.level, n.created_at, n.updated_at,
        COALESCE(array_agg(nl.item_id) FILTER (WHERE nl.item_id IS NOT NULL), '{}') as loot,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'name', i.name,
              'icon_type', i.icon_type,
              'icon_value', i.icon_value
            ) ORDER BY i.name
          ) FILTER (WHERE i.id IS NOT NULL), 
          '[]'::json
        ) as loot_items
      FROM npcs n
      LEFT JOIN npc_loot nl ON n.id = nl.npc_id
      LEFT JOIN items i ON nl.item_id = i.id
      GROUP BY n.id
      ORDER BY n.id DESC
    `);
    res.json(result.rows);
    } catch (error) {
      console.error('Error fetching NPCs:', error);
      res.status(500).json({ error: 'Failed to fetch NPCs' });
    }
  });

  // GET /api/npcs/:id/loot - Get loot items for a specific NPC
  app.get('/api/npcs/:id/loot', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT 
          i.id,
          i.name,
          i.icon_type,
          i.icon_value
        FROM npcs n
        JOIN npc_loot nl ON n.id = nl.npc_id
        JOIN items i ON nl.item_id = i.id
        WHERE n.npcid = $1 OR n.id = $1
        ORDER BY i.name
      `, [id]);
      
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Error fetching NPC loot:', error);
      res.status(500).json({ error: 'Failed to fetch NPC loot' });
    }
  });

  // GET /api/npcs/:npcid - Get single NPC by npcid or id
  app.get('/api/npcs/:npcid', async (req, res) => {
    try {
      const { npcid } = req.params;
      const result = await pool.query(`
        SELECT 
          n.id, n.npcid, n.npc_type, n.name, n.description,
          n.hp, n.mp, n.ac, n.str, n.sta, n.agi, n.dex, 
          n.wis, n.int, n.cha, n.attack_speed, n.min_dmg, 
          n.max_dmg, n.level, n.created_at, n.updated_at,
          COALESCE(array_agg(nl.item_id) FILTER (WHERE nl.item_id IS NOT NULL), '{}') as loot,
          COALESCE(
            json_agg(
              json_build_object(
                'id', i.id,
                'name', i.name,
                'icon_type', i.icon_type,
                'icon_value', i.icon_value
              ) ORDER BY i.name
            ) FILTER (WHERE i.id IS NOT NULL), 
            '[]'::json
          ) as loot_items
        FROM npcs n
        LEFT JOIN npc_loot nl ON n.id = nl.npc_id
        LEFT JOIN items i ON nl.item_id = i.id
        WHERE n.npcid = $1 OR n.id = $1
        GROUP BY n.id
      `, [npcid]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NPC not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching NPC:', error);
      res.status(500).json({ error: 'Failed to fetch NPC' });
    }
  });

  // POST /api/npcs - Create new NPC
  app.post('/api/npcs', validateCSRF, requireAdmin, async (req, res) => {
    const {
    npc_type, name, description, loot, hp, mp, ac,
    str, sta, agi, dex, wis, int, cha,
    attack_speed, min_dmg, max_dmg, level
  } = req.body;

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert the NPC without the loot array
      const result = await client.query(`
        INSERT INTO npcs (
          npc_type, name, description, hp, mp, ac,
          str, sta, agi, dex, wis, int, cha,
          attack_speed, min_dmg, max_dmg, level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *, npcid
      `, [
        npc_type, name, description, hp, mp, ac,
        str, sta, agi, dex, wis, int, cha,
        attack_speed, min_dmg, max_dmg, level
      ]);
      
      const newNpc = result.rows[0];
      
      // Insert loot relationships into junction table
      if (loot && loot.length > 0) {
        const values = loot.map((itemId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        const params = [newNpc.id, ...loot];
        await client.query(
          `INSERT INTO npc_loot (npc_id, item_id) VALUES ${values}`,
          params
        );
      }
      
      // Fetch the loot items for the response
      const lootResult = await client.query(`
        SELECT i.*
        FROM npc_loot nl
        JOIN items i ON nl.item_id = i.id
        WHERE nl.npc_id = $1
      `, [newNpc.id]);
      
      newNpc.loot = loot || [];
      newNpc.loot_items = lootResult.rows;
      
      await client.query('COMMIT');
      res.json(newNpc);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    } catch (error) {
      console.error('Error creating NPC:', error);
      res.status(500).json({ error: 'Failed to create NPC' });
    }
  });

  // PUT /api/npcs/:id - Update NPC
  app.put('/api/npcs/:id', validateCSRF, requireAdmin, async (req, res) => {
    const { id } = req.params;
  const {
    npc_type, name, description, loot, hp, mp, ac,
    str, sta, agi, dex, wis, int, cha,
    attack_speed, min_dmg, max_dmg, level
  } = req.body;

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update the NPC record without the loot array
      const result = await client.query(`
        UPDATE npcs SET
          npc_type = $2, name = $3, description = $4,
          hp = $5, mp = $6, ac = $7,
          str = $8, sta = $9, agi = $10, dex = $11, wis = $12, int = $13, cha = $14,
          attack_speed = $15, min_dmg = $16, max_dmg = $17, level = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        id, npc_type, name, description,
        hp, mp, ac, str, sta, agi, dex, wis, int, cha,
        attack_speed, min_dmg, max_dmg, level
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NPC not found' });
      }

      const updatedNpc = result.rows[0];

      // Update junction table
      // First, delete existing loot relationships
      await client.query('DELETE FROM npc_loot WHERE npc_id = $1', [id]);
      
      // Then insert new loot relationships
      if (loot && loot.length > 0) {
        const values = loot.map((itemId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        const params = [id, ...loot];
        await client.query(
          `INSERT INTO npc_loot (npc_id, item_id) VALUES ${values}`,
          params
        );
      }
      
      // Fetch the loot items for the response
      const lootResult = await client.query(`
        SELECT i.*
        FROM npc_loot nl
        JOIN items i ON nl.item_id = i.id
        WHERE nl.npc_id = $1
      `, [id]);
      
      updatedNpc.loot = loot || [];
      updatedNpc.loot_items = lootResult.rows;
      
      await client.query('COMMIT');
      res.json(updatedNpc);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    } catch (error) {
      console.error('Error updating NPC:', error);
      res.status(500).json({ error: 'Failed to update NPC' });
    }
  });

  // DELETE /api/npcs/:id - Delete NPC
  app.delete('/api/npcs/:id', validateCSRF, requireAdmin, async (req, res) => {
    const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM npcs WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error('Error deleting NPC:', error);
      res.status(500).json({ error: 'Failed to delete NPC' });
    }
  });

  // PUT /api/npcs/batch/update - Batch update NPCs
  app.put('/api/npcs/batch/update', validateCSRF, requireAdmin, async (req, res) => {
    const { npcs } = req.body;
  
  
  if (!Array.isArray(npcs) || npcs.length === 0) {
    return res.status(400).json({ error: 'No NPCs to update' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updatedNpcs = [];
    
    for (const npc of npcs) {
      // Update NPC without loot array
      const result = await client.query(`
        UPDATE npcs SET
          npc_type = $2, name = $3, description = $4,
          hp = $5, mp = $6, ac = $7,
          str = $8, sta = $9, agi = $10, dex = $11, wis = $12, int = $13, cha = $14,
          attack_speed = $15, min_dmg = $16, max_dmg = $17, level = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        npc.id, npc.npc_type, npc.name, npc.description,
        npc.hp, npc.mp, npc.ac,
        npc.str, npc.sta, npc.agi, npc.dex, npc.wis, npc.int, npc.cha,
        npc.attack_speed, npc.min_dmg, npc.max_dmg, npc.level
      ]);
      
      if (result.rows.length > 0) {
        // Update loot in junction table
        await client.query('DELETE FROM npc_loot WHERE npc_id = $1', [npc.id]);
        
        if (npc.loot && npc.loot.length > 0) {
          const values = npc.loot.map((itemId, index) => 
            `($1, $${index + 2})`
          ).join(', ');
          
          const params = [npc.id, ...npc.loot];
          await client.query(
            `INSERT INTO npc_loot (npc_id, item_id) VALUES ${values}`,
            params
          );
        }
        
        updatedNpcs.push(result.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, updated: updatedNpcs.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error batch updating NPCs:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update NPCs', details: error.message });
  } finally {
    client.release();
  }
});

  // POST /api/npcs/batch/delete - Batch delete NPCs
  app.post('/api/npcs/batch/delete', validateCSRF, requireAdmin, async (req, res) => {
    const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No NPCs to delete' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM npcs WHERE id = ANY($1) RETURNING id',
      [ids]
    );
    
    res.json({ 
      success: true, 
      deleted: result.rows.length,
      ids: result.rows.map(row => row.id)
    });
  } catch (error) {
    console.error('Error batch deleting NPCs:', error);
    res.status(500).json({ error: 'Failed to delete NPCs' });
  }
  });
}