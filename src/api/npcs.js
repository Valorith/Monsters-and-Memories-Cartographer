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
        n.*,
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
      LEFT JOIN LATERAL unnest(n.loot) AS loot_id ON true
      LEFT JOIN items i ON i.id = loot_id
      GROUP BY n.id, n.npcid
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
          i.id as item_id,
          i.name as item_name,
          i.icon_value
        FROM npcs n
        CROSS JOIN LATERAL unnest(n.loot) AS item_id
        JOIN items i ON i.id = item_id
        WHERE n.npcid = $1 OR n.id = $1
        ORDER BY i.name
      `, [id]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching NPC loot:', error);
      res.status(500).json({ error: 'Failed to fetch NPC loot' });
    }
  });

  // GET /api/npcs/:npcid - Get single NPC by npcid
  app.get('/api/npcs/:npcid', async (req, res) => {
    try {
      const { npcid } = req.params;
      const result = await pool.query(`
        SELECT 
          n.*,
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
        LEFT JOIN LATERAL unnest(n.loot) AS loot_id ON true
        LEFT JOIN items i ON i.id = loot_id
        WHERE n.npcid = $1
        GROUP BY n.id, n.npcid
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
    const result = await pool.query(`
      INSERT INTO npcs (
        npc_type, name, description, loot, hp, mp, ac,
        str, sta, agi, dex, wis, int, cha,
        attack_speed, min_dmg, max_dmg, level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *, npcid
    `, [
      npc_type, name, description, loot || [], hp, mp, ac,
      str, sta, agi, dex, wis, int, cha,
      attack_speed, min_dmg, max_dmg, level
    ]);

    res.json(result.rows[0]);
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
    const result = await pool.query(`
      UPDATE npcs SET
        npc_type = $2, name = $3, description = $4, loot = $5,
        hp = $6, mp = $7, ac = $8,
        str = $9, sta = $10, agi = $11, dex = $12, wis = $13, int = $14, cha = $15,
        attack_speed = $16, min_dmg = $17, max_dmg = $18, level = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id, npc_type, name, description, loot || [],
      hp, mp, ac, str, sta, agi, dex, wis, int, cha,
      attack_speed, min_dmg, max_dmg, level
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    res.json(result.rows[0]);
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
  
  console.log('Received NPCs for batch update:', JSON.stringify(npcs, null, 2));
  
  if (!Array.isArray(npcs) || npcs.length === 0) {
    return res.status(400).json({ error: 'No NPCs to update' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updatedNpcs = [];
    
    for (const npc of npcs) {
      const result = await client.query(`
        UPDATE npcs SET
          npc_type = $2, name = $3, description = $4, loot = $5,
          hp = $6, mp = $7, ac = $8,
          str = $9, sta = $10, agi = $11, dex = $12, wis = $13, int = $14, cha = $15,
          attack_speed = $16, min_dmg = $17, max_dmg = $18, level = $19,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        npc.id, npc.npc_type, npc.name, npc.description, npc.loot || [],
        npc.hp, npc.mp, npc.ac,
        npc.str, npc.sta, npc.agi, npc.dex, npc.wis, npc.int, npc.cha,
        npc.attack_speed, npc.min_dmg, npc.max_dmg, npc.level
      ]);
      
      if (result.rows.length > 0) {
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