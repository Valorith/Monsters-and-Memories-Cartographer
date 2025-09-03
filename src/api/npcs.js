import pool from '../db/database.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

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

  // POST /api/npcs/scan-wiki - Scan wiki page for NPC links
  app.post('/api/npcs/scan-wiki', validateCSRF, requireAdmin, async (req, res) => {
    const { url } = req.body;
    
    if (!url || !url.startsWith('https://monstersandmemories.miraheze.org/')) {
      return res.status(400).json({ error: 'Invalid wiki URL' });
    }
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const npcs = [];
      
      // Look for the "Pages in category" section
      $('#mw-pages .mw-category-group li a').each((index, element) => {
        const $link = $(element);
        const name = $link.text().trim();
        const href = $link.attr('href');
        
        if (name && href) {
          npcs.push({
            name: name,
            url: `https://monstersandmemories.miraheze.org${href}`
          });
        }
      });
      
      res.json({ npcs });
    } catch (error) {
      console.error('Error scanning wiki page:', error);
      res.status(500).json({ error: 'Failed to scan wiki page' });
    }
  });

  // POST /api/npcs/extract-wiki - Extract NPC data from wiki page
  app.post('/api/npcs/extract-wiki', validateCSRF, requireAdmin, async (req, res) => {
    const { url } = req.body;
    
    if (!url || !url.startsWith('https://monstersandmemories.miraheze.org/')) {
      return res.status(400).json({ error: 'Invalid wiki URL' });
    }
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract NPC data from the infobox - default to 0 for unknowns
      const npcData = {
        name: '',
        description: url, // Store the wiki URL as description
        npc_type: 'humanoid', // Default type
        level: 0, // Default to 0 if unknown
        hp: 0,
        mp: 0,
        ac: 0,
        str: 0,
        sta: 0,
        agi: 0,
        dex: 0,
        wis: 0,
        int: 0,
        cha: 0,
        attack_speed: '0.0',
        min_dmg: 0,
        max_dmg: 0
      };
      
      // Get NPC name from page title
      npcData.name = $('#firstHeading').text().trim() || 
                     $('h1').first().text().trim() || 
                     'Unknown NPC';
      
      // Debug: Log what we're finding
      console.log(`Extracting data for: ${npcData.name} from ${url}`);
      
      // First, try to find level in the page content using various formats
      const pageHtml = $.html();
      
      // Look for level in format: <b>Level:</b> value
      const levelMatch = pageHtml.match(/<b>Level:<\/b>\s*([^<\n]+)/i);
      if (levelMatch) {
        const levelText = levelMatch[1].trim();
        console.log(`  Found level text: ${levelText}`);
        
        // Handle various level formats
        if (levelText.includes('~')) {
          // Format: ~15 -> 15
          npcData.level = parseInt(levelText.replace('~', '')) || 0;
        } else if (levelText.includes('-')) {
          // Format: 4-5 -> 5 (take highest)
          const rangeParts = levelText.match(/(\d+)\s*-\s*(\d+)/);
          if (rangeParts) {
            npcData.level = parseInt(rangeParts[2]) || 0;
          } else {
            npcData.level = parseInt(levelText) || 0;
          }
        } else {
          // Simple number
          npcData.level = parseInt(levelText) || 0;
        }
        console.log(`  Parsed level: ${npcData.level}`);
      }
      
      // Look for HP in format: <b>HP:</b> value or <b>Health:</b> value
      const hpMatch = pageHtml.match(/<b>(?:HP|Health):<\/b>\s*([^<\n]+)/i);
      if (hpMatch) {
        const hpText = hpMatch[1].trim();
        console.log(`  Found HP text: ${hpText}`);
        npcData.hp = parseInt(hpText.replace(/[^\d]/g, '')) || 0;
      }
      
      // Look for AC in format: <b>AC:</b> value or <b>Armor Class:</b> value
      const acMatch = pageHtml.match(/<b>(?:AC|Armor Class):<\/b>\s*([^<\n]+)/i);
      if (acMatch) {
        const acText = acMatch[1].trim();
        console.log(`  Found AC text: ${acText}`);
        npcData.ac = parseInt(acText.replace(/[^\d-]/g, '')) || 0;
      }
      
      // Look for damage in format: <b>Damage:</b> value
      const damageMatch = pageHtml.match(/<b>Damage:<\/b>\s*([^<\n]+)/i);
      if (damageMatch) {
        const damageText = damageMatch[1].trim();
        console.log(`  Found damage text: ${damageText}`);
        const dmgRange = damageText.match(/(\d+)\s*-\s*(\d+)/);
        if (dmgRange) {
          npcData.min_dmg = parseInt(dmgRange[1]) || 0;
          npcData.max_dmg = parseInt(dmgRange[2]) || 0;
        }
      }
      
      // Look for Race/Type in format: <b>Race:</b> value or <b>Type:</b> value
      // Race is the primary source for NPC type
      const typeMatch = pageHtml.match(/<b>(?:Race|Type):<\/b>\s*([^<\n]+)/i);
      if (typeMatch) {
        const typeText = typeMatch[1].trim().toLowerCase();
        console.log(`  Found type text: ${typeText}`);
        
        // Map common races/types to NPC types
        const typeMap = {
          // Undead
          'undead': 'undead',
          'skeleton': 'undead',
          'zombie': 'undead',
          'ghoul': 'undead',
          'wight': 'undead',
          'lich': 'undead',
          'vampire': 'undead',
          
          // Beasts/Animals
          'beast': 'beast',
          'animal': 'beast',
          'wolf': 'beast',
          'bear': 'beast',
          'snake': 'beast',
          'scarab': 'beast',
          'beetle': 'beast',
          'spider': 'beast',
          'rat': 'beast',
          'bat': 'beast',
          
          // Humanoids
          'humanoid': 'humanoid',
          'human': 'humanoid',
          'elf': 'humanoid',
          'dwarf': 'humanoid',
          'orc': 'humanoid',
          'goblin': 'humanoid',
          'troll': 'humanoid',
          'ogre': 'humanoid',
          'giant': 'humanoid',
          'gnoll': 'humanoid',
          'kobold': 'humanoid',
          
          // Other types
          'elemental': 'elemental',
          'dragon': 'dragon',
          'demon': 'demon',
          'construct': 'construct',
          'golem': 'construct',
          'aberration': 'aberration',
          'plant': 'plant',
          'fey': 'fey'
        };
        
        for (const [key, mappedType] of Object.entries(typeMap)) {
          if (typeText.includes(key)) {
            npcData.npc_type = mappedType;
            break;
          }
        }
      }
      
      // Parse the infobox table (if exists - fallback for wikis that use tables)
      $('.infobox tr').each((index, row) => {
        const $row = $(row);
        const label = $row.find('th').text().trim().toLowerCase();
        const value = $row.find('td').text().trim();
        
        // Debug log
        if (label && value) {
          console.log(`  Found: ${label} = ${value}`);
        }
        
        switch(label) {
          case 'level':
            // Only set if we haven't found it already
            if (npcData.level === 0) {
              // Handle level ranges (e.g., "1-5" or "3 - 5")
              if (value.includes('-')) {
                const levelMatch = value.match(/(\d+)\s*-\s*(\d+)/);
                if (levelMatch) {
                  // Use the highest level in the range
                  npcData.level = parseInt(levelMatch[2]) || 0;
                } else {
                  npcData.level = parseInt(value) || 0;
                }
              } else {
                npcData.level = parseInt(value) || 0;
              }
            }
            break;
          case 'type':
          case 'race':
            // Map common types
            const typeMap = {
              'undead': 'undead',
              'skeleton': 'undead',
              'zombie': 'undead',
              'beast': 'beast',
              'animal': 'beast',
              'humanoid': 'humanoid',
              'human': 'humanoid',
              'elf': 'humanoid',
              'dwarf': 'humanoid',
              'orc': 'humanoid',
              'goblin': 'humanoid',
              'elemental': 'elemental',
              'dragon': 'dragon',
              'demon': 'demon',
              'construct': 'construct',
              'golem': 'construct',
              'aberration': 'aberration',
              'plant': 'plant',
              'fey': 'fey'
            };
            
            const valueLower = value.toLowerCase();
            for (const [key, mappedType] of Object.entries(typeMap)) {
              if (valueLower.includes(key)) {
                npcData.npc_type = mappedType;
                break;
              }
            }
            break;
          case 'health':
          case 'hp':
          case 'hit points':
            npcData.hp = parseInt(value.replace(/[^\d]/g, '')) || 0;
            break;
          case 'mana':
          case 'mp':
          case 'mana points':
            npcData.mp = parseInt(value.replace(/[^\d]/g, '')) || 0;
            break;
          case 'armor class':
          case 'ac':
          case 'armor':
            npcData.ac = parseInt(value.replace(/[^\d-]/g, '')) || 0;
            break;
          case 'damage':
            // Try to parse damage range
            const damageMatch = value.match(/(\d+)\s*-\s*(\d+)/);
            if (damageMatch) {
              npcData.min_dmg = parseInt(damageMatch[1]) || 0;
              npcData.max_dmg = parseInt(damageMatch[2]) || 0;
            }
            break;
          case 'strength':
          case 'str':
            npcData.str = parseInt(value) || 0;
            break;
          case 'stamina':
          case 'sta':
            npcData.sta = parseInt(value) || 0;
            break;
          case 'agility':
          case 'agi':
            npcData.agi = parseInt(value) || 0;
            break;
          case 'dexterity':
          case 'dex':
            npcData.dex = parseInt(value) || 0;
            break;
          case 'wisdom':
          case 'wis':
            npcData.wis = parseInt(value) || 0;
            break;
          case 'intelligence':
          case 'int':
            npcData.int = parseInt(value) || 0;
            break;
          case 'charisma':
          case 'cha':
            npcData.cha = parseInt(value) || 0;
            break;
          case 'attack speed':
            npcData.attack_speed = value.replace(/[^\d.]/g, '') || '0.0';
            break;
        }
      });
      
      // Alternative: Try to find stats in a stats table
      $('table').each((index, table) => {
        const $table = $(table);
        if ($table.text().toLowerCase().includes('statistics') || 
            $table.text().toLowerCase().includes('stats')) {
          $table.find('tr').each((index, row) => {
            const $row = $(row);
            const cells = $row.find('td');
            if (cells.length >= 2) {
              const label = cells.eq(0).text().trim().toLowerCase();
              const value = cells.eq(1).text().trim();
              
              // Parse stats similar to above
              switch(label) {
                case 'level':
                  // Handle level ranges
                  if (value.includes('-')) {
                    const levelMatch = value.match(/(\d+)\s*-\s*(\d+)/);
                    if (levelMatch) {
                      npcData.level = parseInt(levelMatch[2]) || npcData.level;
                    } else {
                      npcData.level = parseInt(value) || npcData.level;
                    }
                  } else {
                    npcData.level = parseInt(value) || npcData.level;
                  }
                  break;
                case 'health':
                case 'hp':
                  npcData.hp = parseInt(value.replace(/[^\d]/g, '')) || npcData.hp;
                  break;
                case 'armor class':
                case 'ac':
                  npcData.ac = parseInt(value.replace(/[^\d-]/g, '')) || npcData.ac;
                  break;
              }
            }
          });
        }
      });
      
      res.json(npcData);
    } catch (error) {
      console.error('Error extracting NPC data:', error);
      res.status(500).json({ error: 'Failed to extract NPC data' });
    }
  });

  // POST /api/npcs/batch-import - Batch import NPCs
  app.post('/api/npcs/batch-import', validateCSRF, requireAdmin, async (req, res) => {
    const { npcs } = req.body;
    
    if (!Array.isArray(npcs) || npcs.length === 0) {
      return res.status(400).json({ error: 'No NPCs to import' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let created = 0;
      let updated = 0;
      
      for (const npc of npcs) {
        // Check if NPC exists
        const existing = await client.query(
          'SELECT id FROM npcs WHERE LOWER(name) = LOWER($1)',
          [npc.name]
        );
        
        if (existing.rows.length > 0) {
          // Get existing NPC data to preserve non-conflicting fields
          const existingData = await client.query(
            'SELECT * FROM npcs WHERE id = $1',
            [existing.rows[0].id]
          );
          const currentNPC = existingData.rows[0];
          
          // Convert values to proper types
          const level = parseInt(npc.level) || 0;
          const hp = parseInt(npc.hp) || 0;
          const mp = parseInt(npc.mp) || 0;
          const ac = parseInt(npc.ac) || 0;
          const str = parseInt(npc.str) || 0;
          const sta = parseInt(npc.sta) || 0;
          const agi = parseInt(npc.agi) || 0;
          const dex = parseInt(npc.dex) || 0;
          const wis = parseInt(npc.wis) || 0;
          const intStat = parseInt(npc.int) || 0;
          const cha = parseInt(npc.cha) || 0;
          const minDmg = parseInt(npc.min_dmg) || 0;
          const maxDmg = parseInt(npc.max_dmg) || 0;
          const attackSpeed = parseFloat(npc.attack_speed) || 0.0;
          
          // Update existing NPC - only overwrite if new value is not 0/empty
          await client.query(`
            UPDATE npcs SET
              npc_type = COALESCE(NULLIF($2, 'humanoid'), npc_type),
              description = COALESCE(NULLIF($3, ''), description),
              level = CASE WHEN $4::int > 0 THEN $4::int ELSE level END,
              hp = CASE WHEN $5::int > 0 THEN $5::int ELSE hp END,
              mp = CASE WHEN $6::int > 0 THEN $6::int ELSE mp END,
              ac = CASE WHEN $7::int != 0 THEN $7::int ELSE ac END,
              str = CASE WHEN $8::int > 0 THEN $8::int ELSE str END,
              sta = CASE WHEN $9::int > 0 THEN $9::int ELSE sta END,
              agi = CASE WHEN $10::int > 0 THEN $10::int ELSE agi END,
              dex = CASE WHEN $11::int > 0 THEN $11::int ELSE dex END,
              wis = CASE WHEN $12::int > 0 THEN $12::int ELSE wis END,
              int = CASE WHEN $13::int > 0 THEN $13::int ELSE int END,
              cha = CASE WHEN $14::int > 0 THEN $14::int ELSE cha END,
              attack_speed = CASE WHEN $15::numeric != 0.0 THEN $15::numeric ELSE attack_speed END,
              min_dmg = CASE WHEN $16::int > 0 THEN $16::int ELSE min_dmg END,
              max_dmg = CASE WHEN $17::int > 0 THEN $17::int ELSE max_dmg END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [
            existing.rows[0].id,
            npc.npc_type, npc.description, level,
            hp, mp, ac,
            str, sta, agi, dex,
            wis, intStat, cha,
            attackSpeed, minDmg, maxDmg
          ]);
          updated++;
        } else {
          // Convert values to proper types for new NPC
          const level = parseInt(npc.level) || 0;
          const hp = parseInt(npc.hp) || 0;
          const mp = parseInt(npc.mp) || 0;
          const ac = parseInt(npc.ac) || 0;
          const str = parseInt(npc.str) || 0;
          const sta = parseInt(npc.sta) || 0;
          const agi = parseInt(npc.agi) || 0;
          const dex = parseInt(npc.dex) || 0;
          const wis = parseInt(npc.wis) || 0;
          const intStat = parseInt(npc.int) || 0;
          const cha = parseInt(npc.cha) || 0;
          const minDmg = parseInt(npc.min_dmg) || 0;
          const maxDmg = parseInt(npc.max_dmg) || 0;
          const attackSpeed = parseFloat(npc.attack_speed) || 0.0;
          
          // Create new NPC
          await client.query(`
            INSERT INTO npcs (
              name, npc_type, description, level,
              hp, mp, ac,
              str, sta, agi, dex, wis, int, cha,
              attack_speed, min_dmg, max_dmg
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [
            npc.name, npc.npc_type, npc.description, level,
            hp, mp, ac,
            str, sta, agi, dex,
            wis, intStat, cha,
            attackSpeed, minDmg, maxDmg
          ]);
          created++;
        }
      }
      
      await client.query('COMMIT');
      res.json({ success: true, created, updated });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error batch importing NPCs:', error);
      res.status(500).json({ error: 'Failed to import NPCs' });
    } finally {
      client.release();
    }
  });
}