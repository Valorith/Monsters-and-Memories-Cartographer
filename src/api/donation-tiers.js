import express from 'express';
import pool from '../db/database.js';

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Export a function that creates the router with validateCSRF middleware
export default function(validateCSRF) {
  const router = express.Router();

  // Get all donation tiers (public endpoint)
  router.get('/tiers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donation_tiers 
       WHERE is_active = true 
       ORDER BY tier_order ASC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching donation tiers:', error);
    res.status(500).json({ error: 'Failed to fetch donation tiers' });
  }
});

// Get user's current tier and progress
router.get('/user-progress', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get user's current tier and total donated
    const userResult = await pool.query(
      `SELECT 
        u.total_donated,
        u.current_donation_tier_id,
        u.last_donation_date,
        dt.name as current_tier_name,
        dt.badge_color as current_tier_color,
        dt.badge_icon as current_tier_icon,
        dt.tier_order as current_tier_order
       FROM users u
       LEFT JOIN donation_tiers dt ON u.current_donation_tier_id = dt.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userResult.rows[0];
    
    // Get next tier info
    let nextTierResult;
    if (userData.current_tier_order) {
      nextTierResult = await pool.query(
        `SELECT * FROM donation_tiers 
         WHERE is_active = true AND tier_order > $1
         ORDER BY tier_order ASC
         LIMIT 1`,
        [userData.current_tier_order]
      );
    } else {
      // User has no tier yet, get the first tier
      nextTierResult = await pool.query(
        `SELECT * FROM donation_tiers 
         WHERE is_active = true
         ORDER BY tier_order ASC
         LIMIT 1`
      );
    }

    const nextTier = nextTierResult.rows[0] || null;
    
    // Calculate progress to next tier
    let progressPercent = 0;
    let amountToNextTier = 0;
    
    if (nextTier) {
      const currentAmount = parseFloat(userData.total_donated || 0);
      const requiredAmount = parseFloat(nextTier.required_amount);
      
      // Get the previous tier's required amount (or 0 if no previous tier)
      let previousTierAmount = 0;
      if (userData.current_tier_order) {
        const prevTierResult = await pool.query(
          `SELECT required_amount FROM donation_tiers 
           WHERE tier_order = $1 AND is_active = true`,
          [userData.current_tier_order]
        );
        if (prevTierResult.rows.length > 0) {
          previousTierAmount = parseFloat(prevTierResult.rows[0].required_amount);
        }
      }
      
      amountToNextTier = requiredAmount - currentAmount;
      
      // Calculate progress as percentage between current tier and next tier
      const tierRange = requiredAmount - previousTierAmount;
      const progressInRange = currentAmount - previousTierAmount;
      progressPercent = Math.min(100, Math.max(0, (progressInRange / tierRange) * 100));
    } else {
      // User has reached the highest tier
      progressPercent = 100;
    }

    res.json({
      totalDonated: parseFloat(userData.total_donated || 0),
      currentTier: userData.current_tier_name ? {
        id: userData.current_donation_tier_id,
        name: userData.current_tier_name,
        color: userData.current_tier_color,
        icon: userData.current_tier_icon
      } : null,
      nextTier: nextTier ? {
        id: nextTier.id,
        name: nextTier.name,
        color: nextTier.badge_color,
        icon: nextTier.badge_icon,
        requiredAmount: parseFloat(nextTier.required_amount)
      } : null,
      progressPercent,
      amountToNextTier: Math.max(0, amountToNextTier),
      lastDonationDate: userData.last_donation_date
    });
  } catch (error) {
    console.error('Error fetching user donation progress:', error);
    res.status(500).json({ error: 'Failed to fetch donation progress' });
  }
});

// Admin endpoints

// Get all tiers including inactive ones (admin only)
router.get('/admin/tiers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donation_tiers ORDER BY tier_order ASC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching donation tiers:', error);
    res.status(500).json({ error: 'Failed to fetch donation tiers' });
  }
});

// Create new donation tier (admin only)
router.post('/admin/tiers', requireAdmin, validateCSRF, async (req, res) => {
  const { name, required_amount, badge_color, badge_icon, tier_order, description, perks } = req.body;

  // Validate required fields
  if (!name || !required_amount || !badge_color || !tier_order) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate hex color format
  if (!/^#[0-9A-F]{6}$/i.test(badge_color)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex color (e.g., #FFD700)' });
  }

  try {
    // Check if tier name already exists
    const nameCheck = await pool.query(
      'SELECT id FROM donation_tiers WHERE name = $1',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A tier with this name already exists' });
    }
    
    // Begin transaction for atomic updates
    await pool.query('BEGIN');
    
    try {
      // Insert the new tier with a very high temporary order first
      const result = await pool.query(
        `INSERT INTO donation_tiers 
         (name, required_amount, badge_color, badge_icon, tier_order, description, perks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, required_amount, badge_color, badge_icon || null, 99999, description || null, perks || []]
      );
      
      // Get all tiers that need to be shifted
      const tiersToShift = await pool.query(
        `SELECT id, tier_order FROM donation_tiers 
         WHERE tier_order >= $1 AND is_active = true AND id != $2
         ORDER BY tier_order DESC`,
        [tier_order, result.rows[0].id]
      );
      
      // First, move all affected tiers to negative values to completely avoid conflicts
      for (let i = 0; i < tiersToShift.rows.length; i++) {
        const tier = tiersToShift.rows[i];
        await pool.query(
          'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
          [-(tier.tier_order + 1), tier.id]
        );
      }
      
      // Set the new tier to its desired position
      await pool.query(
        'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
        [tier_order, result.rows[0].id]
      );
      
      // Now move all shifted tiers back to positive values
      for (let i = 0; i < tiersToShift.rows.length; i++) {
        const tier = tiersToShift.rows[i];
        await pool.query(
          'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
          [tier.tier_order + 1, tier.id]
        );
      }
      
      // Get the final updated tier
      const finalResult = await pool.query(
        'SELECT * FROM donation_tiers WHERE id = $1',
        [result.rows[0].id]
      );
      
      await pool.query('COMMIT');
      res.json(finalResult.rows[0]);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating donation tier:', error);
    res.status(500).json({ error: 'Failed to create donation tier' });
  }
});

// Update donation tier (admin only)
router.put('/admin/tiers/:id', requireAdmin, validateCSRF, async (req, res) => {
  const { name, required_amount, badge_color, badge_icon, tier_order, description, perks, is_active } = req.body;
  
  // Build update fields dynamically to handle partial updates properly
  const updateFields = [];
  const values = [];
  let paramCounter = 1;
  
  if (name !== undefined) {
    updateFields.push(`name = $${paramCounter}`);
    values.push(name);
    paramCounter++;
  }
  
  if (required_amount !== undefined) {
    updateFields.push(`required_amount = $${paramCounter}`);
    values.push(required_amount);
    paramCounter++;
  }
  
  if (badge_color !== undefined) {
    updateFields.push(`badge_color = $${paramCounter}`);
    values.push(badge_color);
    paramCounter++;
  }
  
  if (badge_icon !== undefined) {
    updateFields.push(`badge_icon = $${paramCounter}`);
    values.push(badge_icon);
    paramCounter++;
  }
  
  // Handle tier_order separately if it's being changed
  let tierOrderParamIndex = null;
  if (tier_order !== undefined) {
    tierOrderParamIndex = paramCounter;
    updateFields.push(`tier_order = $${paramCounter}`);
    values.push(tier_order);
    paramCounter++;
  }
  
  if (description !== undefined) {
    updateFields.push(`description = $${paramCounter}`);
    values.push(description);
    paramCounter++;
  }
  
  if (perks !== undefined) {
    updateFields.push(`perks = $${paramCounter}`);
    // Convert empty array to null for consistency
    // Also handle the case where perks is explicitly null
    const perksValue = (perks === null || (Array.isArray(perks) && perks.length === 0)) ? null : perks;
    values.push(perksValue);
    paramCounter++;
  }
  
  if (is_active !== undefined) {
    updateFields.push(`is_active = $${paramCounter}`);
    values.push(is_active);
    paramCounter++;
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  // Add updated_at
  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  
  // Add the ID as the last parameter
  values.push(req.params.id);
  
  // Validate hex color format if provided
  if (badge_color && !/^#[0-9A-F]{6}$/i.test(badge_color)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex color (e.g., #FFD700)' });
  }

  try {
    // First check if the name is being changed and if it conflicts with another tier
    if (name !== undefined && name !== null) {
      const nameCheck = await pool.query(
        'SELECT id FROM donation_tiers WHERE name = $1 AND id != $2',
        [name, req.params.id]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A tier with this name already exists' });
      }
    }
    
    let inTransaction = false;
    
    // Handle tier_order changes with smart reordering
    if (tier_order !== undefined && tier_order !== null) {
      // Get current tier order
      const currentTierResult = await pool.query(
        'SELECT tier_order FROM donation_tiers WHERE id = $1',
        [req.params.id]
      );
      
      if (currentTierResult.rows.length > 0) {
        const currentOrder = currentTierResult.rows[0].tier_order;
        
        if (currentOrder !== tier_order) {
          // Begin transaction for atomic reordering
          await pool.query('BEGIN');
          inTransaction = true;
          
          try {
            // First, move the current tier to a negative value
            await pool.query(
              'UPDATE donation_tiers SET tier_order = -99999 WHERE id = $1',
              [req.params.id]
            );
            
            if (tier_order > currentOrder) {
              // Moving down: shift tiers between current and new position up
              const tiersToShift = await pool.query(
                `SELECT id, tier_order FROM donation_tiers 
                 WHERE tier_order > $1 AND tier_order <= $2 AND is_active = true
                 ORDER BY tier_order ASC`,
                [currentOrder, tier_order]
              );
              
              // Move affected tiers to negative values first
              for (const tier of tiersToShift.rows) {
                await pool.query(
                  'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
                  [-(tier.tier_order - 1), tier.id]
                );
              }
              
              // Move them back to positive values
              for (const tier of tiersToShift.rows) {
                await pool.query(
                  'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
                  [tier.tier_order - 1, tier.id]
                );
              }
            } else {
              // Moving up: shift tiers between new and current position down
              const tiersToShift = await pool.query(
                `SELECT id, tier_order FROM donation_tiers 
                 WHERE tier_order >= $1 AND tier_order < $2 AND is_active = true
                 ORDER BY tier_order DESC`,
                [tier_order, currentOrder]
              );
              
              // Move affected tiers to negative values first
              for (const tier of tiersToShift.rows) {
                await pool.query(
                  'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
                  [-(tier.tier_order + 1), tier.id]
                );
              }
              
              // Move them back to positive values
              for (const tier of tiersToShift.rows) {
                await pool.query(
                  'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
                  [tier.tier_order + 1, tier.id]
                );
              }
            }
            
            // Finally, set the moved tier to its new position
            await pool.query(
              'UPDATE donation_tiers SET tier_order = $1 WHERE id = $2',
              [tier_order, req.params.id]
            );
          } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
          }
        }
      }
    }
    
    const updateQuery = `
      UPDATE donation_tiers
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      if (inTransaction) await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Donation tier not found' });
    }

    // If tier was updated, recalculate all user tiers
    await pool.query('SELECT recalculate_all_donation_tiers()');
    
    if (inTransaction) await pool.query('COMMIT');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating donation tier:', error);
    res.status(500).json({ error: 'Failed to update donation tier' });
  }
});

// Delete donation tier (admin only)
router.delete('/admin/tiers/:id', requireAdmin, validateCSRF, async (req, res) => {
  try {
    // First check if any users have this tier
    const usersWithTier = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE current_donation_tier_id = $1',
      [req.params.id]
    );

    if (parseInt(usersWithTier.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tier that is assigned to users. Deactivate it instead.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM donation_tiers WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation tier not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting donation tier:', error);
    res.status(500).json({ error: 'Failed to delete donation tier' });
  }
});

// Recalculate all user tiers (admin only)
router.post('/admin/recalculate-tiers', requireAdmin, validateCSRF, async (req, res) => {
  try {
    await pool.query('SELECT recalculate_all_donation_tiers()');
    res.json({ success: true, message: 'All user donation tiers recalculated' });
  } catch (error) {
    console.error('Error recalculating donation tiers:', error);
    res.status(500).json({ error: 'Failed to recalculate donation tiers' });
  }
});

// Get donation statistics (admin only)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    // Get total donations
    const totalResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM donations'
    );

    // Get donations by tier
    const tierStatsResult = await pool.query(
      `SELECT 
        dt.name as tier_name,
        dt.badge_color,
        dt.badge_icon,
        COUNT(u.id) as user_count,
        COALESCE(SUM(u.total_donated), 0) as total_donated
       FROM donation_tiers dt
       LEFT JOIN users u ON u.current_donation_tier_id = dt.id
       WHERE dt.is_active = true
       GROUP BY dt.id, dt.name, dt.badge_color, dt.badge_icon, dt.tier_order
       ORDER BY dt.tier_order ASC`
    );

    // Get recent donations
    const recentResult = await pool.query(
      `SELECT 
        d.amount,
        d.currency,
        d.timestamp,
        d.from_name,
        u.nickname,
        u.name as user_name,
        dt.name as tier_name,
        dt.badge_color,
        dt.badge_icon
       FROM donations d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN donation_tiers dt ON u.current_donation_tier_id = dt.id
       ORDER BY d.timestamp DESC
       LIMIT 10`
    );

    res.json({
      totalDonations: parseInt(totalResult.rows[0].count) || 0,
      totalAmount: parseFloat(totalResult.rows[0].total) || 0,
      tierStats: tierStatsResult.rows,
      recentDonations: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching donation statistics:', error);
    res.status(500).json({ error: 'Failed to fetch donation statistics' });
  }
});

  // Reset donation stats for a user (admin only)
  router.post('/admin/reset-user-donations', requireAdmin, validateCSRF, async (req, res) => {
    const { userId } = req.body;
    const targetUserId = userId || req.user.id; // Default to current user if no userId provided
    
    try {
      // Calculate actual total from donations table
      const donationTotal = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE user_id = $1',
        [targetUserId]
      );
      
      const total = parseFloat(donationTotal.rows[0].total);
      
      // Find appropriate tier
      let newTierId = null;
      if (total > 0) {
        const tierResult = await pool.query(
          `SELECT id FROM donation_tiers 
           WHERE required_amount <= $1 AND is_active = true 
           ORDER BY tier_order DESC 
           LIMIT 1`,
          [total]
        );
        if (tierResult.rows.length > 0) {
          newTierId = tierResult.rows[0].id;
        }
      }
      
      // Update user - handle last_donation_date separately to avoid type issues
      if (total === 0) {
        await pool.query(
          `UPDATE users 
           SET total_donated = $1, 
               current_donation_tier_id = $2,
               last_donation_date = NULL
           WHERE id = $3`,
          [total, newTierId, targetUserId]
        );
      } else {
        await pool.query(
          `UPDATE users 
           SET total_donated = $1, 
               current_donation_tier_id = $2
           WHERE id = $3`,
          [total, newTierId, targetUserId]
        );
      }
      
      res.json({ 
        success: true, 
        message: `Donation stats reset for user ${targetUserId}`,
        totalDonated: total,
        tierId: newTierId
      });
    } catch (error) {
      console.error('Error resetting user donations:', error);
      res.status(500).json({ error: 'Failed to reset donation stats' });
    }
  });

  // Test donation endpoint for admins
  router.post('/test-donation', requireAdmin, validateCSRF, async (req, res) => {
      const { amount = 10, currency = 'USD', message = 'Test donation' } = req.body;
      
      try {
        // Create a test donation
        const result = await pool.query(
          `INSERT INTO donations (
            kofi_transaction_id, 
            timestamp, 
            type, 
            is_public, 
            from_name, 
            message, 
            amount, 
            currency, 
            is_subscription, 
            is_first_subscription_payment, 
            tier_name, 
            user_id,
            matched_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
          RETURNING *`,
          [
            'TEST_' + Date.now(), // Unique test transaction ID
            new Date(),
            'Donation',
            true,
            req.user.nickname || req.user.name,
            message,
            amount,
            currency,
            false,
            false,
            null,
            req.user.id,
            'test'
          ]
        );
        
        res.json({ 
          success: true, 
          donation: result.rows[0],
          message: `Test donation of $${amount} created successfully! Refresh the page to see your updated tier.`
        });
      } catch (error) {
        console.error('Error creating test donation:', error);
        res.status(500).json({ error: 'Failed to create test donation' });
      }
    });


  return router;
}