import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determine which database URL to use
// In production (Railway), DATABASE_URL is the local connection
// In development, use DATABASE_PUBLIC_URL for remote access
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    console.log('Using production database (local Railway connection)');
    return process.env.DATABASE_URL;
  } else if (process.env.DATABASE_PUBLIC_URL) {
    console.log('Using development database (public URL)');
    return process.env.DATABASE_PUBLIC_URL;
  } else if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL (fallback)');
    return process.env.DATABASE_URL;
  }
  
  throw new Error('No database URL configured. Please set DATABASE_PUBLIC_URL in .env for development.');
};

const connectionString = getDatabaseUrl();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Railway connections
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;