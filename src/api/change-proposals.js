import pool from '../db/database.js';
import { leaderboardCache, userStatsCache } from '../utils/cache.js';

export default function changeProposalsRouter(app, validateCSRF, xpFunctions = {}) {
  const { updateUserXP, getXPConfig } = xpFunctions;
  // Debug endpoint to check vote counts
  app.get('/api/debug/proposal-votes/:id', async (req, res) => {
    try {
      const proposalId = req.params.id;
      
      const proposal = await pool.query('SELECT * FROM change_proposals WHERE id = $1', [proposalId]);
      const votes = await pool.query('SELECT * FROM change_proposal_votes WHERE proposal_id = $1', [proposalId]);
      const counts = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE vote = 1) as upvotes,
          COUNT(*) FILTER (WHERE vote = -1) as downvotes,
          SUM(vote) as total_score
        FROM change_proposal_votes WHERE proposal_id = $1
      `, [proposalId]);
      
      // Set content type to ensure JSON response
      res.setHeader('Content-Type', 'application/json');
      res.json({
        proposal: proposal.rows[0],
        votes: votes.rows,
        counts: counts.rows[0]
      });
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: error.message });
    }
  });
  // Get all pending change proposals
  app.get('/api/change-proposals', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          cp.*,
          COALESCE(u.nickname, u.name) as proposer_name,
          COALESCE(a.nickname, a.name) as admin_name,
          dt.name as proposer_donation_tier_name,
          dt.badge_color as proposer_donation_tier_color,
          dt.badge_icon as proposer_donation_tier_icon,
          (SELECT COUNT(*) FROM change_proposal_votes WHERE proposal_id = cp.id AND vote = 1) as upvotes,
          (SELECT COUNT(*) FROM change_proposal_votes WHERE proposal_id = cp.id AND vote = -1) as downvotes,
          CASE 
            WHEN $1::integer IS NOT NULL THEN 
              (SELECT vote FROM change_proposal_votes WHERE proposal_id = cp.id AND user_id = $1)
            ELSE NULL
          END as user_vote,
          -- Add map name for POI proposals
          CASE 
            WHEN cp.change_type = 'add_poi' AND cp.proposed_data->>'map_id' IS NOT NULL THEN 
              (SELECT name FROM maps WHERE id = (cp.proposed_data->>'map_id')::int)
            WHEN cp.change_type IN ('edit_poi', 'move_poi', 'delete_poi', 'change_loot') AND cp.target_id IS NOT NULL THEN
              (SELECT m.name FROM pois p JOIN maps m ON p.map_id = m.id WHERE p.id = cp.target_id)
            WHEN cp.change_type = 'edit_npc' AND cp.target_type = 'npc' AND cp.target_id IS NOT NULL THEN
              (SELECT m.name FROM pois p JOIN maps m ON p.map_id = m.id JOIN npcs n ON p.npc_id = n.npcid WHERE n.id = cp.target_id LIMIT 1)
            ELSE NULL
          END as map_name,
          -- Add map_id for POI proposals
          CASE 
            WHEN cp.change_type = 'add_poi' AND cp.proposed_data->>'map_id' IS NOT NULL THEN 
              (cp.proposed_data->>'map_id')::int
            WHEN cp.change_type IN ('edit_poi', 'move_poi', 'delete_poi', 'change_loot') AND cp.target_id IS NOT NULL THEN
              (SELECT map_id FROM pois WHERE id = cp.target_id)
            WHEN cp.change_type = 'edit_npc' AND cp.target_type = 'npc' AND cp.target_id IS NOT NULL THEN
              (SELECT p.map_id FROM pois p JOIN npcs n ON p.npc_id = n.npcid WHERE n.id = cp.target_id LIMIT 1)
            ELSE NULL
          END as map_id,
          -- Add POI coordinates for edit/delete/loot proposals
          CASE 
            WHEN cp.change_type IN ('edit_poi', 'delete_poi', 'change_loot') AND cp.target_id IS NOT NULL THEN
              (SELECT x FROM pois WHERE id = cp.target_id)
            WHEN cp.change_type = 'edit_npc' AND cp.target_type = 'npc' AND cp.target_id IS NOT NULL THEN
              (SELECT p.x FROM pois p JOIN npcs n ON p.npc_id = n.npcid WHERE n.id = cp.target_id LIMIT 1)
            ELSE NULL
          END as poi_x,
          CASE 
            WHEN cp.change_type IN ('edit_poi', 'delete_poi', 'change_loot') AND cp.target_id IS NOT NULL THEN
              (SELECT y FROM pois WHERE id = cp.target_id)
            WHEN cp.change_type = 'edit_npc' AND cp.target_type = 'npc' AND cp.target_id IS NOT NULL THEN
              (SELECT p.y FROM pois p JOIN npcs n ON p.npc_id = n.npcid WHERE n.id = cp.target_id LIMIT 1)
            ELSE NULL
          END as poi_y,
          -- Add POI type name
          CASE 
            WHEN cp.change_type IN ('add_poi', 'edit_poi') AND cp.proposed_data->>'type_id' IS NOT NULL THEN 
              (SELECT name FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int)
            WHEN cp.change_type IN ('move_poi', 'delete_poi') THEN
              COALESCE(
                (SELECT name FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int),
                (SELECT pt.name FROM pois p JOIN poi_types pt ON p.type_id = pt.id WHERE p.id = cp.target_id)
              )
            ELSE NULL
          END as type_name,
          -- Add POI type icon
          CASE 
            WHEN cp.change_type IN ('add_poi', 'edit_poi') AND cp.proposed_data->>'type_id' IS NOT NULL THEN 
              (SELECT icon_type FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int)
            WHEN cp.change_type IN ('move_poi', 'delete_poi') THEN
              COALESCE(
                (SELECT icon_type FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int),
                (SELECT pt.icon_type FROM pois p JOIN poi_types pt ON p.type_id = pt.id WHERE p.id = cp.target_id)
              )
            ELSE NULL
          END as type_icon_type,
          CASE 
            WHEN cp.change_type IN ('add_poi', 'edit_poi') AND cp.proposed_data->>'type_id' IS NOT NULL THEN 
              (SELECT icon_value FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int)
            WHEN cp.change_type IN ('move_poi', 'delete_poi') THEN
              COALESCE(
                (SELECT icon_value FROM poi_types WHERE id = (cp.proposed_data->>'type_id')::int),
                (SELECT pt.icon_value FROM pois p JOIN poi_types pt ON p.type_id = pt.id WHERE p.id = cp.target_id)
              )
            ELSE NULL
          END as type_icon_value,
          -- Add NPC name if linked
          CASE 
            WHEN cp.change_type IN ('add_poi', 'edit_poi') AND cp.proposed_data->>'npc_id' IS NOT NULL THEN 
              (SELECT name FROM npcs WHERE id = (cp.proposed_data->>'npc_id')::int)
            WHEN cp.change_type = 'delete_poi' AND cp.target_id IS NOT NULL THEN
              (SELECT n.name FROM pois p JOIN npcs n ON p.npc_id = n.id WHERE p.id = cp.target_id)
            ELSE NULL
          END as npc_name,
          -- Add Item name if linked
          CASE 
            WHEN cp.change_type IN ('add_poi', 'edit_poi') AND cp.proposed_data->>'item_id' IS NOT NULL THEN 
              (SELECT name FROM items WHERE id = (cp.proposed_data->>'item_id')::int)
            WHEN cp.change_type = 'delete_poi' AND cp.target_id IS NOT NULL THEN
              (SELECT i.name FROM pois p JOIN items i ON p.item_id = i.id WHERE p.id = cp.target_id)
            ELSE NULL
          END as item_name,
          -- Add current NPC name for edit_poi
          CASE 
            WHEN cp.change_type = 'edit_poi' AND cp.current_data->>'npc_id' IS NOT NULL THEN 
              (SELECT name FROM npcs WHERE id = (cp.current_data->>'npc_id')::int)
            ELSE NULL
          END as current_npc_name,
          -- Add current Item name for edit_poi
          CASE 
            WHEN cp.change_type = 'edit_poi' AND cp.current_data->>'item_id' IS NOT NULL THEN 
              (SELECT name FROM items WHERE id = (cp.current_data->>'item_id')::int)
            ELSE NULL
          END as current_item_name,
          -- Add current Type name for edit_poi and delete_poi
          CASE 
            WHEN cp.change_type = 'edit_poi' AND cp.current_data->>'type_id' IS NOT NULL THEN 
              (SELECT name FROM poi_types WHERE id = (cp.current_data->>'type_id')::int)
            WHEN cp.change_type = 'delete_poi' AND cp.current_data->>'type_id' IS NOT NULL THEN 
              (SELECT name FROM poi_types WHERE id = (cp.current_data->>'type_id')::int)
            ELSE NULL
          END as current_type_name
        FROM change_proposals cp
        LEFT JOIN users u ON cp.proposer_id = u.id
        LEFT JOIN users a ON cp.admin_id = a.id
        LEFT JOIN donation_tiers dt ON u.current_donation_tier_id = dt.id
        WHERE cp.status = 'pending'
        ORDER BY cp.created_at DESC
      `, [req.user?.id]);
      
      // Fetch existing loot for change_loot proposals
      const proposalsWithLoot = await Promise.all(result.rows.map(async (proposal) => {
        if (proposal.change_type === 'change_loot' && proposal.current_data?.npc_id) {
          try {
            // Fetch existing loot items for this NPC
            const lootResult = await pool.query(`
              SELECT 
                i.id as item_id,
                i.name as item_name
              FROM npcs n
              CROSS JOIN LATERAL unnest(n.loot) AS item_id
              JOIN items i ON i.id = item_id
              WHERE n.npcid = $1 OR n.id = $1
              ORDER BY i.name
            `, [proposal.current_data.npc_id]);
            
            // Add existing loot to current_data
            return {
              ...proposal,
              current_data: {
                ...proposal.current_data,
                existing_loot: lootResult.rows
              }
            };
          } catch (error) {
            console.error('Error fetching NPC loot:', error);
            return proposal;
          }
        }
        return proposal;
      }));
      
      res.json(proposalsWithLoot);
    } catch (error) {
      console.error('Error fetching change proposals:', error);
      res.status(500).json({ error: 'Failed to fetch change proposals' });
    }
  });

  // Create new change proposal
  app.post('/api/change-proposals', validateCSRF, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      change_type,
      target_type,
      target_id,
      current_data,
      proposed_data,
      notes
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check for existing active proposal
      const existing = await client.query(`
        SELECT id FROM change_proposals 
        WHERE change_type = $1 
          AND target_type = $2 
          AND target_id = $3 
          AND proposer_id = $4 
          AND status = 'pending'
      `, [change_type, target_type, target_id, req.user.id]);

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'You already have a pending proposal for this change' 
        });
      }

      // Create proposal with vote_score starting at 0
      const result = await client.query(`
        INSERT INTO change_proposals 
        (change_type, target_type, target_id, proposer_id, current_data, proposed_data, notes, vote_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
        RETURNING *
      `, [
        change_type,
        target_type,
        target_id,
        req.user.id,
        current_data,
        proposed_data,
        notes
      ]);

      // Add the proposer's implicit upvote
      const voteResult = await client.query(`
        INSERT INTO change_proposal_votes (proposal_id, user_id, vote)
        VALUES ($1, $2, 1)
        RETURNING *
      `, [result.rows[0].id, req.user.id]);
      
      
      // Commit the transaction first to ensure vote is saved and trigger has executed
      await client.query('COMMIT');
      
      // Now fetch the updated proposal with all counts after commit
      const updatedProposal = await pool.query(`
        SELECT 
          cp.*,
          COALESCE(u.nickname, u.name) as proposer_name,
          (SELECT COUNT(*) FROM change_proposal_votes WHERE proposal_id = cp.id AND vote = 1) as upvotes,
          (SELECT COUNT(*) FROM change_proposal_votes WHERE proposal_id = cp.id AND vote = -1) as downvotes,
          (SELECT vote FROM change_proposal_votes WHERE proposal_id = cp.id AND user_id = $2) as user_vote
        FROM change_proposals cp
        LEFT JOIN users u ON cp.proposer_id = u.id
        WHERE cp.id = $1
      `, [result.rows[0].id, req.user.id]);
      
      res.json(updatedProposal.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating change proposal:', error);
      res.status(500).json({ error: 'Failed to create change proposal' });
    } finally {
      client.release();
    }
  });

  // Vote on change proposal
  app.post('/api/change-proposals/:id/vote', validateCSRF, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const proposalId = req.params.id;
    const { vote } = req.body;

    if (vote !== 1 && vote !== -1) {
      return res.status(400).json({ error: 'Invalid vote value' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get proposal details
      const proposalResult = await client.query(
        'SELECT proposer_id, status, vote_score FROM change_proposals WHERE id = $1',
        [proposalId]
      );

      if (proposalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Proposal not found' });
      }

      const proposal = proposalResult.rows[0];

      if (proposal.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Proposal is not pending' });
      }

      // Handle proposer downvoting their own proposal
      if (proposal.proposer_id === req.user.id && vote === -1) {
        // Get proposal details for POI handling
        const proposalDetails = await client.query(
          'SELECT * FROM change_proposals WHERE id = $1',
          [proposalId]
        );
        const proposalData = proposalDetails.rows[0];
        
        // If it's a POI, update custom POI status back to private
        if (proposalData.change_type === 'add_poi' && proposalData.proposed_data.custom_poi_id) {
          await client.query(
            'UPDATE custom_pois SET status = $1 WHERE id = $2',
            ['private', proposalData.proposed_data.custom_poi_id]
          );
        }
        
        // Withdraw the proposal
        await client.query(
          'UPDATE change_proposals SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['withdrawn', proposalId]
        );
        
        await client.query('COMMIT');
        return res.json({ withdrawn: true });
      }

      // Check if this is the user's first vote on this proposal
      const existingVoteResult = await client.query(
        'SELECT vote FROM change_proposal_votes WHERE proposal_id = $1 AND user_id = $2',
        [proposalId, req.user.id]
      );
      const isFirstVote = existingVoteResult.rows.length === 0;
      const isVotingOnOwnProposal = proposal.proposer_id === req.user.id;

      // Upsert vote
      const voteResult = await client.query(`
        INSERT INTO change_proposal_votes (proposal_id, user_id, vote)
        VALUES ($1, $2, $3)
        ON CONFLICT (proposal_id, user_id) 
        DO UPDATE SET vote = $3
        RETURNING *
      `, [proposalId, req.user.id, vote]);

      // Update vote score
      const scoreResult = await client.query(`
        UPDATE change_proposals 
        SET vote_score = (
          SELECT COUNT(*) FILTER (WHERE vote = 1) - COUNT(*) FILTER (WHERE vote = -1)
          FROM change_proposal_votes
          WHERE proposal_id = $1
        )
        WHERE id = $1
        RETURNING vote_score
      `, [proposalId]);

      const newScore = scoreResult.rows[0].vote_score;

      // Check if proposal should be auto-approved
      if (newScore >= 10) {
        // Get full proposal details for processing
        const fullProposal = await client.query(
          'SELECT * FROM change_proposals WHERE id = $1',
          [proposalId]
        );
        const proposalData = fullProposal.rows[0];

        await client.query(
          'UPDATE change_proposals SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['approved', proposalId]
        );

        // Handle POI-specific approval logic
        if (proposalData.change_type === 'add_poi') {
          const data = proposalData.proposed_data;
          
          // Insert into main POIs table
          await client.query(
            `INSERT INTO pois (map_id, name, description, x, y, type_id, icon, icon_size, 
                              label_visible, label_position, created_by, created_by_user_id, npc_id, item_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              data.map_id, data.name, data.description, data.x, data.y, 
              data.type_id, data.icon, data.icon_size, data.label_visible, 
              data.label_position, null, proposalData.proposer_id, data.npc_id, data.item_id
            ]
          );

          // Delete custom POI if exists, but invalidate shares so users know what happened
          if (data.custom_poi_id) {
            // Delete the custom POI since it's now published
            await client.query(
              'DELETE FROM custom_pois WHERE id = $1',
              [data.custom_poi_id]
            );
            
            // Store POI data before deletion for invalidated shares
            const poiData = {
              name: data.name,
              description: data.description,
              map_id: data.map_id,
              x: data.x,
              y: data.y,
              published_at: new Date().toISOString()
            };
            
            // Invalidate any shares (don't delete so users know what happened)
            await client.query(
              'UPDATE custom_poi_shares SET is_active = false, invalidation_reason = $1, published_poi_data = $2 WHERE custom_poi_id = $3', 
              ['published', JSON.stringify(poiData), data.custom_poi_id]
            );
            await client.query(
              'UPDATE shared_pois SET is_active = false, invalidation_reason = $1, published_poi_data = $2 WHERE custom_poi_id = $3', 
              ['published', JSON.stringify(poiData), data.custom_poi_id]
            );
          }
        } else if (proposalData.change_type === 'move_poi') {
          // Update POI location
          const data = proposalData.proposed_data;
          await client.query(
            'UPDATE pois SET x = $1, y = $2 WHERE id = $3',
            [data.x, data.y, proposalData.target_id]
          );
        } else if (proposalData.change_type === 'edit_poi') {
          // Update POI with proposed changes
          const data = proposalData.proposed_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          if (data.name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            updateValues.push(data.name);
          }
          if (data.description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            updateValues.push(data.description);
          }
          if (data.type_id !== undefined) {
            updateFields.push(`type_id = $${paramCount++}`);
            updateValues.push(data.type_id);
          }
          if (data.npc_id !== undefined) {
            updateFields.push(`npc_id = $${paramCount++}`);
            updateValues.push(data.npc_id);
          }
          if (data.item_id !== undefined) {
            updateFields.push(`item_id = $${paramCount++}`);
            updateValues.push(data.item_id);
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE pois SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        } else if (proposalData.change_type === 'delete_poi') {
          // Delete the POI
          await client.query(
            'DELETE FROM pois WHERE id = $1',
            [proposalData.target_id]
          );
        } else if (proposalData.change_type === 'change_loot') {
          // Update loot items for NPC
          const data = proposalData.proposed_data;
          
          if (data.loot_items && Array.isArray(data.loot_items) && data.npc_id) {
            // The loot_items array contains the complete new loot list
            const newItemIds = data.loot_items.map(item => item.item_id);
            
            // Update NPC with new loot array
            await client.query(
              'UPDATE npcs SET loot = $1 WHERE npcid = $2 OR id = $2',
              [newItemIds, data.npc_id]
            );
          }
        } else if (proposalData.change_type === 'add_item') {
          // Add new item to database
          const data = proposalData.proposed_data;
          
          await client.query(
            `INSERT INTO items (name, description, item_type, slot, icon_type, icon_value, 
                               str, sta, agi, dex, wis, int, cha, ac, 
                               health, mana, attack_speed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.name, data.description, data.item_type, data.slot, 
              data.icon_type || 'emoji', data.icon_value,
              data.str || 0, data.sta || 0, data.agi || 0,
              data.dex || 0, data.wis || 0, data.int || 0,
              data.cha || 0, data.ac || 0, data.health || 0,
              data.mana || 0, data.attack_speed || 0
            ]
          );
        } else if (proposalData.change_type === 'add_npc') {
          // Add new NPC to database
          const data = proposalData.proposed_data;
          
          await client.query(
            `INSERT INTO npcs (name, npc_type, level, description, hp, mp, ac, 
                              str, sta, agi, dex, wis, int, cha, attack_speed, min_dmg, max_dmg)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.name, data.npc_type, data.level || 1, data.description,
              data.hp || 100, data.mp || 0, data.ac || 0,
              data.str || 10, data.sta || 10, data.agi || 10, data.dex || 10, 
              data.wis || 10, data.int || 10, data.cha || 10,
              data.attack_speed || 0, data.min_dmg || 0, data.max_dmg || 0
            ]
          );
        } else if (proposalData.change_type === 'edit_npc') {
          // Update NPC with proposed changes
          const data = proposalData.proposed_data;
          const currentData = proposalData.current_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          // Only update fields that were actually changed
          for (const [key, value] of Object.entries(data)) {
            // Skip fields that aren't meant to be updated
            if (['npcid', 'name', 'npc_type'].includes(key)) continue;
            
            // Only update if the value is different from current
            if (currentData && currentData[key] !== undefined && currentData[key] !== value) {
              updateFields.push(`${key} = $${paramCount++}`);
              updateValues.push(value);
            }
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE npcs SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        } else if (proposalData.change_type === 'edit_item') {
          // Update item with proposed changes
          const data = proposalData.proposed_data;
          const currentData = proposalData.current_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          for (const [key, value] of Object.entries(data)) {
            // Skip icon fields as they shouldn't be changed here
            if (['icon_type', 'icon_value'].includes(key)) continue;
            
            // Only update if the value is different from current
            if (currentData && currentData[key] !== value) {
              updateFields.push(`${key} = $${paramCount++}`);
              updateValues.push(value);
            }
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE items SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        }

        // Award XP to proposer
        const xpResult = await client.query(
          'SELECT value FROM xp_config WHERE key = $1',
          ['change_approved']
        );
        const xpAmount = xpResult.rows[0]?.value || 10;

        await client.query(
          'UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2',
          [xpAmount, proposal.proposer_id]
        );

        await client.query(
          'INSERT INTO xp_history (user_id, xp_change, reason) VALUES ($1, $2, $3)',
          [proposal.proposer_id, xpAmount, 'Change proposal approved by community']
        );
        
        // Clear caches when XP changes
        leaderboardCache.delete('top10');
        userStatsCache.delete(`user-stats-${proposal.proposer_id}`);
      }

      // Award XP for first vote on other people's proposals
      if (isFirstVote && !isVotingOnOwnProposal && updateUserXP && getXPConfig) {
        // Get XP config value
        const xpConfigResult = await client.query(
          'SELECT value FROM xp_config WHERE key = $1',
          ['proposal_vote']
        );
        const xpAmount = xpConfigResult.rows[0]?.value || 2;
        
        // Update user XP
        await client.query(
          'UPDATE users SET xp = GREATEST(0, xp + $2) WHERE id = $1',
          [req.user.id, xpAmount]
        );
        
        // Record in XP history
        await client.query(
          'INSERT INTO xp_history (user_id, xp_change, reason) VALUES ($1, $2, $3)',
          [req.user.id, xpAmount, 'Voted on change proposal']
        );
        
        // Clear caches when XP changes
        leaderboardCache.delete('top10');
        userStatsCache.delete(`user-stats-${req.user.id}`);
      }

      await client.query('COMMIT');
      res.json({ vote: voteResult.rows[0], score: newScore });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error voting on proposal:', error);
      res.status(500).json({ error: 'Failed to vote' });
    } finally {
      client.release();
    }
  });

  // Delete own proposal
  app.delete('/api/change-proposals/:id', validateCSRF, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const proposalId = req.params.id;

    try {
      const result = await pool.query(
        'DELETE FROM change_proposals WHERE id = $1 AND proposer_id = $2 AND status = $3 RETURNING id',
        [proposalId, req.user.id, 'pending']
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Proposal not found or cannot be deleted' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting proposal:', error);
      res.status(500).json({ error: 'Failed to delete proposal' });
    }
  });

  // Admin actions
  app.post('/api/admin/change-proposals/:id/action', validateCSRF, async (req, res) => {
    if (!req.isAuthenticated() || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const proposalId = req.params.id;
    const { action, notes, edited_data } = req.body;


    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get full proposal details
      const proposalResult = await client.query(
        'SELECT * FROM change_proposals WHERE id = $1',
        [proposalId]
      );

      if (proposalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Proposal not found' });
      }

      const proposalData = proposalResult.rows[0];

      if (proposalData.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Proposal is not pending' });
      }

      // Check if there's already an approved proposal that would conflict
      // Only certain change types should be blocked (e.g., can't add the same POI twice)
      // But move_poi, edit_poi, etc. should be allowed multiple times
      if (action === 'approved' && proposalData.target_id) {
        // Only check for conflicts on 'add' type changes
        if (proposalData.change_type.startsWith('add_')) {
          const existingApproved = await client.query(
            `SELECT id FROM change_proposals 
             WHERE change_type = $1 
             AND target_type = $2 
             AND target_id = $3 
             AND status = 'approved' 
             AND id != $4`,
            [proposalData.change_type, proposalData.target_type, proposalData.target_id, proposalId]
          );
          
          if (existingApproved.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'There is already an approved proposal to add this target' });
          }
        }
      }

      // Update proposal
      if (edited_data) {
        await client.query(`
          UPDATE change_proposals 
          SET status = $1, 
              admin_id = $2, 
              admin_action = $3, 
              admin_notes = $4,
              resolved_at = CURRENT_TIMESTAMP,
              proposed_data = $5
          WHERE id = $6
        `, [action, req.user.id, action, notes, edited_data, proposalId]);
      } else {
        await client.query(`
          UPDATE change_proposals 
          SET status = $1, 
              admin_id = $2, 
              admin_action = $3, 
              admin_notes = $4,
              resolved_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [action, req.user.id, action, notes, proposalId]);
      }

      // Handle rejection-specific logic
      if (action === 'rejected') {
        // If it's a custom POI proposal, revert the custom POI status back to private
        if (proposalData.change_type === 'add_poi' && proposalData.proposed_data?.custom_poi_id) {
          await client.query(
            'UPDATE custom_pois SET status = $1 WHERE id = $2',
            ['private', proposalData.proposed_data.custom_poi_id]
          );
        }
      }
      
      // Award XP if approved
      if (action === 'approved') {
        // Handle POI-specific approval logic
        if (proposalData.change_type === 'add_poi') {
          const data = edited_data || proposalData.proposed_data;
          
          
          // Insert into main POIs table
          await client.query(
            `INSERT INTO pois (map_id, name, description, x, y, type_id, icon, icon_size, 
                              label_visible, label_position, created_by, created_by_user_id, npc_id, item_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              data.map_id, 
              data.name, 
              data.description || null, 
              data.x, 
              data.y, 
              data.type_id || null, 
              data.icon || null, 
              data.icon_size || null, 
              data.label_visible !== false, // default to true if not specified
              data.label_position || 'bottom', 
              null, // created_by 
              proposalData.proposer_id, 
              data.npc_id || null, 
              data.item_id || null
            ]
          );

          // Delete custom POI if exists, but invalidate shares so users know what happened
          if (data.custom_poi_id) {
            // Delete the custom POI since it's now published
            await client.query(
              'DELETE FROM custom_pois WHERE id = $1',
              [data.custom_poi_id]
            );
            
            // Store POI data before deletion for invalidated shares
            const poiData = {
              name: data.name,
              description: data.description,
              map_id: data.map_id,
              x: data.x,
              y: data.y,
              published_at: new Date().toISOString()
            };
            
            // Invalidate any shares (don't delete so users know what happened)
            await client.query(
              'UPDATE custom_poi_shares SET is_active = false, invalidation_reason = $1, published_poi_data = $2 WHERE custom_poi_id = $3', 
              ['published', JSON.stringify(poiData), data.custom_poi_id]
            );
            await client.query(
              'UPDATE shared_pois SET is_active = false, invalidation_reason = $1, published_poi_data = $2 WHERE custom_poi_id = $3', 
              ['published', JSON.stringify(poiData), data.custom_poi_id]
            );
          }
        } else if (proposalData.change_type === 'move_poi') {
          // Update POI location
          const data = edited_data || proposalData.proposed_data;
          await client.query(
            'UPDATE pois SET x = $1, y = $2 WHERE id = $3',
            [data.x, data.y, proposalData.target_id]
          );
        } else if (proposalData.change_type === 'edit_poi') {
          // Update POI with proposed changes
          const data = edited_data || proposalData.proposed_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          if (data.name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            updateValues.push(data.name);
          }
          if (data.description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            updateValues.push(data.description);
          }
          if (data.type_id !== undefined) {
            updateFields.push(`type_id = $${paramCount++}`);
            updateValues.push(data.type_id);
          }
          if (data.npc_id !== undefined) {
            updateFields.push(`npc_id = $${paramCount++}`);
            updateValues.push(data.npc_id);
          }
          if (data.item_id !== undefined) {
            updateFields.push(`item_id = $${paramCount++}`);
            updateValues.push(data.item_id);
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE pois SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        } else if (proposalData.change_type === 'delete_poi') {
          // Delete the POI
          await client.query(
            'DELETE FROM pois WHERE id = $1',
            [proposalData.target_id]
          );
        } else if (proposalData.change_type === 'change_loot') {
          // Update loot items for NPC
          const data = edited_data || proposalData.proposed_data;
          
          if (data.loot_items && Array.isArray(data.loot_items) && data.npc_id) {
            // The loot_items array contains the complete new loot list
            const newItemIds = data.loot_items.map(item => item.item_id);
            
            // Update NPC with new loot array
            await client.query(
              'UPDATE npcs SET loot = $1 WHERE npcid = $2 OR id = $2',
              [newItemIds, data.npc_id]
            );
          }
        } else if (proposalData.change_type === 'add_item') {
          // Add new item to database
          const data = edited_data || proposalData.proposed_data;
          
          await client.query(
            `INSERT INTO items (name, description, item_type, slot, icon_type, icon_value, 
                               str, sta, agi, dex, wis, int, cha, ac, 
                               health, mana, attack_speed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.name, data.description, data.item_type, data.slot, 
              data.icon_type || 'emoji', data.icon_value,
              data.str || 0, data.sta || 0, data.agi || 0,
              data.dex || 0, data.wis || 0, data.int || 0,
              data.cha || 0, data.ac || 0, data.health || 0,
              data.mana || 0, data.attack_speed || 0
            ]
          );
        } else if (proposalData.change_type === 'add_npc') {
          // Add new NPC to database
          const data = edited_data || proposalData.proposed_data;
          
          await client.query(
            `INSERT INTO npcs (name, npc_type, level, description, hp, mp, ac, 
                              str, sta, agi, dex, wis, int, cha, attack_speed, min_dmg, max_dmg)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.name, data.npc_type, data.level || 1, data.description,
              data.hp || 100, data.mp || 0, data.ac || 0,
              data.str || 10, data.sta || 10, data.agi || 10, data.dex || 10, 
              data.wis || 10, data.int || 10, data.cha || 10,
              data.attack_speed || 0, data.min_dmg || 0, data.max_dmg || 0
            ]
          );
        } else if (proposalData.change_type === 'edit_npc') {
          // Update NPC with proposed changes
          const data = edited_data || proposalData.proposed_data;
          const currentData = proposalData.current_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          // Only update fields that were actually changed
          for (const [key, value] of Object.entries(data)) {
            // Skip fields that aren't meant to be updated
            if (['npcid', 'name', 'npc_type'].includes(key)) continue;
            
            // Only update if the value is different from current
            if (currentData && currentData[key] !== undefined && currentData[key] !== value) {
              updateFields.push(`${key} = $${paramCount++}`);
              updateValues.push(value);
            }
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE npcs SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        } else if (proposalData.change_type === 'edit_item') {
          // Update item with proposed changes
          const data = edited_data || proposalData.proposed_data;
          const currentData = proposalData.current_data;
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Build dynamic update query based on proposed changes
          for (const [key, value] of Object.entries(data)) {
            // Skip icon fields as they shouldn't be changed here
            if (['icon_type', 'icon_value'].includes(key)) continue;
            
            // Only update if the value is different from current
            if (currentData && currentData[key] !== value) {
              updateFields.push(`${key} = $${paramCount++}`);
              updateValues.push(value);
            }
          }
          
          if (updateFields.length > 0) {
            updateValues.push(proposalData.target_id);
            await client.query(
              `UPDATE items SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
              updateValues
            );
          }
        }

        // Award XP - use getXPConfig if available, otherwise fallback
        const xpAmount = getXPConfig ? await getXPConfig('change_approved') : 10;

        // Update user XP within the existing transaction
        await client.query(
          'UPDATE users SET xp = GREATEST(0, xp + $2) WHERE id = $1',
          [proposalData.proposer_id, xpAmount]
        );

        await client.query(
          'INSERT INTO xp_history (user_id, xp_change, reason) VALUES ($1, $2, $3)',
          [proposalData.proposer_id, xpAmount, 'Change proposal approved by admin']
        );
        
        // Clear caches when XP changes
        leaderboardCache.delete('top10');
        userStatsCache.delete(`user-stats-${proposalData.proposer_id}`);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing admin action:', error);
      res.status(500).json({ error: 'Failed to process action: ' + error.message });
    } finally {
      client.release();
    }
  });
}