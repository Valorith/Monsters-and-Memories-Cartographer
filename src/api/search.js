import pool from '../db/database.js';

export default function searchRouter(app) {
  // GET /api/search - Search across POIs, items, and NPCs
  app.get('/api/search', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length === 0) {
        return res.json([]);
      }

      const searchQuery = q.trim().toLowerCase();
      
      // Search POIs
      const poisResult = await pool.query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.x,
          p.y,
          p.map_id,
          p.type_id,
          p.icon_size,
          p.npc_id,
          m.name as map_name,
          pt.name as type_name,
          pt.icon_type as type_icon_type,
          pt.icon_value as type_icon_value,
          'poi' as result_type
        FROM pois p
        LEFT JOIN maps m ON p.map_id = m.id
        LEFT JOIN poi_types pt ON p.type_id = pt.id
        WHERE LOWER(p.name) LIKE $1
        ORDER BY 
          CASE 
            WHEN LOWER(p.name) = $2 THEN 0
            WHEN LOWER(p.name) LIKE $3 THEN 1
            ELSE 2
          END,
          LENGTH(p.name),
          p.name
        LIMIT 20
      `, [`%${searchQuery}%`, searchQuery, `${searchQuery}%`]);

      // Search custom POIs if user is authenticated
      let customPoisResult = { rows: [] };
      if (req.isAuthenticated()) {
        customPoisResult = await pool.query(`
          SELECT 
            cp.id,
            cp.name,
            cp.description,
            cp.x,
            cp.y,
            cp.map_id,
            cp.icon as icon_value,
            'emoji' as icon_type,
            24 as icon_size,
            NULL as npc_id,
            m.name as map_name,
            'Custom POI' as type_name,
            u.nickname as owner_name,
            'custom_poi' as result_type,
            cp.user_id
          FROM custom_pois cp
          LEFT JOIN maps m ON cp.map_id = m.id
          LEFT JOIN users u ON cp.user_id = u.id
          WHERE LOWER(cp.name) LIKE $1
            AND (
              cp.user_id = $4 
              OR cp.id IN (
                SELECT custom_poi_id FROM custom_poi_shares 
                WHERE user_id = $4 AND is_active = true
              )
            )
          ORDER BY 
            CASE 
              WHEN LOWER(cp.name) = $2 THEN 0
              WHEN LOWER(cp.name) LIKE $3 THEN 1
              ELSE 2
            END,
            LENGTH(cp.name),
            cp.name
          LIMIT 20
        `, [`%${searchQuery}%`, searchQuery, `${searchQuery}%`, req.user.id]);
      }

      // Search items
      const itemsResult = await pool.query(`
        SELECT 
          i.id,
          i.name,
          i.description,
          i.icon_type,
          i.icon_value,
          i.str,
          i.sta,
          i.agi,
          i.dex,
          i.wis,
          i."int",
          i.cha,
          i.health,
          i.mana,
          i.ac,
          i.attack_speed,
          i.item_type,
          i.slot,
          'item' as result_type
        FROM items i
        WHERE LOWER(i.name) LIKE $1
        ORDER BY 
          CASE 
            WHEN LOWER(i.name) = $2 THEN 0
            WHEN LOWER(i.name) LIKE $3 THEN 1
            ELSE 2
          END,
          LENGTH(i.name),
          i.name
        LIMIT 20
      `, [`%${searchQuery}%`, searchQuery, `${searchQuery}%`]);

      // Search NPCs
      const npcsResult = await pool.query(`
        SELECT 
          n.id,
          n.npcid,
          n.name,
          n.level,
          n.hp,
          n.ac,
          n.min_dmg,
          n.max_dmg,
          n.description,
          'npc' as result_type,
          (SELECT COUNT(DISTINCT p.id) FROM pois p WHERE p.npc_id = n.npcid) as location_count
        FROM npcs n
        WHERE LOWER(n.name) LIKE $1
        ORDER BY 
          CASE 
            WHEN LOWER(n.name) = $2 THEN 0
            WHEN LOWER(n.name) LIKE $3 THEN 1
            ELSE 2
          END,
          LENGTH(n.name),
          n.name
        LIMIT 20
      `, [`%${searchQuery}%`, searchQuery, `${searchQuery}%`]);

      // Combine and sort all results by relevance
      const allResults = [
        ...poisResult.rows,
        ...customPoisResult.rows,
        ...itemsResult.rows,
        ...npcsResult.rows
      ];

      // Calculate relevance scores for final sorting
      const scoredResults = allResults.map(result => {
        const name = result.name.toLowerCase();
        let score = 0;
        
        // Exact match gets highest score
        if (name === searchQuery) {
          score = 1000;
        }
        // Starts with query
        else if (name.startsWith(searchQuery)) {
          score = 500 - name.length;
        }
        // Contains query
        else {
          score = 100 - name.length;
        }
        
        return { ...result, score };
      });

      // Sort by score and limit to top results
      const sortedResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

      res.json(sortedResults);
    } catch (error) {
      console.error('Search error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Search failed', details: error.message });
    }
  });

  // GET /api/items/:id/npcs - Get NPCs that drop a specific item
  app.get('/api/items/:id/npcs', async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT DISTINCT
          n.id,
          n.npcid,
          n.name,
          n.level,
          n.hp,
          n.ac,
          n.min_dmg,
          n.max_dmg,
          n.description,
          (SELECT COUNT(DISTINCT p.id) FROM pois p WHERE p.npc_id = n.npcid) as location_count
        FROM npcs n
        WHERE $1 = ANY(n.loot)
        ORDER BY n.name
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching NPCs for item:', error);
      res.status(500).json({ error: 'Failed to fetch NPCs' });
    }
  });

  // GET /api/npcs/:npcid/pois - Get POIs where a specific NPC appears
  app.get('/api/npcs/:npcid/pois', async (req, res) => {
    try {
      const { npcid } = req.params;
      
      const result = await pool.query(`
        SELECT 
          p.id,
          p.name,
          p.x,
          p.y,
          p.map_id,
          p.type_id,
          p.icon_size,
          m.name as map_name,
          pt.name as type_name,
          pt.icon_type as type_icon_type,
          pt.icon_value as type_icon_value
        FROM pois p
        LEFT JOIN maps m ON p.map_id = m.id
        LEFT JOIN poi_types pt ON p.type_id = pt.id
        WHERE p.npc_id = $1
        ORDER BY m.display_order, p.name
      `, [npcid]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching POIs for NPC:', error);
      res.status(500).json({ error: 'Failed to fetch POIs' });
    }
  });
}