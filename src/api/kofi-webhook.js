import pool from '../db/database.js';
import crypto from 'crypto';

export default function kofiWebhookRouter(app, validateCSRF) {
  // POST /api/kofi-webhook - Receive Ko-fi webhook notifications
  app.post('/api/kofi-webhook', async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Ko-fi sends data as form data with a single 'data' field containing JSON
      const webhookData = req.body.data ? JSON.parse(req.body.data) : req.body;
      console.log('Parsed webhook data:', webhookData);
      
      // Verify the webhook token
      const verificationToken = process.env.KOFI_VERIFICATION_TOKEN;
      if (!verificationToken) {
        console.error('KOFI_VERIFICATION_TOKEN not configured in environment');
        return res.status(500).json({ error: 'Server configuration error' });
      }
      
      // Ko-fi sends the verification token in the webhook data
      if (webhookData.verification_token !== verificationToken) {
        console.error('Invalid Ko-fi verification token');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Log the donation with formatted output
      console.log('\n' + '='.repeat(60));
      console.log(`[Ko-fi Webhook] ${new Date().toISOString()}`);
      console.log('='.repeat(60));
      console.log(`Type:         ${webhookData.type}`);
      console.log(`From:         ${webhookData.from_name}${webhookData.email ? ` (${webhookData.email})` : ''}`);
      console.log(`Amount:       ${webhookData.currency} ${webhookData.amount}`);
      console.log(`Transaction:  ${webhookData.kofi_transaction_id}`);
      if (webhookData.is_subscription_payment) {
        console.log(`Subscription: Yes${webhookData.is_first_subscription_payment ? ' (First Payment)' : ''}`);
        console.log(`Tier:         ${webhookData.tier_name || 'N/A'}`);
      }
      if (webhookData.message) {
        console.log(`Message:      "${webhookData.message}"`);
      }
      console.log(`Timestamp:    ${webhookData.timestamp}`);
      
      // Extract donation data
      const {
        kofi_transaction_id,
        from_name,
        email,
        amount,
        currency,
        is_public,
        is_subscription_payment,
        is_first_subscription_payment,
        subscription_id,
        tier_name,
        message,
        message_id,
        type,
        timestamp
      } = webhookData;
      
      // Validate required fields
      if (!kofi_transaction_id || !from_name || !amount || !currency || !type || !timestamp) {
        console.error('Missing required fields in Ko-fi webhook');
        return res.status(400).json({ error: 'Invalid webhook data' });
      }
      
      // Convert timestamp to PostgreSQL format
      const donationTimestamp = new Date(timestamp);
      
      // Insert donation into database
      const result = await pool.query(`
        INSERT INTO donations (
          kofi_transaction_id,
          from_name,
          email,
          amount,
          currency,
          is_public,
          is_subscription,
          is_first_subscription_payment,
          subscription_id,
          tier_name,
          message,
          kofi_message_id,
          type,
          timestamp,
          raw_webhook_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (kofi_transaction_id) DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, user_id, matched_by
      `, [
        kofi_transaction_id,
        from_name,
        email || null,
        parseFloat(amount),
        currency,
        is_public === true || is_public === 'true',
        is_subscription_payment === true || is_subscription_payment === 'true',
        is_first_subscription_payment === true || is_first_subscription_payment === 'true',
        subscription_id || null,
        tier_name || null,
        message || null,
        message_id || null,
        type,
        donationTimestamp,
        JSON.stringify(webhookData)
      ]);
      
      const donation = result.rows[0];
      
      // Log matching result
      if (donation.user_id) {
        console.log(`\n✅ Matched:     User #${donation.user_id} (by ${donation.matched_by})`);
      } else {
        console.log(`\n⚠️  Unmatched:   No user found for "${from_name}"${email ? ` (${email})` : ''}`);
      }
      console.log(`⏱️  Processed:   ${Date.now() - startTime}ms`);
      console.log('='.repeat(60) + '\n');
      
      // Check if this is a subscription and we need to update user status
      if ((is_subscription_payment === true || is_subscription_payment === 'true') && donation.user_id) {
        // Here you could add logic to update user subscription status, grant perks, etc.
        console.log(`Processing subscription payment for user ${donation.user_id}`);
      }
      
      // Ko-fi expects a 200 OK response
      res.status(200).json({ 
        success: true,
        donation_id: donation.id,
        matched_user: donation.user_id ? true : false
      });
      
    } catch (error) {
      console.error('\n' + '!'.repeat(60));
      console.error(`[Ko-fi Webhook ERROR] ${new Date().toISOString()}`);
      console.error('!'.repeat(60));
      console.error('Error:', error.message);
      if (error.code) {
        console.error('Error Code:', error.code);
      }
      if (error.detail) {
        console.error('Details:', error.detail);
      }
      console.error('!'.repeat(60) + '\n');
      
      // Still return 200 to Ko-fi to prevent retries, but log the error
      res.status(200).json({ 
        success: false,
        error: 'Internal server error'
      });
    }
  });
  
  // GET /api/donations - Admin endpoint to view donations
  app.get('/api/donations', async (req, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { page = 1, limit = 50, user_id, unmatched } = req.query;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          d.*,
          u.name as user_name,
          u.nickname as user_nickname,
          u.email as user_email
        FROM donations d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 0;
      
      if (user_id) {
        params.push(user_id);
        query += ` AND d.user_id = $${++paramCount}`;
      }
      
      if (unmatched === 'true') {
        query += ` AND d.user_id IS NULL`;
      }
      
      query += ` ORDER BY d.timestamp DESC`;
      
      // Add pagination
      params.push(limit);
      query += ` LIMIT $${++paramCount}`;
      params.push(offset);
      query += ` OFFSET $${++paramCount}`;
      
      const result = await pool.query(query, params);
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM donations d
        WHERE 1=1
      `;
      
      const countParams = [];
      paramCount = 0;
      
      if (user_id) {
        countParams.push(user_id);
        countQuery += ` AND d.user_id = $${++paramCount}`;
      }
      
      if (unmatched === 'true') {
        countQuery += ` AND d.user_id IS NULL`;
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);
      
      res.json({
        donations: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      console.error('Error fetching donations:', error);
      res.status(500).json({ error: 'Failed to fetch donations' });
    }
  });
  
  // PATCH /api/donations/:id/match - Manually match a donation to a user
  app.patch('/api/donations/:id/match', validateCSRF, async (req, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { id } = req.params;
      const { user_id } = req.body;
      
      if (user_id === undefined) {
        return res.status(400).json({ error: 'user_id is required' });
      }
      
      // If user_id is not null, verify user exists
      if (user_id !== null) {
        const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      
      // Update donation
      const result = await pool.query(`
        UPDATE donations 
        SET user_id = $1, matched_by = 'manual', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [user_id, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Donation not found' });
      }
      
      res.json({ 
        success: true,
        donation: result.rows[0]
      });
      
    } catch (error) {
      console.error('Error matching donation:', error);
      res.status(500).json({ error: 'Failed to match donation' });
    }
  });
  
  // GET /api/donations/stats - Get donation statistics
  app.get('/api/donations/stats', async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { user_id } = req.query;
      
      // If not admin, can only see own stats
      if (!req.user.is_admin && user_id && user_id !== req.user.id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const targetUserId = user_id || (req.user.is_admin ? null : req.user.id);
      
      let query = `
        SELECT 
          COUNT(*) as total_donations,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_donors,
          COUNT(*) FILTER (WHERE user_id IS NULL) as unmatched_donations,
          COUNT(*) FILTER (WHERE is_subscription = true) as subscription_payments,
          MAX(timestamp) as last_donation_date
        FROM donations
      `;
      
      const params = [];
      if (targetUserId) {
        query += ' WHERE user_id = $1';
        params.push(targetUserId);
      }
      
      const result = await pool.query(query, params);
      
      res.json({
        stats: result.rows[0]
      });
      
    } catch (error) {
      console.error('Error fetching donation stats:', error);
      res.status(500).json({ error: 'Failed to fetch donation statistics' });
    }
  });
  
  // DELETE /api/donations/:id - Delete a donation (admin only)
  app.delete('/api/donations/:id', validateCSRF, async (req, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { id } = req.params;
      
      // Delete the donation
      const result = await pool.query(
        'DELETE FROM donations WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Donation not found' });
      }
      
      // The database trigger will automatically update the user's tier
      
      res.json({ 
        success: true,
        message: 'Donation deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting donation:', error);
      res.status(500).json({ error: 'Failed to delete donation' });
    }
  });
}