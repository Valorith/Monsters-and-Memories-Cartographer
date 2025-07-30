import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool, { checkPoolHealth } from './src/db/database.js';
import migrate from './src/db/migrate.js';
import passport from './src/auth/passport-config.js';
import multer from 'multer';
import fs from 'fs/promises';
import { promisify } from 'util';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Tokens from 'csrf';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { scheduleAvatarCleanup, cleanupOrphanedAvatars, deleteAllUserAvatars } from './src/utils/avatar-cleanup.js';
import { mapsCache, leaderboardCache, userStatsCache, cacheMiddleware, etagMiddleware } from './src/utils/cache.js';
import { optimizeImage, getExtensionForFormat } from './src/utils/image-optimizer.js';

// Try to load sharp, but make it optional
let sharp;
try {
  sharp = await import('sharp');
  sharp = sharp.default;
  console.log('Sharp image processing library loaded successfully');
} catch (error) {
  console.warn('Sharp not available - avatar uploads will save original images without processing');
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure avatars directory exists
const ensureAvatarsDirectory = async () => {
  const avatarsDir = join(__dirname, 'public', 'avatars');
  try {
    await fs.mkdir(avatarsDir, { recursive: true });
    console.log('✅ Avatars directory ready:', avatarsDir);
    
    // Check if directory is writable
    const testFile = join(avatarsDir, '.write-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    console.log('✅ Avatars directory is writable');
  } catch (error) {
    console.error('❌ Error with avatars directory:', error);
    console.error('   Avatar uploads may fail. Please ensure the directory is writable.');
  }
};

// Environment variable validation
const validateEnvironment = () => {
  const required = [];
  const warnings = [];
  
  // Required in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET) required.push('SESSION_SECRET');
    if (!process.env.DATABASE_URL) required.push('DATABASE_URL');
    if (!process.env.GOOGLE_CLIENT_ID) warnings.push('GOOGLE_CLIENT_ID (OAuth will not work)');
    if (!process.env.GOOGLE_CLIENT_SECRET) warnings.push('GOOGLE_CLIENT_SECRET (OAuth will not work)');
  }
  
  // Always recommended
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) {
    required.push('DATABASE_URL or DATABASE_PUBLIC_URL');
  }
  
  // Check for errors
  if (required.length > 0) {
    console.error('❌ Missing required environment variables:');
    required.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these in your .env file or environment.');
    process.exit(1);
  }
  
  // Show warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Missing optional environment variables:');
    warnings.forEach(v => console.warn(`   - ${v}`));
  }
  
  // Success message
  console.log('✅ Environment variables validated successfully');
};

// Validate environment on startup
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 4173;

// Check if port is in use and try alternative
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
};

// Session store
const PgSession = connectPgSimple(session);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// No longer need uploads directory for avatars

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

// Compression middleware
app.use(compression({
  // Enable compression for responses > 1kb
  threshold: 1024,
  // Compression level (0-9, where 9 is best compression but slowest)
  level: 6,
  // Custom filter to decide which responses to compress
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Don't compress map images to maintain quality
    if (req.url.startsWith('/maps/') && req.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      return false;
    }
    
    // Compress everything else (JSON, HTML, CSS, JS, etc.)
    return compression.filter(req, res);
  }
}));

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply different rate limits to different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests per window (more generous)
  'Too many authentication attempts, please try again later.'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  500, // 500 requests per window (very generous)
  'Too many API requests, please try again later.'
);

// Middleware to skip rate limiting for admins
const skipAdminRateLimit = (limiter) => {
  return (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.is_admin) {
      // Skip rate limiting for admins
      return next();
    }
    // Apply rate limiting for non-admins
    return limiter(req, res, next);
  };
};

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

// Session configuration
// Ensure SESSION_SECRET is set in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session', // connect-pg-simple expects 'session' table by default
    pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
    ttl: 7 * 24 * 60 * 60 // Session TTL in seconds (7 days)
  }),
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-session-secret-change-me' : undefined),
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset session expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (reduced from 30)
    sameSite: 'lax', // CSRF protection
    domain: process.env.COOKIE_DOMAIN || undefined, // Set if needed for subdomains
    path: '/'
  },
  name: 'mmc.sid' // Custom session name instead of default 'connect.sid'
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Session inactivity timeout middleware
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours of inactivity
app.use((req, res, next) => {
  // Skip static assets and non-authenticated requests
  if (!req.isAuthenticated() || req.path.startsWith('/assets/') || req.path.startsWith('/public/')) {
    return next();
  }
  
  // Check for session timeout
  if (req.session && req.session.lastActivity) {
    const now = Date.now();
    const lastActivity = new Date(req.session.lastActivity).getTime();
    
    if (now - lastActivity > SESSION_TIMEOUT) {
      // Session has been inactive too long
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
        }
        
        // For API requests, return 401
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({ 
            error: 'Session expired due to inactivity',
            reason: 'inactivity_timeout'
          });
        }
        // For other requests, redirect to login
        return res.redirect('/');
      });
      return; // Don't continue processing
    }
  }
  
  // Update last activity time for authenticated users
  if (req.session) {
    req.session.lastActivity = new Date();
  }
  
  next();
});

// CSRF Protection
const tokens = new Tokens();

// Generate and attach CSRF token to requests
app.use((req, res, next) => {
  // Skip CSRF for API endpoints that don't need it
  const skipPaths = [
    '/api/auth/google',
    '/api/auth/callback',
    '/api/auth/status',
    '/api/pois',
    '/api/maps'
  ];
  
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Generate or validate token
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  
  // Generate token for this request
  req.csrfToken = () => tokens.create(req.session.csrfSecret);
  
  // Make token available to templates
  res.locals.csrfToken = req.csrfToken();
  
  next();
});

// CSRF validation middleware
const validateCSRF = (req, res, next) => {
  // Skip validation for GET and HEAD requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from body, query, or headers
  const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  
  if (!token || !req.session.csrfSecret) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  if (!tokens.verify(req.session.csrfSecret, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Serve public directory for utility scripts
app.use(express.static(join(__dirname, 'public')));

// Serve avatars with proper caching headers
app.use('/avatars', express.static(join(__dirname, 'public', 'avatars'), {
  maxAge: '1h', // Reduced from 7d to prevent caching issues
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Allow caching but require revalidation
    res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
  }
}));

// Serve map images without compression to maintain quality
app.use('/maps', express.static(join(__dirname, 'public', 'maps'), {
  maxAge: '30d', // Cache maps for 30 days
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Ensure map images are not compressed
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    // Optional: Add header to indicate no compression
    res.setHeader('X-No-Compression', 'true');
  }
}));

// Static file serving with caching headers
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set cache headers based on file type
    if (path.endsWith('.js') || path.endsWith('.css')) {
      // Versioned assets can be cached longer
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif') || path.endsWith('.svg')) {
      // Images can be cached for a week
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (path.endsWith('.html')) {
      // HTML files should not be cached
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.endsWith('.woff') || path.endsWith('.woff2') || path.endsWith('.ttf') || path.endsWith('.eot')) {
      // Fonts can be cached for a year
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// No longer need URL formatting since avatars are stored as base64

// Initialize database on startup
async function initializeDatabase() {
  try {
    // Run migrations if database connection is available
    if (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL) {
      console.log('Initializing database...');
      await migrate();
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// XP Config Cache
const xpConfigCache = new Map();
const XP_CACHE_TTL = 300000; // 5 minutes

// XP Helper Functions
async function getXPConfig(key) {
  try {
    // Check cache first
    const cached = xpConfigCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    // Fetch from database
    const result = await pool.query(
      'SELECT value FROM xp_config WHERE key = $1',
      [key]
    );
    
    const value = result.rows[0]?.value || 0;
    
    // Update cache
    xpConfigCache.set(key, {
      value,
      expiry: Date.now() + XP_CACHE_TTL
    });
    
    return value;
  } catch (error) {
    console.error('Error getting XP config:', error);
    return 0;
  }
}

// Clear XP config cache when admin updates values
function clearXPConfigCache() {
  xpConfigCache.clear();
}

async function updateUserXP(userId, xpChange, reason) {
  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Update user XP
    const result = await pool.query(
      'UPDATE users SET xp = GREATEST(0, xp + $2) WHERE id = $1 RETURNING xp',
      [userId, xpChange]
    );
    
    // Record in XP history
    await pool.query(
      'INSERT INTO xp_history (user_id, xp_change, reason) VALUES ($1, $2, $3)',
      [userId, xpChange, reason]
    );
    
    await pool.query('COMMIT');
    
    console.log(`XP Update: User ${userId} ${xpChange > 0 ? 'gained' : 'lost'} ${Math.abs(xpChange)} XP for ${reason}. New total: ${result.rows[0]?.xp || 0}`);
    
    // Invalidate leaderboard cache when XP changes
    leaderboardCache.delete('top10');
    
    return result.rows[0]?.xp || 0;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating user XP:', error);
    return null;
  }
}

// API Routes
// Apply general API rate limiting to all /api routes (but skip for admins)
app.use('/api/', skipAdminRateLimit(apiLimiter));

// Get all maps - cached for 5 minutes
app.get('/api/maps', 
  cacheMiddleware(mapsCache, 'maps-list', 5 * 60 * 1000), // 5 minutes
  etagMiddleware(),
  async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM maps ORDER BY display_order');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching maps:', error);
      res.status(500).json({ error: 'Failed to fetch maps' });
    }
  }
);

// Get map with all its data - cached for 1 minute
app.get('/api/maps/:id', 
  cacheMiddleware(mapsCache, (req) => `map-${req.params.id}`, 60 * 1000), // 1 minute
  etagMiddleware(),
  async (req, res) => {
    try {
      const mapId = req.params.id;
      
      // Get map details
      const mapResult = await pool.query('SELECT * FROM maps WHERE id = $1', [mapId]);
      if (mapResult.rows.length === 0) {
        return res.status(404).json({ error: 'Map not found' });
      }
      
      // Get POIs
      const poisResult = await pool.query(`
        SELECT p.*, 
          CASE 
            WHEN p.created_by_user_id IS NOT NULL THEN COALESCE(u.nickname, u.name)
            ELSE p.created_by
          END as display_created_by
        FROM pois p
        LEFT JOIN users u ON p.created_by_user_id = u.id
        WHERE p.map_id = $1
      `, [mapId]);
      
      // Get connections
      const connectionsResult = await pool.query(`
        SELECT c.*, 
          fp.name as from_poi_name, fp.x as from_x, fp.y as from_y,
          tp.name as to_poi_name, tp.x as to_x, tp.y as to_y
        FROM connections c
        JOIN pois fp ON c.from_poi_id = fp.id
        JOIN pois tp ON c.to_poi_id = tp.id
        WHERE fp.map_id = $1 OR tp.map_id = $1
      `, [mapId]);
      
      // Get point connectors
      const pointConnectorsResult = await pool.query('SELECT * FROM point_connectors WHERE map_id = $1', [mapId]);
      
      // Get zone connectors for this map
      const zoneConnectorsResult = await pool.query(`
        SELECT zc.*, fm.name as from_map_name, tm.name as to_map_name
        FROM zone_connectors zc
        JOIN maps fm ON zc.from_map_id = fm.id
        JOIN maps tm ON zc.to_map_id = tm.id
        WHERE zc.from_map_id = $1 OR zc.to_map_id = $1
      `, [mapId]);
      
      res.json({
        ...mapResult.rows[0],
        pois: poisResult.rows,
        connections: connectionsResult.rows,
        pointConnectors: pointConnectorsResult.rows,
        zoneConnectors: zoneConnectorsResult.rows
      });
    } catch (error) {
      console.error('Error fetching map data:', error);
      res.status(500).json({ error: 'Failed to fetch map data' });
    }
  }
);

// Create/Update map
app.post('/api/maps', validateCSRF, async (req, res) => {
  try {
    const { id, name, image_url, width, height, display_order } = req.body;
    
    if (id) {
      // Update existing map
      if (image_url !== undefined) {
        // Full update including image
        const result = await pool.query(
          'UPDATE maps SET name = $1, image_url = $2, width = $3, height = $4, display_order = $5 WHERE id = $6 RETURNING *',
          [name, image_url, width, height, display_order, id]
        );
        res.json(result.rows[0]);
      } else {
        // Partial update without image (for reordering)
        const result = await pool.query(
          'UPDATE maps SET name = $1, width = $2, height = $3, display_order = $4 WHERE id = $5 RETURNING *',
          [name, width, height, display_order, id]
        );
        res.json(result.rows[0]);
      }
      // Invalidate cache for this map
      mapsCache.delete(`map-${id}`);
    } else {
      // Create new map
      const result = await pool.query(
        'INSERT INTO maps (name, image_url, width, height, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, image_url, width, height, display_order]
      );
      res.json(result.rows[0]);
    }
    
    // Invalidate maps list cache
    mapsCache.delete('maps-list');
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ error: 'Failed to save map' });
  }
});

// Delete map
app.delete('/api/maps/:id', validateCSRF, async (req, res) => {
  try {
    await pool.query('DELETE FROM maps WHERE id = $1', [req.params.id]);
    
    // Invalidate caches
    mapsCache.delete('maps-list');
    mapsCache.delete(`map-${req.params.id}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// Save POI
app.post('/api/pois', validateCSRF, async (req, res) => {
  try {
    const { id, map_id, name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon } = req.body;
    
    if (id) {
      // Update existing POI
      const result = await pool.query(
        `UPDATE pois SET name = $1, description = $2, x = $3, y = $4, type = $5, icon = $6, icon_size = $7, 
         label_visible = $8, label_position = $9, custom_icon = $10 WHERE id = $11 RETURNING *`,
        [name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon, id]
      );
      res.json(result.rows[0]);
    } else {
      // Create new POI
      const result = await pool.query(
        `INSERT INTO pois (map_id, name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [map_id, name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving POI:', error);
    res.status(500).json({ error: 'Failed to save POI' });
  }
});

// Delete POI
app.delete('/api/pois/:id', validateCSRF, async (req, res) => {
  try {
    await pool.query('DELETE FROM pois WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting POI:', error);
    res.status(500).json({ error: 'Failed to delete POI' });
  }
});

// Save connection
app.post('/api/connections', validateCSRF, async (req, res) => {
  try {
    const { from_poi_id, to_poi_id, bidirectional } = req.body;
    
    const result = await pool.query(
      `INSERT INTO connections (from_poi_id, to_poi_id, bidirectional) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (from_poi_id, to_poi_id) 
       DO UPDATE SET bidirectional = $3 
       RETURNING *`,
      [from_poi_id, to_poi_id, bidirectional]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving connection:', error);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// Delete connection
app.delete('/api/connections/:id', validateCSRF, async (req, res) => {
  try {
    await pool.query('DELETE FROM connections WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Save point connector
app.post('/api/point-connectors', validateCSRF, async (req, res) => {
  try {
    const { 
      id, map_id, name, from_x, from_y, to_x, to_y, to_poi_id,
      from_icon, to_icon, from_icon_size, to_icon_size,
      from_label_visible, to_label_visible, from_label_position, to_label_position,
      from_icon_visible, to_icon_visible, from_label_size, to_label_size
    } = req.body;
    
    // Validate and set defaults for label sizes
    const validatedFromLabelSize = (typeof from_label_size === 'number' && from_label_size > 0) ? from_label_size : 1;
    const validatedToLabelSize = (typeof to_label_size === 'number' && to_label_size > 0) ? to_label_size : 1;
    
    if (id) {
      // Update existing
      const result = await pool.query(
        `UPDATE point_connectors SET 
         name = $1, from_x = $2, from_y = $3, to_x = $4, to_y = $5, to_poi_id = $6,
         from_icon = $7, to_icon = $8, from_icon_size = $9, to_icon_size = $10,
         from_label_visible = $11, to_label_visible = $12, 
         from_label_position = $13, to_label_position = $14,
         from_icon_visible = $15, to_icon_visible = $16,
         from_label_size = $17, to_label_size = $18
         WHERE id = $19 RETURNING *`,
        [name, from_x, from_y, to_x, to_y, to_poi_id, from_icon, to_icon, from_icon_size, to_icon_size,
         from_label_visible, to_label_visible, from_label_position, to_label_position,
         from_icon_visible, to_icon_visible, 
         validatedFromLabelSize,
         validatedToLabelSize,
         id]
      );
      res.json(result.rows[0]);
    } else {
      // Create new
      const result = await pool.query(
        `INSERT INTO point_connectors 
         (map_id, name, from_x, from_y, to_x, to_y, to_poi_id, from_icon, to_icon, 
          from_icon_size, to_icon_size, from_label_visible, to_label_visible,
          from_label_position, to_label_position, from_icon_visible, to_icon_visible,
          from_label_size, to_label_size) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
         RETURNING *`,
        [map_id, name, from_x, from_y, to_x, to_y, to_poi_id, from_icon, to_icon,
         from_icon_size, to_icon_size, from_label_visible, to_label_visible,
         from_label_position, to_label_position, from_icon_visible, to_icon_visible,
         validatedFromLabelSize, validatedToLabelSize]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving point connector:', error);
    res.status(500).json({ error: 'Failed to save point connector: ' + error.message });
  }
});

// Delete point connector
app.delete('/api/point-connectors/:id', validateCSRF, async (req, res) => {
  try {
    await pool.query('DELETE FROM point_connectors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting point connector:', error);
    res.status(500).json({ error: 'Failed to delete point connector' });
  }
});

// Save zone connector
app.post('/api/zone-connectors', validateCSRF, async (req, res) => {
  try {
    const { 
      id, from_map_id, to_map_id, from_x, from_y, to_x, to_y,
      from_icon, to_icon, from_icon_size, to_icon_size,
      from_label, to_label, from_label_visible, to_label_visible,
      from_label_position, to_label_position, from_icon_visible, to_icon_visible,
      from_label_size, to_label_size
    } = req.body;
    
    // Validate and set defaults for label sizes
    const validatedFromLabelSize = (typeof from_label_size === 'number' && from_label_size > 0) ? from_label_size : 1;
    const validatedToLabelSize = (typeof to_label_size === 'number' && to_label_size > 0) ? to_label_size : 1;
    
    if (id) {
      // Update existing
      const result = await pool.query(
        `UPDATE zone_connectors SET 
         from_map_id = $1, to_map_id = $2, from_x = $3, from_y = $4, to_x = $5, to_y = $6,
         from_icon = $7, to_icon = $8, from_icon_size = $9, to_icon_size = $10,
         from_label = $11, to_label = $12, from_label_visible = $13, to_label_visible = $14,
         from_label_position = $15, to_label_position = $16, from_icon_visible = $17, to_icon_visible = $18,
         from_label_size = $19, to_label_size = $20
         WHERE id = $21 RETURNING *`,
        [from_map_id, to_map_id, from_x, from_y, to_x, to_y, from_icon, to_icon,
         from_icon_size, to_icon_size, from_label, to_label, from_label_visible, to_label_visible,
         from_label_position, to_label_position, from_icon_visible, to_icon_visible, 
         validatedFromLabelSize, validatedToLabelSize, id]
      );
      res.json(result.rows[0]);
    } else {
      // Create new
      const result = await pool.query(
        `INSERT INTO zone_connectors 
         (from_map_id, to_map_id, from_x, from_y, to_x, to_y, from_icon, to_icon,
          from_icon_size, to_icon_size, from_label, to_label, from_label_visible, to_label_visible,
          from_label_position, to_label_position, from_icon_visible, to_icon_visible,
          from_label_size, to_label_size) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
         RETURNING *`,
        [from_map_id, to_map_id, from_x, from_y, to_x, to_y, from_icon, to_icon,
         from_icon_size, to_icon_size, from_label, to_label, from_label_visible, to_label_visible,
         from_label_position, to_label_position, from_icon_visible, to_icon_visible,
         validatedFromLabelSize, validatedToLabelSize]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving zone connector:', error);
    res.status(500).json({ error: 'Failed to save zone connector: ' + error.message });
  }
});

// Delete zone connector
app.delete('/api/zone-connectors/:id', validateCSRF, async (req, res) => {
  try {
    await pool.query('DELETE FROM zone_connectors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting zone connector:', error);
    res.status(500).json({ error: 'Failed to delete zone connector' });
  }
});

// OAuth Routes - Apply auth rate limiting
app.get('/auth/google',
  skipAdminRateLimit(authLimiter),
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  skipAdminRateLimit(authLimiter),
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication - regenerate session ID for security
    const tempUser = req.user;
    const tempSession = { ...req.session };
    
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.redirect('/');
      }
      
      // Restore user and essential session data
      req.user = tempUser;
      Object.assign(req.session, tempSession);
      req.session.loginTime = new Date();
      req.session.lastActivity = new Date();
      
      // Optional: Limit concurrent sessions per user
      // This removes other sessions for the same user
      pool.query(
        "DELETE FROM session WHERE sess::jsonb @> $1::jsonb AND sid != $2",
        [JSON.stringify({ passport: { user: tempUser.id } }), req.sessionID]
      ).catch(err => console.error('Error removing old sessions:', err));
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
        res.redirect('/');
      });
    });
  }
);

// Auth status endpoint
// Get CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get('/api/auth/status', async (req, res) => {
  if (req.isAuthenticated()) {
    // Check if user is banned
    try {
      const banCheck = await pool.query(
        'SELECT is_banned, ban_reason FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (banCheck.rows[0]?.is_banned) {
        // Log out banned user
        req.logout(() => {});
        return res.json({ 
          authenticated: false, 
          banned: true, 
          banReason: banCheck.rows[0].ban_reason 
        });
      }
    } catch (error) {
      console.error('Error checking ban status:', error);
    }
    
    // Build avatar URL if user has a custom avatar file
    let avatarUrl = req.user.picture; // Default to OAuth picture
    let avatarMissing = false;
    
    if (req.user.avatar_filename) {
      // Check if file exists
      const avatarPath = join(__dirname, 'public', 'avatars', req.user.avatar_filename);
      const fileExists = await fs.access(avatarPath).then(() => true).catch(() => false);
      
      // Also check if a file with a different extension exists (handle format mismatches)
      let actualFilename = req.user.avatar_filename;
      if (!fileExists) {
        const baseFilename = req.user.avatar_filename.replace(/\.[^.]+$/, '');
        const avatarsDir = join(__dirname, 'public', 'avatars');
        const possibleExtensions = ['jpg', 'png', 'gif', 'webp'];
        
        for (const ext of possibleExtensions) {
          const testFilename = `${baseFilename}.${ext}`;
          const testPath = join(avatarsDir, testFilename);
          if (await fs.access(testPath).then(() => true).catch(() => false)) {
            console.log(`Avatar mismatch detected: DB has ${req.user.avatar_filename} but found ${testFilename}`);
            actualFilename = testFilename;
            // Update database to match actual file
            console.log(`[AVATAR AUTOCORRECT] Updating DB from ${req.user.avatar_filename} to ${testFilename}`);
            pool.query(
              'UPDATE users SET avatar_filename = $1 WHERE id = $2',
              [testFilename, req.user.id]
            ).catch(err => console.error('[AVATAR AUTOCORRECT] Error updating avatar filename:', err));
            break;
          }
        }
      }
      
      const finalFileExists = actualFilename !== req.user.avatar_filename || fileExists;
      
      if (finalFileExists && actualFilename) {
        avatarUrl = `/avatars/${actualFilename}?v=${req.user.avatar_version || 1}`;
        console.log('Serving custom avatar:', {
          userId: req.user.id,
          filename: actualFilename,
          version: req.user.avatar_version,
          url: avatarUrl,
          mismatchFixed: actualFilename !== req.user.avatar_filename
        });
        
        // Update session if filename changed
        if (actualFilename !== req.user.avatar_filename) {
          req.user.avatar_filename = actualFilename;
        }
        
        // Reset missing count if it was previously set
        if (req.user.avatar_missing_count > 0) {
          pool.query(
            'UPDATE users SET avatar_missing_count = 0 WHERE id = $1',
            [req.user.id]
          ).catch(err => console.error('Error resetting avatar missing count:', err));
        }
      } else {
        console.error('Avatar file not found, temporarily using Google picture:', {
          userId: req.user.id,
          filename: req.user.avatar_filename,
          expectedPath: avatarPath,
          timestamp: new Date().toISOString()
        });
        
        avatarMissing = true;
        
        // Don't immediately clear the avatar - it might be a temporary issue
        // Only clear if file has been missing for multiple checks
        try {
          // Check if we've tracked this missing file before
          const missingCheck = await pool.query(
            'SELECT avatar_missing_count FROM users WHERE id = $1',
            [req.user.id]
          );
          
          const missingCount = missingCheck.rows[0]?.avatar_missing_count || 0;
          
          if (missingCount >= 10) {
            // File has been missing for many checks, clear it
            console.error('Avatar missing for 10+ checks, clearing from database');
            await pool.query(
              'UPDATE users SET avatar_filename = NULL, avatar_version = 0, avatar_missing_count = 0 WHERE id = $1',
              [req.user.id]
            );
          } else {
            // Increment missing count
            console.log(`Avatar missing (count: ${missingCount + 1}/10) for user ${req.user.id}`);
            await pool.query(
              'UPDATE users SET avatar_missing_count = COALESCE(avatar_missing_count, 0) + 1 WHERE id = $1',
              [req.user.id]
            );
          }
        } catch (updateError) {
          console.error('Error updating avatar missing count:', updateError);
        }
      }
    }
    
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: avatarUrl,
        displayName: req.user.nickname || req.user.name,
        nickname: req.user.nickname,
        avatarUrl,
        isAdmin: req.user.is_admin,
        xp: req.user.xp || 0,
        // Include avatar state for debugging
        avatarState: {
          hasCustomAvatar: !!req.user.avatar_filename,
          avatarMissing,
          missingCount: avatarMissing ? (req.user.avatar_missing_count || 0) : 0
        }
      },
      // Include admin mode preference from session (secure)
      adminModeEnabled: req.session.adminModeEnabled || false
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout endpoint
app.post('/api/auth/logout', validateCSRF, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Update last visit timestamp
app.post('/api/auth/update-visit', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await pool.query(
      'UPDATE users SET last_visit = CURRENT_TIMESTAMP WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating last visit:', error);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// Get pending XP changes
app.get('/api/auth/pending-xp', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get all unshown XP changes
    const result = await pool.query(
      'SELECT * FROM xp_history WHERE user_id = $1 AND shown = FALSE ORDER BY created_at ASC',
      [req.user.id]
    );
    
    // Mark them as shown
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE xp_history SET shown = TRUE WHERE user_id = $1 AND shown = FALSE',
        [req.user.id]
      );
    }
    
    // Calculate total change
    const totalChange = result.rows.reduce((sum, row) => sum + row.xp_change, 0);
    
    res.json({
      changes: result.rows,
      totalChange,
      currentXP: req.user.xp || 0
    });
  } catch (error) {
    console.error('Error fetching pending XP:', error);
    res.status(500).json({ error: 'Failed to fetch pending XP' });
  }
});

// User preferences endpoints
app.get('/api/user/preferences', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.put('/api/user/preferences', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { theme, notifications_enabled, language } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO user_preferences (user_id, theme, notifications_enabled, language)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET theme = $2, notifications_enabled = $3, language = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, theme, notifications_enabled, language]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Profile update endpoints

// Update nickname
app.put('/api/user/profile/nickname', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let { nickname } = req.body;
  
  // Trim nickname if provided
  if (nickname) {
    nickname = nickname.trim();
  }

  // Validate nickname
  if (nickname) {
    // Length check
    if (nickname.length > 50) {
      return res.status(400).json({ error: 'Nickname must be 50 characters or less' });
    }
    
    // Minimum length
    if (nickname.length < 3) {
      return res.status(400).json({ error: 'Nickname must be at least 3 characters long' });
    }

    // Check for inappropriate content and special characters
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(nickname)) {
      return res.status(400).json({ error: 'Nickname can only contain letters, numbers, spaces, underscores, and hyphens' });
    }
    
    // Trim whitespace
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length < 3) {
      return res.status(400).json({ error: 'Nickname cannot be just whitespace' });
    }
  }

  try {
    // Check if nickname is already taken (case-insensitive)
    if (nickname) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE LOWER(nickname) = LOWER($1) AND id != $2',
        [nickname, req.user.id]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'This nickname is already taken. Please choose another one.' });
      }
    }

    await pool.query(
      'UPDATE users SET nickname = $1 WHERE id = $2',
      [nickname || null, req.user.id]
    );

    // Update session with fresh data from database
    const updatedUser = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (updatedUser.rows.length > 0) {
      req.user = updatedUser.rows[0];
      req.session.save();
    }

    res.json({ success: true, nickname: nickname || null });
  } catch (error) {
    console.error('Error updating nickname:', error);
    res.status(500).json({ error: 'Failed to update nickname' });
  }
});

// Upload profile picture
// Track recent avatar uploads to prevent rapid updates
const recentAvatarUploads = new Map();

// Clean up old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of recentAvatarUploads.entries()) {
    if (now - timestamp > 60000) { // Remove entries older than 1 minute
      recentAvatarUploads.delete(userId);
    }
  }
}, 60000);

app.post('/api/user/profile/avatar', validateCSRF, upload.single('avatar'), async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Prevent rapid-fire uploads
  const lastUpload = recentAvatarUploads.get(req.user.id);
  const now = Date.now();
  if (lastUpload && (now - lastUpload) < 5000) { // 5 second cooldown
    console.warn(`[AVATAR UPLOAD] Rate limit hit for user ${req.user.id}`);
    return res.status(429).json({ error: 'Please wait a few seconds before uploading another avatar' });
  }
  recentAvatarUploads.set(req.user.id, now);

  try {
    // Determine output format based on input to avoid format mismatches
    const mimeToFormat = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    const outputFormat = mimeToFormat[req.file.mimetype] || 'jpeg';
    
    console.log(`Avatar upload: Processing ${req.file.mimetype} as ${outputFormat} format`);
    
    // Optimize the image - use same format as input to avoid mismatches
    const optimized = await optimizeImage(req.file.buffer, {
      maxWidth: 200,
      maxHeight: 200,
      quality: 85,
      fit: 'cover',
      position: 'center',
      preserveAnimation: true,
      outputFormat: outputFormat // Keep the same format as input
    });
    
    let processedBuffer = optimized.buffer;
    let fileExtension = getExtensionForFormat(optimized.format);
    
    console.log(`Avatar format mapping: requested=${outputFormat}, returned=${optimized.format}, extension=${fileExtension}`);
    
    if (optimized.metadata && optimized.metadata.originalSize) {
      console.log(`Avatar optimization: ${optimized.metadata.originalSize} bytes -> ${optimized.metadata.optimizedSize} bytes (${optimized.metadata.compressionRatio || 'N/A'} reduction)`);
    }
    
    // Fall back to original if optimization fails
    if (!processedBuffer || processedBuffer.length === 0) {
      console.warn('Avatar optimization failed, using original buffer');
      processedBuffer = req.file.buffer;
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
      };
      fileExtension = mimeToExt[req.file.mimetype] || 'jpg';
    }

    // Generate unique filename with the actual format we'll be saving
    const filename = `${req.user.id}_${Date.now()}.${fileExtension}`;
    const avatarsDir = join(__dirname, 'public', 'avatars');
    const filepath = join(avatarsDir, filename);
    
    console.log(`Avatar upload: Generated filename ${filename} for format ${optimized.format}`);
    
    // Ensure avatars directory exists
    await fs.mkdir(avatarsDir, { recursive: true });
    
    // Get current avatar to delete old file later
    const currentUser = await pool.query(
      'SELECT avatar_filename FROM users WHERE id = $1',
      [req.user.id]
    );
    const oldAvatarFilename = currentUser.rows[0]?.avatar_filename;
    
    // First, save the file to disk to ensure it's actually written
    try {
      await fs.writeFile(filepath, processedBuffer);
      
      // Verify file was written successfully
      await fs.access(filepath);
      const stats = await fs.stat(filepath);
      if (stats.size === 0) {
        throw new Error('Written file is empty');
      }
      
      console.log(`Avatar file saved successfully: ${filename} (${stats.size} bytes)`);
      
      // Double-check file exists before updating database
      const finalCheck = await fs.access(filepath).then(() => true).catch(() => false);
      if (!finalCheck) {
        console.error(`[AVATAR UPDATE] File verification failed for ${filename} - aborting DB update`);
        return res.status(500).json({ error: 'File verification failed' });
      }
      
      // NOW update database with the confirmed filename
      console.log(`[AVATAR UPDATE] About to update DB for user ${req.user.id} with filename: ${filename}`);
      await pool.query(
        'UPDATE users SET avatar_filename = $1, avatar_version = COALESCE(avatar_version, 1) + 1, avatar_updated_at = CURRENT_TIMESTAMP, avatar_missing_count = 0 WHERE id = $2',
        [filename, req.user.id]
      );
      
      console.log(`[AVATAR UPDATE] Database updated successfully with avatar filename: ${filename}`);
      
      // Success - delete old avatar file if exists
      if (oldAvatarFilename && oldAvatarFilename !== filename) {
        const oldFilepath = join(__dirname, 'public', 'avatars', oldAvatarFilename);
        fs.unlink(oldFilepath).catch(err => {
          console.log(`Failed to delete old avatar ${oldAvatarFilename}:`, err.message);
        });
      }
    } catch (fileError) {
      // File save failed - don't update database
      console.error('Avatar file save failed:', fileError);
      return res.status(500).json({ error: 'Failed to save avatar file' });
    }

    // Update session with fresh data from database
    const updatedUser = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (updatedUser.rows.length > 0) {
      // Update all user properties in session
      Object.assign(req.user, updatedUser.rows[0]);
      
      // Force session save and wait for it to complete
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    // Add a small delay to ensure file system operations complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Build the full avatar URL to return
    const avatarUrl = `/avatars/${filename}?v=${updatedUser.rows[0].avatar_version || 1}`;
    
    // Log successful upload
    console.log('Avatar uploaded successfully:', {
      userId: req.user.id,
      filename,
      version: updatedUser.rows[0].avatar_version,
      size: processedBuffer.length
    });
    
    res.json({ 
      success: true, 
      avatarUrl,
      filename,
      version: updatedUser.rows[0].avatar_version,
      size: processedBuffer.length
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Verify avatar upload
app.get('/api/user/profile/avatar/verify', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get user's avatar info from database
    const result = await pool.query(
      'SELECT avatar_filename, avatar_version FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!result.rows[0]?.avatar_filename) {
      return res.json({ verified: false, reason: 'No avatar filename in database' });
    }
    
    // Check if file exists
    const avatarPath = join(__dirname, 'public', 'avatars', result.rows[0].avatar_filename);
    
    try {
      const stats = await fs.stat(avatarPath);
      
      // Verify file exists and has content
      if (stats.size > 0) {
        // Try to read first few bytes to ensure it's accessible
        const fileHandle = await fs.open(avatarPath, 'r');
        const buffer = Buffer.alloc(10);
        await fileHandle.read(buffer, 0, 10, 0);
        await fileHandle.close();
        
        res.json({ 
          verified: true,
          filename: result.rows[0].avatar_filename,
          size: stats.size,
          version: result.rows[0].avatar_version
        });
      } else {
        res.json({ verified: false, reason: 'File is empty' });
      }
    } catch (error) {
      console.error('Avatar verification failed:', error);
      res.json({ verified: false, reason: 'File not accessible' });
    }
  } catch (error) {
    console.error('Error verifying avatar:', error);
    res.status(500).json({ error: 'Failed to verify avatar' });
  }
});

// Delete custom avatar
app.delete('/api/user/profile/avatar', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get current avatar filename
    const currentUser = await pool.query(
      'SELECT avatar_filename FROM users WHERE id = $1',
      [req.user.id]
    );
    
    // Delete file if exists
    if (currentUser.rows[0]?.avatar_filename) {
      const filepath = join(__dirname, 'public', 'avatars', currentUser.rows[0].avatar_filename);
      await fs.unlink(filepath).catch(() => {}); // Ignore errors if file doesn't exist
    }
    
    // Clear avatar from database
    await pool.query(
      'UPDATE users SET avatar_filename = NULL, avatar_version = NULL, avatar_updated_at = NULL WHERE id = $1',
      [req.user.id]
    );

    // Update session with fresh data from database
    const updatedUser = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (updatedUser.rows.length > 0) {
      req.user = updatedUser.rows[0];
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session after avatar delete:', err);
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

// Get user profile data
app.get('/api/user/profile', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, picture, nickname, avatar_filename, avatar_version, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Recover missing avatar
app.post('/api/user/profile/avatar/recover', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user has an avatar filename but file is missing
    const userResult = await pool.query(
      'SELECT avatar_filename, picture FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = userResult.rows[0];
    if (!user || !user.avatar_filename) {
      return res.status(400).json({ error: 'No avatar to recover' });
    }
    
    // Check if file exists
    const avatarPath = join(__dirname, 'public', 'avatars', user.avatar_filename);
    const fileExists = await fs.access(avatarPath).then(() => true).catch(() => false);
    
    if (fileExists) {
      return res.json({ message: 'Avatar file exists, no recovery needed' });
    }
    
    // Try to download and save Google picture as avatar
    if (user.picture && user.picture.includes('googleusercontent.com')) {
      try {
        const response = await fetch(user.picture);
        if (!response.ok) throw new Error('Failed to fetch Google picture');
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Create avatars directory if it doesn't exist
        const avatarsDir = join(__dirname, 'public', 'avatars');
        await fs.mkdir(avatarsDir, { recursive: true });
        
        // Save with existing filename
        await fs.writeFile(avatarPath, buffer);
        
        // Reset missing count
        await pool.query(
          'UPDATE users SET avatar_missing_count = 0 WHERE id = $1',
          [req.user.id]
        );
        
        console.log('Avatar recovered from Google picture:', user.avatar_filename);
        res.json({ success: true, message: 'Avatar recovered from Google picture' });
      } catch (error) {
        console.error('Failed to recover avatar from Google picture:', error);
        res.status(500).json({ error: 'Failed to recover avatar' });
      }
    } else {
      res.status(400).json({ error: 'No Google picture available for recovery' });
    }
  } catch (error) {
    console.error('Error in avatar recovery:', error);
    res.status(500).json({ error: 'Failed to recover avatar' });
  }
});

// Reset avatar to Google photo
app.post('/api/user/profile/avatar/reset', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Delete all user's avatar files
    const avatarsDir = join(__dirname, 'public', 'avatars');
    const { found, deleted } = await deleteAllUserAvatars(avatarsDir, req.user.id);
    
    console.log(`Reset avatar for user ${req.user.id}: found ${found} files, deleted ${deleted}`);
    
    // Update database to remove avatar filename
    await pool.query(
      'UPDATE users SET avatar_filename = NULL, avatar_version = NULL, avatar_updated_at = NULL, avatar_missing_count = 0 WHERE id = $1',
      [req.user.id]
    );
    
    // Update session
    req.user.avatar_filename = null;
    req.user.avatar_version = null;
    req.user.avatar_updated_at = null;
    req.user.avatar_missing_count = 0;
    
    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    res.json({ 
      success: true, 
      message: 'Avatar reset to Google photo',
      filesDeleted: deleted
    });
  } catch (error) {
    console.error('Error resetting avatar:', error);
    res.status(500).json({ error: 'Failed to reset avatar' });
  }
});

// Get user's Google OAuth picture
app.get('/api/user/google-picture', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await pool.query(
      'SELECT picture FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ picture: result.rows[0].picture });
  } catch (error) {
    console.error('Error fetching Google picture:', error);
    res.status(500).json({ error: 'Failed to fetch Google picture' });
  }
});

// Diagnostic endpoint to fix avatar mismatches
app.post('/api/user/profile/avatar/fix-mismatch', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const avatarsDir = join(__dirname, 'public', 'avatars');
    const files = await fs.readdir(avatarsDir);
    
    // Find all avatar files for this user
    const userAvatarFiles = files.filter(f => 
      f.match(new RegExp(`^${req.user.id}_\\d+\\.(jpg|jpeg|png|gif|webp)$`))
    );
    
    console.log(`Found ${userAvatarFiles.length} avatar files for user ${req.user.id}:`, userAvatarFiles);
    
    // Get current database state
    const dbResult = await pool.query(
      'SELECT avatar_filename, avatar_version FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const dbFilename = dbResult.rows[0]?.avatar_filename;
    console.log('Database avatar filename:', dbFilename);
    
    if (userAvatarFiles.length === 0) {
      // No files found, clear database
      await pool.query(
        'UPDATE users SET avatar_filename = NULL, avatar_version = NULL, avatar_missing_count = 0 WHERE id = $1',
        [req.user.id]
      );
      return res.json({ 
        message: 'No avatar files found, cleared database',
        filesFound: [],
        dbFilename,
        action: 'cleared'
      });
    }
    
    // Find the newest file by timestamp
    const fileInfos = userAvatarFiles.map(f => {
      const match = f.match(/^(\d+)_(\d+)\.(jpg|jpeg|png|gif|webp)$/);
      return {
        filename: f,
        timestamp: parseInt(match[2])
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
    
    const newestFile = fileInfos[0].filename;
    
    // Update database to use the newest file
    await pool.query(
      'UPDATE users SET avatar_filename = $1, avatar_version = COALESCE(avatar_version, 0) + 1, avatar_missing_count = 0 WHERE id = $2',
      [newestFile, req.user.id]
    );
    
    // Delete older files
    const filesToDelete = fileInfos.slice(1).map(f => f.filename);
    for (const file of filesToDelete) {
      await fs.unlink(join(avatarsDir, file)).catch(err => 
        console.error(`Failed to delete old avatar ${file}:`, err)
      );
    }
    
    // Update session
    req.user.avatar_filename = newestFile;
    req.user.avatar_version = (req.user.avatar_version || 0) + 1;
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({
      message: 'Avatar mismatch fixed',
      filesFound: userAvatarFiles,
      dbFilename,
      selectedFile: newestFile,
      deletedFiles: filesToDelete,
      action: 'updated'
    });
  } catch (error) {
    console.error('Error fixing avatar mismatch:', error);
    res.status(500).json({ error: 'Failed to fix avatar mismatch' });
  }
});

// Get top 10 players by XP - cached for 2 minutes
app.get('/api/leaderboard/top10', 
  cacheMiddleware(leaderboardCache, 'top10', 2 * 60 * 1000), // 2 minutes
  etagMiddleware(),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          COALESCE(nickname, name) as display_name,
          avatar_filename,
          avatar_version,
          picture,
          xp,
          GREATEST(1, FLOOR(SQRT(xp / 100))) as level
        FROM users
        WHERE xp >= 0
        ORDER BY xp DESC
        LIMIT 10
      `);
      
      // Calculate XP progress for current level and build avatar URLs
      const players = result.rows.map(player => {
        const level = player.level;
        
        // Calculate total XP needed to reach the current level
        let totalXPForCurrentLevel = 0;
        for (let i = 1; i < level; i++) {
          totalXPForCurrentLevel += i * i * 100;
        }
        
        // Calculate total XP needed to reach the next level
        const totalXPForNextLevel = totalXPForCurrentLevel + (level * level * 100);
        
        // Calculate progress within current level
        const xpInCurrentLevel = player.xp - totalXPForCurrentLevel;
        const xpNeededForNextLevel = totalXPForNextLevel - totalXPForCurrentLevel;
        const progressPercent = (xpInCurrentLevel / xpNeededForNextLevel) * 100;
        
        // Build avatar URL
        let avatarUrl = player.picture; // Default to OAuth picture
        if (player.avatar_filename) {
          avatarUrl = `/avatars/${player.avatar_filename}?v=${player.avatar_version || 1}`;
        }
        
        return {
          id: player.id,
          display_name: player.display_name,
          avatar: avatarUrl,
          xp: player.xp,
          level: player.level,
          xpInCurrentLevel,
          xpNeededForNextLevel,
          progressPercent: Math.min(100, Math.max(0, progressPercent))
        };
      });
      
      res.json(players);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  }
);

// Get user statistics - cached per user for 30 seconds
app.get('/api/user/stats', 
  cacheMiddleware(userStatsCache, (req) => `user-stats-${req.user?.id}`, 30 * 1000), // 30 seconds
  async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const userId = req.user.id;
      
      // Get total POIs created
      const totalPoisResult = await pool.query(
        'SELECT COUNT(*) as count FROM custom_pois WHERE user_id = $1',
        [userId]
      );
      
      // Get approved POIs (published to the map)
      const approvedPoisResult = await pool.query(
        'SELECT COUNT(*) as count FROM custom_pois WHERE user_id = $1 AND status = $2',
        [userId, 'published']
      );
      
      // Get pending POIs
      const pendingPoisResult = await pool.query(
        'SELECT COUNT(*) as count FROM pending_pois WHERE user_id = $1',
        [userId]
      );
      
      // Get total votes cast
      const totalVotesResult = await pool.query(
        'SELECT COUNT(*) as count FROM pending_poi_votes WHERE user_id = $1',
        [userId]
      );
      
      res.json({
        totalPois: parseInt(totalPoisResult.rows[0].count) || 0,
        approvedPois: parseInt(approvedPoisResult.rows[0].count) || 0,
        pendingPois: parseInt(pendingPoisResult.rows[0].count) || 0,
        totalVotes: parseInt(totalVotesResult.rows[0].count) || 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  }
);

// Get user rank
app.get('/api/user/rank', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userId = req.user.id;
    const userXP = req.user.xp || 0;
    
    // Get the rank by counting users with more XP
    const rankResult = await pool.query(
      'SELECT COUNT(*) + 1 as rank FROM users WHERE xp > $1',
      [userXP]
    );
    
    res.json({ rank: parseInt(rankResult.rows[0].rank) || 1 });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
});

// User data download endpoint
app.get('/api/user/data/download', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Collect all user data
    const userData = {
      profile: req.user,
      preferences: await pool.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [req.user.id]
      ).then(r => r.rows[0])
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    res.json(userData);
  } catch (error) {
    console.error('Error downloading user data:', error);
    res.status(500).json({ error: 'Failed to download data' });
  }
});

// Delete user account
app.delete('/api/user/account', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout after deletion' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Logout from all devices
app.post('/api/auth/logout-all', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Delete all sessions for this user
    await pool.query(
      "DELETE FROM session WHERE sess::jsonb @> $1::jsonb",
      [JSON.stringify({ passport: { user: req.user.id } })]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging out from all devices:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

// Admin endpoints
app.get('/api/admin/users', async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const usersResult = await pool.query(
      `SELECT 
        u.id, u.name, u.nickname, COALESCE(u.nickname, u.name) as display_name, 
        u.email, u.picture, u.avatar_filename, u.avatar_version, u.is_admin, u.xp, u.created_at, u.last_visit,
        u.is_banned, u.ban_reason, u.banned_at,
        (SELECT COUNT(*) FROM custom_pois WHERE user_id = u.id) as poi_count,
        (SELECT COUNT(*) FROM pending_pois WHERE user_id = u.id) as pending_poi_count,
        (SELECT COUNT(*) FROM pending_poi_votes WHERE user_id = u.id) as votes_cast
      FROM users u
      ORDER BY u.created_at DESC`
    );
    
    // Add custom_avatar URL for users with avatar_filename
    const usersWithAvatars = usersResult.rows.map(user => ({
      ...user,
      custom_avatar: user.avatar_filename 
        ? `/avatars/${user.avatar_filename}?v=${user.avatar_version || 1}`
        : null
    }));
    
    res.json(usersWithAvatars);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed user information
app.get('/api/admin/users/:userId', async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Get user details
    const userResult = await pool.query(
      `SELECT 
        u.id, u.name, u.nickname, COALESCE(u.nickname, u.name) as display_name,
        u.email, u.picture, u.avatar_filename, u.avatar_version,
        u.is_admin, u.xp, u.created_at, u.last_visit,
        u.is_banned, u.ban_reason, u.banned_at, 
        b.name as banned_by_name
      FROM users u
      LEFT JOIN users b ON u.banned_by = b.id
      WHERE u.id = $1`,
      [req.params.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Add custom_avatar URL if user has avatar_filename
    if (user.avatar_filename) {
      user.custom_avatar = `/avatars/${user.avatar_filename}?v=${user.avatar_version || 1}`;
    }

    // Get POI statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT cp.id) FILTER (WHERE cp.status != 'published') as total_pois,
        COUNT(DISTINCT cp.id) FILTER (WHERE cp.status = 'published') as published_pois,
        COUNT(DISTINCT pp.id) as pending_pois,
        COUNT(DISTINCT pv.id) as votes_cast
      FROM users u
      LEFT JOIN custom_pois cp ON u.id = cp.user_id
      LEFT JOIN pending_pois pp ON u.id = pp.user_id
      LEFT JOIN pending_poi_votes pv ON u.id = pv.user_id
      WHERE u.id = $1`,
      [req.params.userId]
    );

    // Get warnings
    const warningsResult = await pool.query(
      `SELECT w.*, a.name as admin_name 
       FROM user_warnings w
       JOIN users a ON w.admin_id = a.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.params.userId]
    );

    res.json({
      ...user,
      ...statsResult.rows[0],
      warnings: warningsResult.rows
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Ban user
app.post('/api/admin/users/:userId/ban', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Ban reason is required' });
  }

  try {
    // Check if user exists and is not already banned
    const userCheck = await pool.query(
      'SELECT id, is_banned FROM users WHERE id = $1',
      [req.params.userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userCheck.rows[0].is_banned) {
      return res.status(400).json({ error: 'User is already banned' });
    }

    // Ban the user
    await pool.query(
      `UPDATE users 
       SET is_banned = true, ban_reason = $2, banned_at = CURRENT_TIMESTAMP, banned_by = $3
       WHERE id = $1`,
      [req.params.userId, reason, req.user.id]
    );

    // Log out all sessions for this user
    await pool.query(
      "DELETE FROM session WHERE sess::jsonb @> $1::jsonb",
      [JSON.stringify({ passport: { user: parseInt(req.params.userId) } })]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user
app.post('/api/admin/users/:userId/unban', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    await pool.query(
      `UPDATE users 
       SET is_banned = false, ban_reason = NULL, banned_at = NULL, banned_by = NULL
       WHERE id = $1`,
      [req.params.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Warn user
app.post('/api/admin/users/:userId/warn', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Warning reason is required' });
  }

  try {
    await pool.query(
      'INSERT INTO user_warnings (user_id, admin_id, reason) VALUES ($1, $2, $3)',
      [req.params.userId, req.user.id, reason]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error warning user:', error);
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

// Force logout user
app.post('/api/admin/users/:userId/logout', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    await pool.query(
      "DELETE FROM session WHERE sess::jsonb @> $1::jsonb",
      [JSON.stringify({ passport: { user: parseInt(req.params.userId) } })]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error forcing logout:', error);
    res.status(500).json({ error: 'Failed to logout user' });
  }
});

// Update admin status
app.put('/api/admin/users/:userId/admin', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { is_admin } = req.body;

  // Prevent removing your own admin status
  if (req.params.userId == req.user.id && !is_admin) {
    return res.status(400).json({ error: 'Cannot remove your own admin status' });
  }

  try {
    await pool.query(
      'UPDATE users SET is_admin = $2 WHERE id = $1',
      [req.params.userId, is_admin]
    );

    // If changing current user's admin status, regenerate their session
    if (req.params.userId == req.user.id) {
      const tempUser = { ...req.user, is_admin };
      const tempSession = { ...req.session };
      
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session regeneration failed' });
        }
        
        req.user = tempUser;
        Object.assign(req.session, tempSession);
        
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ error: 'Session save failed' });
          }
          res.json({ success: true, sessionRegenerated: true });
        });
      });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Toggle admin status
app.post('/api/admin/users/:userId/toggle-admin', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId } = req.params;

  try {
    await pool.query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Update user XP
app.put('/api/admin/users/:userId/xp', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId } = req.params;
  const { xp, reason } = req.body;

  // Validate XP value
  if (typeof xp !== 'number' || xp < 0) {
    return res.status(400).json({ error: 'Invalid XP value' });
  }

  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Get current XP
    const currentXPResult = await pool.query(
      'SELECT xp FROM users WHERE id = $1',
      [userId]
    );
    
    if (currentXPResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentXP = currentXPResult.rows[0].xp || 0;
    const xpChange = xp - currentXP;
    
    // Update user XP
    await pool.query(
      'UPDATE users SET xp = $1 WHERE id = $2',
      [xp, userId]
    );
    
    // Log XP change in history
    await pool.query(
      'INSERT INTO xp_history (user_id, xp_change, reason, admin_id) VALUES ($1, $2, $3, $4)',
      [userId, xpChange, reason || `Admin adjusted XP from ${currentXP} to ${xp}`, req.user.id]
    );
    
    await pool.query('COMMIT');
    
    res.json({ success: true, newXP: xp });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating user XP:', error);
    res.status(500).json({ error: 'Failed to update XP' });
  }
});

// Toggle admin mode (visual mode only, permissions always checked server-side)
app.post('/api/admin/toggle-mode', validateCSRF, (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Toggle admin mode in session (secure, server-side storage)
  req.session.adminModeEnabled = !req.session.adminModeEnabled;
  
  res.json({ 
    success: true, 
    adminModeEnabled: req.session.adminModeEnabled 
  });
});

// XP Configuration endpoints

// Get all XP config values
app.get('/api/admin/xp-config', async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM xp_config ORDER BY key'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching XP config:', error);
    res.status(500).json({ error: 'Failed to fetch XP configuration' });
  }
});

// Update XP config value
app.put('/api/admin/xp-config/:key', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { value } = req.body;
  
  if (typeof value !== 'number') {
    return res.status(400).json({ error: 'Value must be a number' });
  }

  try {
    const result = await pool.query(
      'UPDATE xp_config SET value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3 WHERE key = $1 RETURNING *',
      [req.params.key, value, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'XP config key not found' });
    }
    
    // Clear the XP config cache when values are updated
    clearXPConfigCache();
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating XP config:', error);
    res.status(500).json({ error: 'Failed to update XP configuration' });
  }
});

// Admin avatar cleanup endpoint
app.post('/api/admin/cleanup-avatars', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const avatarsDir = join(__dirname, 'public', 'avatars');
    const result = await cleanupOrphanedAvatars(avatarsDir);
    res.json({ 
      success: true, 
      message: `Cleaned up ${result.deleted} orphaned avatar files`,
      ...result
    });
  } catch (error) {
    console.error('Avatar cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup avatars' });
  }
});

// Custom POI endpoints

// Get user's custom POIs
app.get('/api/custom-pois', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get POIs created by user and POIs shared with user
    const result = await pool.query(`
      SELECT cp.*, 
             COALESCE(u.nickname, u.name) as owner_name, 
             u.email as owner_email, 
             m.name as map_name,
             CASE WHEN cp.user_id = $1 THEN true ELSE false END as is_owner,
             cp.share_code,
             cp.share_code_revoked,
             (SELECT COUNT(*) FROM shared_pois WHERE custom_poi_id = cp.id AND is_active = true) as share_count,
             sp.is_active as is_shared_active
      FROM custom_pois cp
      JOIN users u ON cp.user_id = u.id
      JOIN maps m ON cp.map_id = m.id
      LEFT JOIN shared_pois sp ON cp.id = sp.custom_poi_id AND sp.user_id = $1
      WHERE cp.user_id = $1
         OR sp.user_id = $1
      ORDER BY cp.created_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching custom POIs:', error);
    res.status(500).json({ error: 'Failed to fetch custom POIs' });
  }
});

// Get custom POIs for a specific map
app.get('/api/maps/:mapId/custom-pois', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.json([]); // Return empty array for non-authenticated users
  }

  try {
    const result = await pool.query(`
      SELECT cp.*, COALESCE(u.nickname, u.name) as owner_name,
        pp.vote_score,
        (SELECT COUNT(*) FROM pending_poi_votes WHERE pending_poi_id = pp.id AND vote = 1) as upvotes,
        (SELECT COUNT(*) FROM pending_poi_votes WHERE pending_poi_id = pp.id AND vote = -1) as downvotes,
        sp.is_active as is_shared_active
      FROM custom_pois cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN pending_pois pp ON pp.custom_poi_id = cp.id
      LEFT JOIN shared_pois sp ON cp.id = sp.custom_poi_id AND sp.user_id = $2
      WHERE cp.map_id = $1 
        AND (cp.user_id = $2 OR (sp.user_id = $2 AND sp.is_active = true))
    `, [req.params.mapId, req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching map custom POIs:', error);
    res.status(500).json({ error: 'Failed to fetch custom POIs' });
  }
});

// Create custom POI
app.post('/api/custom-pois', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { map_id, name, description, x, y, icon, icon_size, label_visible, label_position, custom_icon } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO custom_pois 
       (user_id, map_id, name, description, x, y, icon, icon_size, label_visible, label_position, custom_icon) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [req.user.id, map_id, name, description, Math.round(x), Math.round(y), icon || '📍', icon_size || 24, 
       label_visible !== false, label_position || 'bottom', custom_icon]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating custom POI:', error);
    res.status(500).json({ error: 'Failed to create custom POI' });
  }
});

// Update custom POI
app.put('/api/custom-pois/:id', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { name, description, icon, icon_size, label_visible, label_position, custom_icon, x, y } = req.body;

  try {
    // Check if user owns this POI
    const ownership = await pool.query(
      'SELECT user_id FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (ownership.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own custom POIs' });
    }

    const result = await pool.query(
      `UPDATE custom_pois 
       SET name = $2, description = $3, icon = $4, icon_size = $5, 
           label_visible = $6, label_position = $7, custom_icon = $8,
           x = $9, y = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [req.params.id, name, description, icon, icon_size, label_visible, label_position, custom_icon, x, y]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating custom POI:', error);
    res.status(500).json({ error: 'Failed to update custom POI' });
  }
});

// Delete custom POI
app.delete('/api/custom-pois/:id', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user owns this POI and get its status
    const ownership = await pool.query(
      'SELECT user_id, status FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (ownership.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own custom POIs' });
    }

    const status = ownership.rows[0].status;

    // Begin transaction
    await pool.query('BEGIN');

    // If pending, remove from pending_pois table first
    if (status === 'pending') {
      await pool.query('DELETE FROM pending_poi_votes WHERE pending_poi_id IN (SELECT id FROM pending_pois WHERE custom_poi_id = $1)', [req.params.id]);
      await pool.query('DELETE FROM pending_pois WHERE custom_poi_id = $1', [req.params.id]);
      
      // Deduct XP for removing from pending
      const pendingRemoveXP = await getXPConfig('poi_pending_remove');
      await updateUserXP(req.user.id, pendingRemoveXP, 'removing POI from pending state');
    }

    await pool.query('DELETE FROM custom_pois WHERE id = $1', [req.params.id]);
    
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting custom POI:', error);
    res.status(500).json({ error: 'Failed to delete custom POI' });
  }
});

// Generate or get share code for custom POI
app.post('/api/custom-pois/:id/share', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user owns this POI
    const poiResult = await pool.query(
      'SELECT user_id, share_code, share_code_revoked FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (poiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (poiResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only share your own custom POIs' });
    }

    const poi = poiResult.rows[0];

    // If POI already has a valid share code, return it
    if (poi.share_code && !poi.share_code_revoked) {
      return res.json({ shareCode: poi.share_code });
    }

    // Generate a new 8-character alphanumeric code
    const generateShareCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Keep trying until we get a unique code
    let shareCode;
    let attempts = 0;
    while (attempts < 10) {
      shareCode = generateShareCode();
      
      // Check if code already exists
      const existing = await pool.query(
        'SELECT id FROM custom_pois WHERE share_code = $1',
        [shareCode]
      );
      
      if (existing.rows.length === 0) {
        break; // Found unique code
      }
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique share code' });
    }

    // Update POI with new share code
    await pool.query(
      'UPDATE custom_pois SET share_code = $1, share_code_created_at = CURRENT_TIMESTAMP, share_code_revoked = FALSE WHERE id = $2',
      [shareCode, req.params.id]
    );
    
    res.json({ shareCode });
  } catch (error) {
    console.error('Error creating share link:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Revoke share code for custom POI
app.post('/api/custom-pois/:id/revoke-share', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user owns this POI
    const ownership = await pool.query(
      'SELECT user_id FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (ownership.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only revoke shares for your own custom POIs' });
    }

    // Revoke the share code
    await pool.query(
      'UPDATE custom_pois SET share_code_revoked = TRUE WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// Share POI with specific user (temporary endpoint for testing)
app.post('/api/custom-pois/:id/share-with', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { userEmail } = req.body;

  try {
    // Check if user owns this POI
    const ownership = await pool.query(
      'SELECT user_id FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (ownership.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only share your own custom POIs' });
    }

    // Find user by email
    const targetUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = targetUser.rows[0].id;

    // Check if already shared
    const existingShare = await pool.query(
      'SELECT * FROM custom_poi_shares WHERE custom_poi_id = $1 AND shared_with_user_id = $2',
      [req.params.id, targetUserId]
    );

    if (existingShare.rows.length > 0) {
      return res.status(400).json({ error: 'Already shared with this user' });
    }

    // Create share
    await pool.query(
      'INSERT INTO custom_poi_shares (custom_poi_id, shared_with_user_id, accepted) VALUES ($1, $2, true)',
      [req.params.id, targetUserId]
    );

    res.json({ success: true, message: `POI shared with ${userEmail}` });
  } catch (error) {
    console.error('Error sharing POI:', error);
    res.status(500).json({ error: 'Failed to share POI' });
  }
});

// Add shared POI using share code
app.post('/api/custom-pois/add-shared', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { shareCode } = req.body;

  // Validate share code format (alphanumeric, max 10 chars)
  if (!shareCode || typeof shareCode !== 'string' || shareCode.length > 10 || !/^[A-Z0-9]+$/i.test(shareCode)) {
    return res.status(400).json({ error: 'Invalid share code format' });
  }

  try {
    // Find POI with this share code
    const poiResult = await pool.query(
      `SELECT cp.*, u.nickname, u.name, m.name as map_name
       FROM custom_pois cp
       JOIN users u ON cp.user_id = u.id
       JOIN maps m ON cp.map_id = m.id
       WHERE UPPER(cp.share_code) = UPPER($1) AND cp.share_code_revoked = FALSE`,
      [shareCode]
    );

    if (poiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or revoked share code' });
    }

    const poi = poiResult.rows[0];

    // Check if user owns this POI
    if (poi.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot share a POI with yourself' });
    }

    // Check if already shared with this user
    const existingShare = await pool.query(
      'SELECT id, is_active FROM shared_pois WHERE user_id = $1 AND custom_poi_id = $2',
      [req.user.id, poi.id]
    );

    if (existingShare.rows.length > 0) {
      if (existingShare.rows[0].is_active) {
        return res.status(400).json({ error: 'This POI is already shared with you' });
      } else {
        // Reactivate the share
        await pool.query(
          'UPDATE shared_pois SET is_active = TRUE, share_code = $1, added_at = CURRENT_TIMESTAMP WHERE id = $2',
          [shareCode, existingShare.rows[0].id]
        );
      }
    } else {
      // Create new share entry
      await pool.query(
        'INSERT INTO shared_pois (user_id, custom_poi_id, share_code) VALUES ($1, $2, $3)',
        [req.user.id, poi.id, shareCode]
      );
    }

    res.json({ 
      success: true,
      poi: {
        id: poi.id,
        name: poi.name,
        map_name: poi.map_name,
        owner_name: poi.nickname || poi.name
      }
    });
  } catch (error) {
    console.error('Error adding shared POI:', error);
    res.status(500).json({ error: 'Failed to add shared POI' });
  }
});

// Remove shared POI (unshare)
app.delete('/api/custom-pois/:id/unshare', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if this POI is actually shared with the user (active or revoked)
    const shareCheck = await pool.query(
      'SELECT id FROM shared_pois WHERE custom_poi_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (shareCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shared POI not found' });
    }

    // Delete the share record completely so user can remove revoked shares
    await pool.query(
      'DELETE FROM shared_pois WHERE custom_poi_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing shared POI:', error);
    res.status(500).json({ error: 'Failed to remove shared POI' });
  }
});

// Get users who have added a shared POI
app.get('/api/custom-pois/:id/shared-users', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user owns this POI
    const ownership = await pool.query(
      'SELECT user_id FROM custom_pois WHERE id = $1',
      [req.params.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Custom POI not found' });
    }

    if (ownership.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view share users for your own custom POIs' });
    }

    // Get list of users who have added this POI
    const users = await pool.query(
      `SELECT u.id, COALESCE(u.nickname, u.name) as display_name, sp.added_at
       FROM shared_pois sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.custom_poi_id = $1 AND sp.is_active = TRUE
       ORDER BY sp.added_at DESC`,
      [req.params.id]
    );

    res.json({ users: users.rows });
  } catch (error) {
    console.error('Error fetching shared users:', error);
    res.status(500).json({ error: 'Failed to fetch shared users' });
  }
});

// Accept share code
app.post('/api/share/:shareCode/accept', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Please sign in to accept shared POIs' });
  }

  const { shareCode } = req.params;

  try {
    // Parse the share code to get POI ID (format: poiId-randomCode)
    const [poiIdStr, ...codeParts] = shareCode.split('-');
    const poiId = parseInt(poiIdStr);
    
    if (isNaN(poiId)) {
      return res.status(400).json({ error: 'Invalid share code' });
    }

    // Verify the POI exists
    const poiCheck = await pool.query(
      'SELECT cp.*, COALESCE(u.nickname, u.name) as owner_name FROM custom_pois cp JOIN users u ON cp.user_id = u.id WHERE cp.id = $1',
      [poiId]
    );

    if (poiCheck.rows.length === 0) {
      return res.status(404).json({ error: 'POI not found' });
    }

    const poi = poiCheck.rows[0];

    // Check if user owns this POI
    if (poi.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot accept a share of your own POI' });
    }

    // Check if already shared
    const existingShare = await pool.query(
      'SELECT * FROM custom_poi_shares WHERE custom_poi_id = $1 AND shared_with_user_id = $2',
      [poiId, req.user.id]
    );

    if (existingShare.rows.length > 0) {
      return res.status(400).json({ error: 'This POI is already shared with you' });
    }

    // Create the share
    await pool.query(
      'INSERT INTO custom_poi_shares (custom_poi_id, shared_with_user_id, accepted) VALUES ($1, $2, true)',
      [poiId, req.user.id]
    );

    res.json({ 
      success: true, 
      message: `POI "${poi.name}" shared by ${poi.owner_name} has been added to your account` 
    });
  } catch (error) {
    console.error('Error accepting share:', error);
    res.status(500).json({ error: 'Failed to accept share' });
  }
});

// Publish custom POI to pending
app.post('/api/custom-pois/:id/publish', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if user owns this POI
    const poiCheck = await pool.query(
      'SELECT * FROM custom_pois WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (poiCheck.rows.length === 0) {
      return res.status(404).json({ error: 'POI not found or you do not have permission' });
    }

    const poi = poiCheck.rows[0];

    // Check if already published or pending
    if (poi.status === 'pending') {
      return res.status(400).json({ error: 'POI is already pending approval' });
    }
    if (poi.status === 'published') {
      return res.status(400).json({ error: 'POI has already been published' });
    }

    // Begin transaction
    await pool.query('BEGIN');

    // Update custom POI status
    await pool.query(
      'UPDATE custom_pois SET status = $1 WHERE id = $2',
      ['pending', req.params.id]
    );

    // Create pending POI entry with initial vote score of 1
    const pendingResult = await pool.query(
      `INSERT INTO pending_pois (custom_poi_id, user_id, map_id, name, description, x, y, icon, icon_size, label_visible, label_position, custom_icon, vote_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1)
       RETURNING id`,
      [poi.id, req.user.id, poi.map_id, poi.name, poi.description, poi.x, poi.y, poi.icon, poi.icon_size, poi.label_visible, poi.label_position, poi.custom_icon]
    );

    // Add creator's automatic upvote
    await pool.query(
      'INSERT INTO pending_poi_votes (pending_poi_id, user_id, vote) VALUES ($1, $2, 1)',
      [pendingResult.rows[0].id, req.user.id]
    );

    await pool.query('COMMIT');

    // Award XP for publishing
    const publishXP = await getXPConfig('poi_publish');
    await updateUserXP(req.user.id, publishXP, 'publishing a POI');

    res.json({ success: true, message: 'POI submitted for approval' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error publishing POI:', error);
    res.status(500).json({ error: 'Failed to publish POI' });
  }
});

// Get pending POIs
app.get('/api/pending-pois', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await pool.query(
      `SELECT pp.*, COALESCE(u.nickname, u.name) as creator_name, m.name as map_name,
       COALESCE(pv.vote, 0) as user_vote,
       CASE WHEN pp.user_id = $1 THEN true ELSE false END as is_creator
       FROM pending_pois pp
       JOIN users u ON pp.user_id = u.id
       JOIN maps m ON pp.map_id = m.id
       LEFT JOIN pending_poi_votes pv ON pp.id = pv.pending_poi_id AND pv.user_id = $1
       ORDER BY pp.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error loading pending POIs:', error);
    res.status(500).json({ error: 'Failed to load pending POIs' });
  }
});

// Vote on pending POI
app.post('/api/pending-pois/:id/vote', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { vote } = req.body;
  if (vote !== 1 && vote !== -1) {
    return res.status(400).json({ error: 'Invalid vote value' });
  }

  try {
    await pool.query('BEGIN');

    // Check if pending POI exists
    const poiCheck = await pool.query(
      'SELECT * FROM pending_pois WHERE id = $1',
      [req.params.id]
    );

    if (poiCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending POI not found' });
    }

    // Check if user is the creator and is downvoting
    const pendingPoi = poiCheck.rows[0];
    if (pendingPoi.user_id === req.user.id && vote === -1) {
      // Creator is downvoting their own POI - remove it from pending
      // Update custom POI status back to private
      await pool.query(
        'UPDATE custom_pois SET status = $1 WHERE id = $2',
        ['private', pendingPoi.custom_poi_id]
      );

      // Delete from pending
      await pool.query('DELETE FROM pending_pois WHERE id = $1', [req.params.id]);

      await pool.query('COMMIT');
      
      // Deduct XP for withdrawing from pending
      const pendingRemoveXP = await getXPConfig('poi_pending_remove');
      await updateUserXP(req.user.id, pendingRemoveXP, 'withdrawing POI from pending state');
      
      return res.json({ 
        success: true, 
        message: 'POI withdrawn from community voting', 
        withdrawn: true 
      });
    }

    // Check for existing vote
    const existingVote = await pool.query(
      'SELECT * FROM pending_poi_votes WHERE pending_poi_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    let voteChange = vote;
    if (existingVote.rows.length > 0) {
      // Update existing vote
      voteChange = vote - existingVote.rows[0].vote;
      await pool.query(
        'UPDATE pending_poi_votes SET vote = $1, updated_at = CURRENT_TIMESTAMP WHERE pending_poi_id = $2 AND user_id = $3',
        [vote, req.params.id, req.user.id]
      );
    } else {
      // Insert new vote
      await pool.query(
        'INSERT INTO pending_poi_votes (pending_poi_id, user_id, vote) VALUES ($1, $2, $3)',
        [req.params.id, req.user.id, vote]
      );
    }

    // Update vote score
    await pool.query(
      'UPDATE pending_pois SET vote_score = vote_score + $1 WHERE id = $2',
      [voteChange, req.params.id]
    );

    // Check if POI should be approved or rejected
    const updatedPoi = await pool.query(
      'SELECT pp.*, COALESCE(u.nickname, u.name) as creator_name FROM pending_pois pp JOIN users u ON pp.user_id = u.id WHERE pp.id = $1',
      [req.params.id]
    );

    const updatedPendingPoi = updatedPoi.rows[0];

    if (updatedPendingPoi.vote_score >= 10) {
      // Approve POI
      // Insert into main POIs table with all custom settings
      await pool.query(
        `INSERT INTO pois (map_id, name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon, created_by, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, 'custom', $6, $7, $8, $9, $10, $11, $12)`,
        [updatedPendingPoi.map_id, updatedPendingPoi.name, updatedPendingPoi.description, updatedPendingPoi.x, updatedPendingPoi.y, 
         updatedPendingPoi.icon, updatedPendingPoi.icon_size, updatedPendingPoi.label_visible, updatedPendingPoi.label_position, updatedPendingPoi.custom_icon,
         updatedPendingPoi.creator_name, updatedPendingPoi.user_id]
      );

      // Update custom POI status
      await pool.query(
        'UPDATE custom_pois SET status = $1 WHERE id = $2',
        ['published', updatedPendingPoi.custom_poi_id]
      );

      // Delete from pending
      await pool.query('DELETE FROM pending_pois WHERE id = $1', [req.params.id]);

      // Delete any shares of this custom POI
      await pool.query('DELETE FROM custom_poi_shares WHERE custom_poi_id = $1', [updatedPendingPoi.custom_poi_id]);

      // Delete the custom POI since it's now published
      await pool.query('DELETE FROM custom_pois WHERE id = $1', [updatedPendingPoi.custom_poi_id]);

      await pool.query('COMMIT');
      
      // Award XP for getting POI approved
      const approvedXP = await getXPConfig('poi_approved');
      await updateUserXP(updatedPendingPoi.user_id, approvedXP, 'getting POI approved');
      
      res.json({ success: true, message: 'POI approved and published!', approved: true });
    } else if (updatedPendingPoi.vote_score <= -10) {
      // Reject POI
      // Update custom POI status back to private
      await pool.query(
        'UPDATE custom_pois SET status = $1 WHERE id = $2',
        ['rejected', updatedPendingPoi.custom_poi_id]
      );

      // Delete from pending
      await pool.query('DELETE FROM pending_pois WHERE id = $1', [req.params.id]);

      await pool.query('COMMIT');
      
      // Deduct XP for POI being rejected (removed from pending)
      const pendingRemoveXP = await getXPConfig('poi_pending_remove');
      await updateUserXP(updatedPendingPoi.user_id, pendingRemoveXP, 'POI rejected by community');
      
      res.json({ success: true, message: 'POI rejected', rejected: true });
    } else {
      await pool.query('COMMIT');
      res.json({ success: true, vote_score: updatedPendingPoi.vote_score });
    }
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error voting on POI:', error);
    res.status(500).json({ error: 'Failed to vote on POI' });
  }
});

// Get vote details for a pending POI (admin only)
app.get('/api/pending-pois/:id/votes', async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query(
      `SELECT pv.*, u.name as voter_name, u.email as voter_email
       FROM pending_poi_votes pv
       JOIN users u ON pv.user_id = u.id
       WHERE pv.pending_poi_id = $1
       ORDER BY pv.created_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vote details:', error);
    res.status(500).json({ error: 'Failed to fetch vote details' });
  }
});

// Admin force-publish pending POI
app.post('/api/pending-pois/:id/force-publish', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    await pool.query('BEGIN');

    // Get pending POI details
    const poiResult = await pool.query(
      'SELECT pp.*, COALESCE(u.nickname, u.name) as creator_name FROM pending_pois pp JOIN users u ON pp.user_id = u.id WHERE pp.id = $1',
      [req.params.id]
    );

    if (poiResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending POI not found' });
    }

    const pendingPoi = poiResult.rows[0];

    // Insert into main POIs table with all custom settings
    await pool.query(
      `INSERT INTO pois (map_id, name, description, x, y, type, icon, icon_size, label_visible, label_position, custom_icon, created_by, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'custom', $6, $7, $8, $9, $10, $11, $12)`,
      [pendingPoi.map_id, pendingPoi.name, pendingPoi.description, pendingPoi.x, pendingPoi.y, 
       pendingPoi.icon, pendingPoi.icon_size, pendingPoi.label_visible, pendingPoi.label_position, pendingPoi.custom_icon,
       pendingPoi.creator_name, pendingPoi.user_id]
    );

    // Update custom POI status
    await pool.query(
      'UPDATE custom_pois SET status = $1 WHERE id = $2',
      ['published', pendingPoi.custom_poi_id]
    );

    // Delete from pending
    await pool.query('DELETE FROM pending_pois WHERE id = $1', [req.params.id]);

    // Delete any shares of this custom POI
    await pool.query('DELETE FROM custom_poi_shares WHERE custom_poi_id = $1', [pendingPoi.custom_poi_id]);

    // Delete the custom POI since it's now published
    await pool.query('DELETE FROM custom_pois WHERE id = $1', [pendingPoi.custom_poi_id]);

    await pool.query('COMMIT');
    
    // Award XP for getting POI approved
    const approvedXP = await getXPConfig('poi_approved');
    await updateUserXP(pendingPoi.user_id, approvedXP, 'POI force-approved by admin');
    
    res.json({ success: true, message: 'POI force-published by admin!', approved: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error force-publishing POI:', error);
    res.status(500).json({ error: 'Failed to force-publish POI' });
  }
});

// Admin force-reject pending POI
app.post('/api/pending-pois/:id/force-reject', validateCSRF, async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    await pool.query('BEGIN');

    // Get pending POI details
    const poiResult = await pool.query(
      'SELECT * FROM pending_pois WHERE id = $1',
      [req.params.id]
    );

    if (poiResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending POI not found' });
    }

    const pendingPoi = poiResult.rows[0];

    // Update custom POI status to rejected
    await pool.query(
      'UPDATE custom_pois SET status = $1 WHERE id = $2',
      ['rejected', pendingPoi.custom_poi_id]
    );

    // Delete from pending
    await pool.query('DELETE FROM pending_pois WHERE id = $1', [req.params.id]);

    await pool.query('COMMIT');
    
    // Deduct XP for POI being force-rejected (removed from pending)
    const pendingRemoveXP = await getXPConfig('poi_pending_remove');
    await updateUserXP(pendingPoi.user_id, pendingRemoveXP, 'POI force-rejected by admin');
    
    res.json({ success: true, message: 'POI force-rejected by admin!', rejected: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error force-rejecting POI:', error);
    res.status(500).json({ error: 'Failed to force-reject POI' });
  }
});

// Admin database health monitoring
app.get('/api/admin/db-health', async (req, res) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const health = await checkPoolHealth();
    res.json(health);
  } catch (error) {
    console.error('Error checking database health:', error);
    res.status(500).json({ error: 'Failed to check database health' });
  }
});

// Share page
app.get('/share/:shareCode', async (req, res) => {
  // Check if dist folder exists (production) or use public (development)
  const distPath = join(__dirname, 'dist', 'share.html');
  const publicPath = join(__dirname, 'public', 'share.html');
  
  try {
    await fs.access(distPath);
    res.sendFile(distPath);
  } catch {
    res.sendFile(publicPath);
  }
});

// Serve account page
app.get('/account', async (req, res) => {
  // Check if dist folder exists (production) or use public (development)
  const distPath = join(__dirname, 'dist', 'account.html');
  const publicPath = join(__dirname, 'public', 'account.html');
  
  try {
    await fs.access(distPath);
    res.sendFile(distPath);
  } catch {
    res.sendFile(publicPath);
  }
});

// Handle all other routes by serving index.html (for Vue Router)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(async () => {
  // Ensure avatars directory exists before starting
  await ensureAvatarsDirectory();
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Schedule avatar cleanup to run daily
    const avatarsDir = join(__dirname, 'public', 'avatars');
    scheduleAvatarCleanup(avatarsDir, 24); // Run every 24 hours
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use!`);
      console.error('Please run kill-port-4173.bat to free the port, or use a different port.');
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
});