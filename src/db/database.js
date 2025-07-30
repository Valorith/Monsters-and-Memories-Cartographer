import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determine which database URL to use
// Railway provides DATABASE_URL automatically when services are linked
const getDatabaseUrl = () => {
  // First check for DATABASE_URL (Railway provides this)
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL');
    return process.env.DATABASE_URL;
  }
  
  // Fall back to PUBLIC URL for local development
  if (process.env.DATABASE_PUBLIC_URL) {
    console.log('Using DATABASE_PUBLIC_URL (development)');
    return process.env.DATABASE_PUBLIC_URL;
  }
  
  throw new Error('No database URL configured. Please set DATABASE_URL in Railway or DATABASE_PUBLIC_URL in .env for development.');
};

const connectionString = getDatabaseUrl();

// Configure SSL based on environment
const getSSLConfig = () => {
  // In production or when explicitly enabled, use strict SSL
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true') {
    return {
      rejectUnauthorized: true,
      // Allow custom CA certificate if provided
      ...(process.env.DATABASE_CA_CERT && { ca: process.env.DATABASE_CA_CERT })
    };
  }
  
  // For Railway development, use their SSL config
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')) {
    return { rejectUnauthorized: false };
  }
  
  // Local development without SSL
  return false;
};

// Optimized pool configuration
const pool = new Pool({
  connectionString,
  ssl: getSSLConfig(),
  
  // Connection pool settings
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 20, // Maximum number of clients in the pool
  min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 2,  // Minimum number of clients in the pool
  
  // Connection timeout settings (in milliseconds)
  connectionTimeoutMillis: 30000, // 30 seconds to connect
  idleTimeoutMillis: 30000,       // 30 seconds before idle connection is closed
  
  // Query timeout
  query_timeout: 60000,            // 60 seconds query timeout
  statement_timeout: 60000,        // 60 seconds statement timeout
  
  // Keep alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // 10 seconds before first keepalive probe
  
  // Allow application_name for better monitoring
  application_name: 'mmc-server'
});

// Test the connection
pool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL database');
  
  // Set session parameters for each new connection
  client.query('SET statement_timeout = 60000') // 60 seconds
    .catch(err => console.error('Error setting statement timeout:', err));
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process, just log the error
  // The pool will handle reconnection automatically
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Pool health check function
export async function checkPoolHealth() {
  try {
    const result = await pool.query('SELECT NOW()');
    const stats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      timestamp: result.rows[0].now
    };
    return { healthy: true, stats };
  } catch (error) {
    console.error('Pool health check failed:', error);
    return { healthy: false, error: error.message };
  }
}

// Graceful shutdown
export async function closePool() {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

export default pool;