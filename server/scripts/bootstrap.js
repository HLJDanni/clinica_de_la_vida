// Arranque en producción: aplica el esquema (idempotente) y, solo si la base está vacía,
// carga los usuarios y los datos de prueba. Nunca borra datos existentes.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let empty;
try {
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  empty = rows[0].n === 0;
  console.log(empty ? 'Base de datos vacía: se cargarán los datos iniciales.' : 'Esquema verificado; se conservan los datos existentes.');
} finally {
  await pool.end();
}

if (empty) execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit' });
