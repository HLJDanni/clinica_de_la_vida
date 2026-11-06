// Restaura un respaldo (.cmpvbak) descargado desde Configuración.
//   RESTORE_PASSWORD=... DATABASE_URL=... node scripts/restore.js archivo.cmpvbak --confirmar
//   RESTORE_PASSWORD=... node scripts/restore.js archivo.cmpvbak --solo-descifrar salida.json
// La restauración reemplaza TODOS los datos de la base de destino.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptBackup, TABLES } from '../src/backup.js';

const [file, flag, out] = process.argv.slice(2);
const password = process.env.RESTORE_PASSWORD;
if (!file || !password || !['--confirmar', '--solo-descifrar'].includes(flag)) {
  console.error('Uso: RESTORE_PASSWORD=... node scripts/restore.js <archivo.cmpvbak> --confirmar | --solo-descifrar <salida.json>');
  process.exit(1);
}

const data = decryptBackup(fs.readFileSync(file), password);
console.log(`Respaldo del ${data.created_at}:`, TABLES.map((t) => `${t}=${data.tables[t]?.length ?? 0}`).join(' '));

if (flag === '--solo-descifrar') {
  fs.writeFileSync(out || 'respaldo.json', JSON.stringify(data, null, 2));
  console.log('Descifrado en', out || 'respaldo.json');
  process.exit(0);
}

const { pool, tx } = await import('../src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// pg convierte los arreglos de JS en arreglos de Postgres; las columnas JSON deben ir como texto
const value = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

try {
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  await tx(async (c) => {
    await c.query(`TRUNCATE ${[...TABLES].reverse().join(', ')} RESTART IDENTITY CASCADE`);
    for (const t of TABLES) {
      for (const row of data.tables[t] || []) {
        const cols = Object.keys(row);
        await c.query(
          `INSERT INTO ${t} (${cols.map((k) => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
          cols.map((k) => value(row[k]))
        );
      }
      // Las secuencias continúan después del último id restaurado
      if (t !== 'settings') {
        await c.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), coalesce((SELECT max(id) FROM ${t}), 0) + 1, false)`);
      }
    }
  });
  console.log('Restauración completa.');
} finally {
  await pool.end();
}
