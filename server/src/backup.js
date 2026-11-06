// Respaldo completo de la base de datos: JSON comprimido y cifrado con AES-256-GCM.
// Formato del archivo: MAGIC (8 bytes) | salt (16) | iv (12) | tag (16) | datos cifrados
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const MAGIC = Buffer.from('CMPVBAK1');
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// Orden de restauración (respeta las llaves foráneas)
export const TABLES = [
  'users', 'settings', 'patients', 'lab_exams', 'clinical_records', 'follow_ups', 'referrals', 'lab_orders',
  'lab_order_items', 'payments', 'quotes', 'quote_items', 'prescriptions', 'appointments', 'audit_log',
];

const deriveKey = (password, salt) => crypto.scryptSync(password, salt, 32, SCRYPT);

export function encryptBackup(data, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(password, salt), iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(JSON.stringify(data))), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(buf, password) {
  if (!buf.subarray(0, 8).equals(MAGIC)) throw new Error('El archivo no es un respaldo de la clínica');
  const salt = buf.subarray(8, 24);
  const iv = buf.subarray(24, 36);
  const tag = buf.subarray(36, 52);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(password, salt), iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(buf.subarray(52)), decipher.final()]);
  } catch {
    throw new Error('Contraseña incorrecta o archivo dañado');
  }
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
}

/** Lee todas las tablas; la contraseña del respaldo nunca se incluye. */
export async function dumpDatabase(query) {
  const tables = {};
  for (const t of TABLES) {
    // row_to_json conserva los valores exactos (p. ej. microsegundos de las fechas, que Date de JS recorta)
    const { rows } = await query(
      `SELECT row_to_json(x) AS r FROM ${t} x${t === 'settings' ? ` WHERE key <> 'backup_password_hash'` : ''}`
    );
    tables[t] = rows.map((row) => row.r);
  }
  return { app: 'clinica-pasion-por-la-vida', format: 1, created_at: new Date().toISOString(), tables };
}
