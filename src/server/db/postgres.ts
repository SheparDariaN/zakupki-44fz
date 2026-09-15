import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set');
  }

  pool = new Pool({ connectionString });
  return pool;
}

export async function pingPostgres(): Promise<boolean> {
  try {
    await getPostgresPool().query('select 1');
    return true;
  } catch {
    return false;
  }
}
