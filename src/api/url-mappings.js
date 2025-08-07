import pool from '../db/database.js';

export default function urlMappingsRouter(app, validateCSRF) {
  // GET /api/url-mappings/check-batch - Check multiple URLs
  app.post('/api/url-mappings/check-batch', async (req, res) => {
    try {
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'No URLs provided' });
      }
      
      // Query for all URLs in batch
      const result = await pool.query(
        `SELECT url, url_type, title, confidence_score, last_verified 
         FROM url_mappings 
         WHERE url = ANY($1)`,
        [urls]
      );
      
      // Create a map of results
      const mappings = {};
      result.rows.forEach(row => {
        mappings[row.url] = {
          type: row.url_type,
          title: row.title,
          confidence: parseFloat(row.confidence_score),
          lastVerified: row.last_verified
        };
      });
      
      res.json(mappings);
    } catch (error) {
      console.error('Error checking URL mappings:', error);
      res.status(500).json({ error: 'Failed to check URL mappings' });
    }
  });
  
  // PUT /api/url-mappings/:encodedUrl - Update or create a URL mapping
  app.put('/api/url-mappings/:encodedUrl', validateCSRF, async (req, res) => {
    try {
      const url = decodeURIComponent(req.params.encodedUrl);
      const { type, title } = req.body;
      
      if (!type || !['item', 'list', 'npc', 'unknown'].includes(type)) {
        return res.status(400).json({ error: 'Invalid URL type' });
      }
      
      // Upsert the URL mapping
      const result = await pool.query(
        `INSERT INTO url_mappings (url, url_type, title, last_verified, confidence_score)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0.8)
         ON CONFLICT (url) DO UPDATE SET
           url_type = $2,
           title = $3,
           last_verified = CURRENT_TIMESTAMP,
           confidence_score = CASE 
             WHEN url_mappings.url_type = $2 THEN LEAST(url_mappings.confidence_score + 0.1, 1.0)
             ELSE 0.5
           END,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [url, type, title || null]
      );
      
      res.json({
        url: result.rows[0].url,
        type: result.rows[0].url_type,
        title: result.rows[0].title,
        confidence: parseFloat(result.rows[0].confidence_score)
      });
    } catch (error) {
      console.error('Error updating URL mapping:', error);
      res.status(500).json({ error: 'Failed to update URL mapping' });
    }
  });
  
  // POST /api/url-mappings/batch-register - Register multiple URLs at once
  app.post('/api/url-mappings/batch-register', validateCSRF, async (req, res) => {
    try {
      const { mappings } = req.body;
      
      if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ error: 'No mappings provided' });
      }
      
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const registered = [];
        
        for (const mapping of mappings) {
          if (!mapping.url || !mapping.type) continue;
          
          const result = await client.query(
            `INSERT INTO url_mappings (url, url_type, title, confidence_score)
             VALUES ($1, $2, $3, 0.5)
             ON CONFLICT (url) DO NOTHING
             RETURNING url`,
            [mapping.url, mapping.type, mapping.title || null]
          );
          
          if (result.rows.length > 0) {
            registered.push(mapping.url);
          }
        }
        
        await client.query('COMMIT');
        
        res.json({ 
          registered: registered.length,
          total: mappings.length 
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error batch registering URLs:', error);
      res.status(500).json({ error: 'Failed to register URLs' });
    }
  });
  
  // GET /api/url-mappings/patterns - Get URL patterns for client-side matching
  app.get('/api/url-mappings/patterns', async (req, res) => {
    try {
      // Get common patterns from high-confidence mappings
      const patterns = await pool.query(`
        WITH url_parts AS (
          SELECT 
            url_type,
            SUBSTRING(url FROM '[^/]+$') as page_name,
            confidence_score
          FROM url_mappings
          WHERE confidence_score >= 0.8
        ),
        prefixes AS (
          SELECT 
            url_type,
            SUBSTRING(page_name FROM '^[^_]+') as prefix,
            COUNT(*) as count
          FROM url_parts
          GROUP BY url_type, prefix
          HAVING COUNT(*) >= 3
        ),
        suffixes AS (
          SELECT 
            url_type,
            SUBSTRING(page_name FROM '[^_]+$') as suffix,
            COUNT(*) as count
          FROM url_parts
          WHERE page_name LIKE '%_%'
          GROUP BY url_type, suffix
          HAVING COUNT(*) >= 3
        )
        SELECT 
          'prefix' as pattern_type,
          url_type,
          prefix as pattern,
          count
        FROM prefixes
        UNION ALL
        SELECT 
          'suffix' as pattern_type,
          url_type,
          suffix as pattern,
          count
        FROM suffixes
        ORDER BY count DESC
      `);
      
      // Organize patterns by type
      const organizedPatterns = {
        prefixes: {},
        suffixes: {}
      };
      
      patterns.rows.forEach(row => {
        const target = row.pattern_type === 'prefix' ? organizedPatterns.prefixes : organizedPatterns.suffixes;
        if (!target[row.pattern]) {
          target[row.pattern] = {};
        }
        target[row.pattern][row.url_type] = row.count;
      });
      
      res.json(organizedPatterns);
    } catch (error) {
      console.error('Error getting URL patterns:', error);
      res.status(500).json({ error: 'Failed to get URL patterns' });
    }
  });
  
  // DELETE /api/url-mappings/:encodedUrl - Remove a URL mapping (admin only)
  app.delete('/api/url-mappings/:encodedUrl', validateCSRF, async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const url = decodeURIComponent(req.params.encodedUrl);
      
      const result = await pool.query(
        'DELETE FROM url_mappings WHERE url = $1 RETURNING url',
        [url]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'URL mapping not found' });
      }
      
      res.json({ message: 'URL mapping deleted' });
    } catch (error) {
      console.error('Error deleting URL mapping:', error);
      res.status(500).json({ error: 'Failed to delete URL mapping' });
    }
  });
}