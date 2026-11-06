// Respaldo de la información (solo la Dra.)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { dumpDatabase, encryptBackup } from '../backup.js';
import { HttpError } from '../utils.js';

const r = Router();
export const BACKUP_EVERY_DAYS = 7;

const setting = async (key) => (await q('SELECT value FROM settings WHERE key = $1', [key])).rows[0]?.value ?? null;
const save = (key, value) =>
  q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);

r.get('/backup/status', async (req, res) => {
  const [last, hash] = await Promise.all([setting('last_backup_at'), setting('backup_password_hash')]);
  res.json({ last_backup_at: last, has_password: !!hash, every_days: BACKUP_EVERY_DAYS });
});

const BackupSchema = z.object({
  password: z.string().min(8, 'La contraseña del respaldo debe tener al menos 8 caracteres').max(200),
  new_password: z.boolean().default(false),
});

// Pocos intentos: cada respaldo cifra la base completa
const limiter = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados respaldos seguidos. Intente en unos minutos.' } });

r.post('/backup', limiter, async (req, res) => {
  const { password, new_password } = BackupSchema.parse(req.body);
  const hash = await setting('backup_password_hash');
  // Todos los respaldos usan la misma contraseña, para no olvidar cuál abre cada archivo
  if (hash && !new_password && !(await bcrypt.compare(password, hash))) {
    throw new HttpError(400, 'La contraseña no coincide con la de los respaldos anteriores');
  }
  if (!hash || new_password) await save('backup_password_hash', await bcrypt.hash(password, 12));

  const data = await dumpDatabase(q);
  const file = encryptBackup(data, password);
  const now = new Date().toISOString();
  await save('last_backup_at', now);
  await audit(req, 'backup', 'database', null, { bytes: file.length, new_password: !hash || new_password });

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="Respaldo_Clinica_${day}.cmpvbak"`,
    'Content-Length': file.length,
    'X-Backup-At': now,
  });
  res.send(file);
});

export default r;
