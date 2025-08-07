import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determine which database URL to use
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  if (process.env.DATABASE_PUBLIC_URL) {
    return process.env.DATABASE_PUBLIC_URL;
  }
  
  throw new Error('No database URL configured');
};

// Configure SSL based on environment
const getSSLConfig = () => {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true') {
    return {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT && { ca: process.env.DATABASE_CA_CERT })
    };
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')) {
    return { rejectUnauthorized: false };
  }
  
  return false;
};

// Session pool with optimized settings for session store
const sessionPool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: getSSLConfig(),
  
  // Smaller pool for sessions
  max: 5,  // Fewer connections for session store
  min: 1,  // Keep at least one connection
  
  // Longer timeouts for session operations
  connectionTimeoutMillis: 60000,  // 60 seconds to connect
  idleTimeoutMillis: 30000,        // 30 seconds idle timeout
  
  // Query timeout
  query_timeout: 30000,             // 30 seconds query timeout
  statement_timeout: 30000,         // 30 seconds statement timeout
  
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Allow exit on idle
  allowExitOnIdle: true,
  
  // Application name for monitoring
  application_name: 'mmc-sessions'
});

// Handle errors silently for session pool
sessionPool.on('error', (err) => {
  if (err.message !== 'Connection terminated unexpectedly') {
    console.error('[Session Pool] Error:', err.message);
  }
});

// Set connection parameters
sessionPool.on('connect', (client) => {
  client.query('SET statement_timeout = 30000')
    .catch(() => {}); // Ignore errors
});

export default sessionPool;