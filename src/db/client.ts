import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testConnection(): Promise<void> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('DB connected successfully:', result.rows[0].now);
  } catch (err) {
    console.error('DB connection failed:', err);
    throw err;
  }
}
