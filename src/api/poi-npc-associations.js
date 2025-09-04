import pool from '../db/database.js';

export default function poiNpcAssociationsRouter(app, validateCSRF) {
  // Test endpoint to verify reload
  app.get('/api/test-reload', (req, res) => {
    res.json({ message: 'Server reloaded successfully', timestamp: new Date().toISOString() });
  });
  
  // Get all NPCs associated with a POI
  app.get('/api/pois/:poiId/npcs', async (req, res) => {
    try {
      let { poiId } = req.params;
      
      // Handle custom POI IDs (e.g., "custom_63")
      if (poiId && poiId.toString().startsWith('custom_')) {
        const customPoiId = parseInt(poiId.replace('custom_', ''));
        
        if (isNaN(customPoiId)) {
          return res.status(400).json({ error: 'Invalid custom POI ID format' });
        }
        
        // Fetch NPCs associated with custom POI
        const result = await pool.query(`
          SELECT 
            cpna.id as association_id,
            n.npcid,
            n.name,
            n.level,
            n.hp,
            n.ac,
            n.min_dmg,
            n.max_dmg,
            n.attack_speed,
            n.description,
            0 as upvotes,
            0 as downvotes,
            0 as vote_score,
            0 as user_vote,
            COALESCE(
              json_agg(
                CASE 
                  WHEN i.id IS NOT NULL THEN 
                    json_build_object(
                      'id', i.id,
                      'name', i.name,
                      'icon_type', i.icon_type,
                      'icon_value', i.icon_value
                    )
                  ELSE NULL
                END
              ) FILTER (WHERE i.id IS NOT NULL), 
              '[]'::json
            ) as loot_items
          FROM custom_poi_npc_associations cpna
          JOIN npcs n ON cpna.npc_id = n.npcid
          LEFT JOIN npc_loot nl ON n.id = nl.npc_id
          LEFT JOIN items i ON nl.item_id = i.id
          WHERE cpna.custom_poi_id = $1
          GROUP BY cpna.id, n.npcid, n.name, n.level, n.hp, n.ac, n.min_dmg, n.max_dmg, n.attack_speed, n.description
          ORDER BY n.name ASC
        `, [customPoiId]);
        
        return res.json(result.rows);
      }
      
      // Handle regular POI IDs
      const numericPoiId = parseInt(poiId);
      if (isNaN(numericPoiId)) {
        return res.status(400).json({ error: 'Invalid POI ID format' });
      }
      
      const result = await pool.query(`
        SELECT 
          pna.id as association_id,
          n.npcid,
          n.name,
          n.level,
          n.hp,
          n.ac,
          n.min_dmg,
          n.max_dmg,
          n.attack_speed,
          n.description,
          pna.upvotes,
          pna.downvotes,
          pna.vote_score,
          CASE 
            WHEN pnv.vote IS NOT NULL THEN pnv.vote
            ELSE 0
          END as user_vote,
          COALESCE(
            json_agg(
              CASE 
                WHEN i.id IS NOT NULL THEN 
                  json_build_object(
                    'id', i.id,
                    'name', i.name,
                    'icon_type', i.icon_type,
                    'icon_value', i.icon_value
                  )
                ELSE NULL
              END
            ) FILTER (WHERE i.id IS NOT NULL), 
            '[]'::json
          ) as loot_items
        FROM poi_npc_associations pna
        JOIN npcs n ON pna.npc_id = n.npcid
        LEFT JOIN poi_npc_votes pnv ON pna.id = pnv.association_id AND pnv.user_id = $2
        LEFT JOIN npc_loot nl ON n.id = nl.npc_id
        LEFT JOIN items i ON nl.item_id = i.id
        WHERE pna.poi_id = $1
        GROUP BY pna.id, n.npcid, n.name, n.level, n.hp, n.ac, n.min_dmg, n.max_dmg, 
                 n.attack_speed, n.description, pna.upvotes, pna.downvotes, pna.vote_score, pnv.vote
        ORDER BY pna.vote_score DESC, n.name ASC
      `, [numericPoiId, req.user?.id || null]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('[POI-NPC] Error fetching POI NPCs:', error);
      res.status(500).json({ error: 'Failed to fetch NPCs' });
    }
  });
  
  // Add NPC to POI (authenticated users)
  app.post('/api/pois/:poiId/npcs', validateCSRF, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    let { poiId } = req.params;
    const { npc_id } = req.body;
    
    if (!npc_id) {
      return res.status(400).json({ error: 'NPC ID is required' });
    }
    
    try {
      // Handle custom POI IDs
      if (poiId && poiId.toString().startsWith('custom_')) {
        const customPoiId = parseInt(poiId.replace('custom_', ''));
        
        if (isNaN(customPoiId)) {
          return res.status(400).json({ error: 'Invalid custom POI ID format' });
        }
        
        // Check if user owns this custom POI
        const ownerCheck = await pool.query(
          'SELECT user_id FROM custom_pois WHERE id = $1',
          [customPoiId]
        );
        
        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Custom POI not found' });
        }
        
        if (ownerCheck.rows[0].user_id !== req.user.id && !req.user.is_admin) {
          return res.status(403).json({ error: 'You can only modify your own custom POIs' });
        }
        
        // Check if association already exists
        const existingCheck = await pool.query(
          'SELECT id FROM custom_poi_npc_associations WHERE custom_poi_id = $1 AND npc_id = $2',
          [customPoiId, npc_id]
        );
        
        if (existingCheck.rows.length > 0) {
          return res.status(409).json({ error: 'This NPC is already associated with this POI' });
        }
        
        // Add NPC to custom POI
        const result = await pool.query(`
          INSERT INTO custom_poi_npc_associations (custom_poi_id, npc_id, created_by)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [customPoiId, npc_id, req.user.id]);
        
        res.json({ 
          success: true, 
          association_id: result.rows[0].id,
          message: 'NPC added to custom POI successfully' 
        });
        return;
      }
      
      // Check if POI exists and get its details
      const poiCheck = await pool.query(`
        SELECT 
          p.id,
          p.type_id,
          pt.multi_mob,
          false as is_custom_poi,
          null as custom_poi_owner
        FROM pois p
        LEFT JOIN poi_types pt ON p.type_id = pt.id
        WHERE p.id = $1
      `, [poiId]);
      
      if (poiCheck.rows.length === 0) {
        return res.status(404).json({ error: 'POI not found' });
      }
      
      const poi = poiCheck.rows[0];
      
      // Skip multi-mob check for admins - they can add NPCs to any POI
      if (!req.user.is_admin && !poi.multi_mob) {
        return res.status(400).json({ error: 'This POI type does not support multiple NPCs' });
      }
      
      // Check permissions for custom POIs
      if (poi.is_custom_poi && poi.custom_poi_owner !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only modify your own custom POIs' });
      }
      
      // Check if association already exists
      const existingCheck = await pool.query(
        'SELECT id FROM poi_npc_associations WHERE poi_id = $1 AND npc_id = $2',
        [poiId, npc_id]
      );
      
      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This NPC is already associated with this POI' });
      }
      
      // For non-custom POIs, this should create a proposal instead of direct association
      if (!poi.is_custom_poi && !req.user.is_admin) {
        // Create a proposal to add this NPC
        const proposalResult = await pool.query(`
          INSERT INTO change_proposals (
            poi_id,
            user_id,
            proposal_type,
            old_value,
            new_value,
            field_name,
            status
          ) VALUES ($1, $2, 'add_npc', null, $3::jsonb, 'npc_association', 'pending')
          RETURNING id
        `, [
          poiId,
          req.user.id,
          JSON.stringify({ npc_id: npc_id })
        ]);
        
        res.json({ 
          success: true, 
          proposal_id: proposalResult.rows[0].id,
          message: 'Proposal to add NPC created successfully' 
        });
      } else {
        // For custom POIs or admin users, create association directly
        const result = await pool.query(`
          INSERT INTO poi_npc_associations (poi_id, npc_id, created_by)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [poiId, npc_id, req.user.id]);
        
        // For custom POIs and admin actions, we don't need voting
        if (!poi.is_custom_poi && !req.user.is_admin) {
          // Auto-upvote by creator for regular POIs (non-admin)
          await pool.query(`
            INSERT INTO poi_npc_votes (association_id, user_id, vote)
            VALUES ($1, $2, 1)
          `, [result.rows[0].id, req.user.id]);
          
          // Update vote counts
          await pool.query(`
            UPDATE poi_npc_associations
            SET upvotes = 1, vote_score = 1
            WHERE id = $1
          `, [result.rows[0].id]);
        }
        
        res.json({ 
          success: true, 
          association_id: result.rows[0].id,
          message: 'NPC associated with POI successfully' 
        });
      }
    } catch (error) {
      console.error('Error adding NPC to POI:', error);
      res.status(500).json({ error: 'Failed to add NPC' });
    }
  });
  
  // Vote on POI-NPC association
  app.post('/api/poi-npc-associations/:associationId/vote', validateCSRF, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { associationId } = req.params;
    const { vote } = req.body;
    
    if (vote !== 1 && vote !== -1 && vote !== 0) {
      return res.status(400).json({ error: 'Vote must be 1, -1, or 0' });
    }
    
    try {
      await pool.query('BEGIN');
      
      if (vote === 0) {
        // Remove vote
        await pool.query(
          'DELETE FROM poi_npc_votes WHERE association_id = $1 AND user_id = $2',
          [associationId, req.user.id]
        );
      } else {
        // Upsert vote
        await pool.query(`
          INSERT INTO poi_npc_votes (association_id, user_id, vote)
          VALUES ($1, $2, $3)
          ON CONFLICT (association_id, user_id)
          DO UPDATE SET vote = $3, created_at = CURRENT_TIMESTAMP
        `, [associationId, req.user.id, vote]);
      }
      
      // Update vote counts
      const voteStats = await pool.query(`
        SELECT 
          COUNT(CASE WHEN vote = 1 THEN 1 END) as upvotes,
          COUNT(CASE WHEN vote = -1 THEN 1 END) as downvotes,
          COALESCE(SUM(vote), 0) as score
        FROM poi_npc_votes
        WHERE association_id = $1
      `, [associationId]);
      
      await pool.query(`
        UPDATE poi_npc_associations
        SET upvotes = $1, downvotes = $2, vote_score = $3
        WHERE id = $4
      `, [
        voteStats.rows[0].upvotes,
        voteStats.rows[0].downvotes,
        voteStats.rows[0].score,
        associationId
      ]);
      
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        upvotes: parseInt(voteStats.rows[0].upvotes),
        downvotes: parseInt(voteStats.rows[0].downvotes),
        score: parseInt(voteStats.rows[0].score)
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error voting on association:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    }
  });
  
  // Remove NPC from POI (propose removal for non-admins on regular POIs)
  app.delete('/api/poi-npc-associations/:associationId', validateCSRF, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { associationId } = req.params;
    
    try {
      // First check if this is a custom POI association
      const customAssocCheck = await pool.query(
        'SELECT cpna.*, cp.user_id as owner_id FROM custom_poi_npc_associations cpna JOIN custom_pois cp ON cpna.custom_poi_id = cp.id WHERE cpna.id = $1',
        [associationId]
      );
      
      if (customAssocCheck.rows.length > 0) {
        // Handle custom POI NPC removal
        const customAssoc = customAssocCheck.rows[0];
        
        // Check permissions
        if (customAssoc.owner_id !== req.user.id && !req.user.is_admin) {
          return res.status(403).json({ error: 'You can only modify your own custom POIs' });
        }
        
        // Delete the association
        await pool.query('DELETE FROM custom_poi_npc_associations WHERE id = $1', [associationId]);
        
        res.json({ success: true, message: 'NPC removed from custom POI' });
        return;
      }
      
      // Get regular association details
      const associationCheck = await pool.query(`
        SELECT 
          pna.poi_id, 
          pna.npc_id, 
          pna.created_by,
          false as is_custom_poi,
          null as custom_poi_owner
        FROM poi_npc_associations pna
        WHERE pna.id = $1
      `, [associationId]);
      
      if (associationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Association not found' });
      }
      
      const association = associationCheck.rows[0];
      
      // Check permissions for custom POIs
      if (association.is_custom_poi && association.custom_poi_owner !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only modify your own custom POIs' });
      }
      
      // For custom POIs or admin users, delete directly
      if (association.is_custom_poi || req.user.is_admin) {
        await pool.query('DELETE FROM poi_npc_associations WHERE id = $1', [associationId]);
        res.json({ success: true, message: 'NPC removed from POI' });
      } else {
        // For regular POIs (non-admin users), create a removal proposal
        const proposalResult = await pool.query(`
          INSERT INTO change_proposals (
            poi_id,
            user_id,
            proposal_type,
            old_value,
            new_value,
            field_name,
            status
          ) VALUES ($1, $2, 'remove_npc', $3::jsonb, null, 'npc_association', 'pending')
          RETURNING id
        `, [
          association.poi_id,
          req.user.id,
          JSON.stringify({ 
            association_id: associationId,
            npc_id: association.npc_id 
          })
        ]);
        
        res.json({ 
          success: true, 
          proposal_id: proposalResult.rows[0].id,
          message: 'Removal proposal created' 
        });
      }
    } catch (error) {
      console.error('Error removing NPC:', error);
      res.status(500).json({ error: 'Failed to remove NPC' });
    }
  });
}