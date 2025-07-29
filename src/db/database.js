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