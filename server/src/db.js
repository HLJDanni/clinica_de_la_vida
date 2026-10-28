import pg from 'pg';

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' (evita corrimientos de zona horaria)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está configurada');

const needsSsl = /sslmode=require/.test(connectionString) || process.env.DATABASE_SSL === 'true';

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});

export const q = (text, params) => pool.query(text, params);

/** Ejecuta fn dentro de una transacción; fn recibe el cliente. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
