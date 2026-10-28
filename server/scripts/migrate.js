import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes('--reset');

const TABLES = ['audit_log', 'appointments', 'prescriptions', 'quote_items', 'quotes', 'payments', 'lab_order_items',
  'lab_orders', 'lab_exams', 'referrals', 'follow_ups', 'clinical_records', 'patients', 'settings', 'users'];

try {
  if (reset) {
    console.log('Eliminando tablas existentes…');
    await pool.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
  }
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Esquema aplicado correctamente.');
} finally {
  await pool.end();
}
