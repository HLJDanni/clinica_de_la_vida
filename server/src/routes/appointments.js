import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { idParam, optText, HttpError } from '../utils.js';

const r = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const GT_DATE = `(a.scheduled_at AT TIME ZONE 'America/Guatemala')::date`;
const GT_TODAY = `(now() AT TIME ZONE 'America/Guatemala')::date`;

const SELECT = `
  SELECT a.*, p.first_name, p.last_name, p.phone, p.initials, p.birth_date, p.gender
  FROM appointments a JOIN patients p ON p.id = a.patient_id`;

r.get('/appointments', async (req, res) => {
  const from = dateRe.test(String(req.query.from)) ? String(req.query.from) : null;
  const to = dateRe.test(String(req.query.to)) ? String(req.query.to) : null;
  const { rows } = await q(
    `${SELECT}
     WHERE ${GT_DATE} >= coalesce($1::date, ${GT_TODAY})
       AND ${GT_DATE} <= coalesce($2::date, ${GT_TODAY} + 60)
     ORDER BY a.scheduled_at`,
    [from, to]
  );
  res.json(rows);
});

// Citas del día siguiente (para el aviso de las 7:30 p. m.)
r.get('/appointments/tomorrow', async (req, res) => {
  const { rows } = await q(
    `${SELECT} WHERE ${GT_DATE} = ${GT_TODAY} + 1 AND a.status IN ('programada', 'confirmada') ORDER BY a.scheduled_at`
  );
  res.json(rows);
});

const ApptSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  scheduled_at: z.string().datetime({ offset: true, message: 'Fecha y hora inválidas' }),
  duration_min: z.coerce.number().int().min(5).max(240).default(30),
  type: z.enum(['consulta', 'seguimiento', 'laboratorio']).default('consulta'),
  reason: optText(300),
  notes: optText(1000),
  force: z.boolean().default(false),
});

async function findConflict(scheduledAt, duration, excludeId = 0) {
  const { rows: [c] } = await q(
    `SELECT a.id, a.scheduled_at, p.first_name, p.last_name FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.id <> $3 AND a.status IN ('programada', 'confirmada') AND a.type <> 'laboratorio'
       AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
        && tstzrange($1::timestamptz, $1::timestamptz + make_interval(mins => $2::int))
     LIMIT 1`,
    [scheduledAt, duration, excludeId]
  );
  return c;
}

r.post('/appointments', async (req, res) => {
  const d = ApptSchema.parse(req.body);
  if (new Date(d.scheduled_at) < new Date(Date.now() - 5 * 60_000)) throw new HttpError(400, 'La cita no puede quedar en el pasado');
  if (!d.force && d.type !== 'laboratorio') {
    const c = await findConflict(d.scheduled_at, d.duration_min);
    if (c) {
      return res.status(409).json({ error: `Ese horario se cruza con la cita de ${c.first_name} ${c.last_name}`, conflict: true });
    }
  }
  const { rows: [row] } = await q(
    `INSERT INTO appointments (patient_id, scheduled_at, duration_min, type, reason, notes, created_by)
     SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (SELECT 1 FROM patients WHERE id = $1) RETURNING id`,
    [d.patient_id, d.scheduled_at, d.duration_min, d.type, d.reason, d.notes, req.user.id]
  );
  if (!row) throw new HttpError(404, 'Paciente no encontrado');
  await audit(req, 'create', 'appointment', row.id);
  const { rows: [full] } = await q(`${SELECT} WHERE a.id = $1`, [row.id]);
  res.status(201).json(full);
});

const PatchSchema = z.object({
  status: z.enum(['programada', 'confirmada', 'completada', 'cancelada', 'no_asistio']).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  reason: optText(300).optional(),
  notes: optText(1000).optional(),
});

r.patch('/appointments/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = PatchSchema.parse(req.body);
  const keys = Object.keys(d).filter((k) => d[k] !== undefined);
  if (!keys.length) throw new HttpError(400, 'Nada que actualizar');
  const { rowCount } = await q(
    `UPDATE appointments SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...keys.map((k) => d[k])]
  );
  if (!rowCount) throw new HttpError(404, 'Cita no encontrada');
  await audit(req, 'update', 'appointment', id, d);
  const { rows: [full] } = await q(`${SELECT} WHERE a.id = $1`, [id]);
  res.json(full);
});

export default r;
