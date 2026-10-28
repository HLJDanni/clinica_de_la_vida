import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { normalize, initialsOf, searchNameOf, idParam, optText, optDate, HttpError } from '../utils.js';
import { ORDER_SELECT } from './labs.js';

const r = Router();
const isDoctor = (req) => req.user.role === 'doctor';

const BASIC = `p.id, p.first_name, p.last_name, p.birth_date, p.gender, p.address, p.phone, p.religion, p.dpi,
  p.initials, p.created_at, p.updated_at`;
const ANTECEDENTES = ['ant_medicos', 'ant_quirurgicos', 'ant_traumaticos', 'ant_alergias', 'ant_familiares'];
const fields = (req) => (isDoctor(req) ? `${BASIC}, ${ANTECEDENTES.map((a) => `p.${a}`).join(', ')}` : BASIC);

const PatientSchema = z.object({
  first_name: z.string().trim().min(1, 'El nombre es requerido').max(80),
  last_name: z.string().trim().min(1, 'El apellido es requerido').max(80),
  birth_date: optDate(),
  gender: z.preprocess((v) => v || null, z.enum(['F', 'M']).nullable()),
  address: optText(300),
  phone: optText(40),
  religion: optText(60),
  dpi: optText(30),
  ...Object.fromEntries(ANTECEDENTES.map((a) => [a, optText()])),
});

// Búsqueda por nombre completo, iniciales (ej. "MJLP"), teléfono o DPI
r.get('/', async (req, res) => {
  const raw = String(req.query.q || '').slice(0, 100);
  const n = normalize(raw).replace(/[^a-z0-9\s]/g, ' ').trim();
  const params = [];
  let where = 'TRUE';
  let rank = '';
  if (n) {
    params.push(n.split(/\s+/).map((t) => `%${t}%`));
    const conds = [`p.search_name LIKE ALL($1::text[])`];
    const ini = n.replace(/[^a-z]/g, '').toUpperCase();
    if (ini.length >= 2 && ini.length <= 6) {
      params.push(ini);
      conds.push(`p.initials LIKE $${params.length} || '%'`);
      rank = `CASE WHEN p.initials = $${params.length} THEN 0 WHEN p.initials LIKE $${params.length} || '%' THEN 1 ELSE 2 END, `;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 4) {
      params.push(`%${digits}%`);
      conds.push(`regexp_replace(coalesce(p.phone, '') || ' ' || coalesce(p.dpi, ''), '\\D', '', 'g') LIKE $${params.length}`);
    }
    where = `(${conds.join(' OR ')})`;
  }
  const doctorCols = isDoctor(req)
    ? `, EXISTS (SELECT 1 FROM clinical_records c WHERE c.patient_id = p.id) AS has_record,
         (SELECT count(*)::int FROM follow_ups f WHERE f.patient_id = p.id) AS followups_count`
    : '';
  const { rows } = await q(
    `SELECT ${BASIC},
       (SELECT min(a.scheduled_at) FROM appointments a
         WHERE a.patient_id = p.id AND a.scheduled_at >= now() AND a.status IN ('programada', 'confirmada')) AS next_appointment,
       (SELECT count(*)::int FROM lab_orders l WHERE l.patient_id = p.id) AS lab_count
       ${doctorCols}
     FROM patients p
     WHERE ${where}
     ORDER BY ${rank}p.last_name, p.first_name
     LIMIT 150`,
    params
  );
  res.json(rows);
});

r.get('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const {
    rows: [p],
  } = await q(`SELECT ${fields(req)} FROM patients p WHERE p.id = $1`, [id]);
  if (!p) throw new HttpError(404, 'Paciente no encontrado');
  if (isDoctor(req)) {
    const { rows: [c] } = await q(
      `SELECT EXISTS (SELECT 1 FROM clinical_records WHERE patient_id = $1) AS has_record,
              (SELECT count(*)::int FROM follow_ups WHERE patient_id = $1) AS followups_count,
              (SELECT count(*)::int FROM referrals WHERE patient_id = $1) AS referrals_count`,
      [id]
    );
    Object.assign(p, c);
  }
  res.json(p);
});

r.post('/', async (req, res) => {
  const data = PatientSchema.parse(req.body);
  if (!isDoctor(req)) ANTECEDENTES.forEach((a) => (data[a] = null));
  const cols = ['first_name', 'last_name', 'birth_date', 'gender', 'address', 'phone', 'religion', 'dpi', ...ANTECEDENTES];
  const values = cols.map((c) => data[c]);
  const {
    rows: [p],
  } = await q(
    `INSERT INTO patients (${cols.join(', ')}, initials, search_name, created_by)
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2}, $${cols.length + 3})
     RETURNING id`,
    [...values, initialsOf(data.first_name, data.last_name), searchNameOf(data.first_name, data.last_name), req.user.id]
  );
  await audit(req, 'create', 'patient', p.id);
  const { rows: [full] } = await q(`SELECT ${fields(req)} FROM patients p WHERE p.id = $1`, [p.id]);
  res.status(201).json(full);
});

r.put('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const data = PatientSchema.parse(req.body);
  // Recepción solo puede modificar datos generales
  const cols = ['first_name', 'last_name', 'birth_date', 'gender', 'address', 'phone', 'religion', 'dpi', ...(isDoctor(req) ? ANTECEDENTES : [])];
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rowCount } = await q(
    `UPDATE patients SET ${sets}, initials = $${cols.length + 2}, search_name = $${cols.length + 3}, updated_at = now() WHERE id = $1`,
    [id, ...cols.map((c) => data[c]), initialsOf(data.first_name, data.last_name), searchNameOf(data.first_name, data.last_name)]
  );
  if (!rowCount) throw new HttpError(404, 'Paciente no encontrado');
  await audit(req, 'update', 'patient', id);
  const { rows: [full] } = await q(`SELECT ${fields(req)} FROM patients p WHERE p.id = $1`, [id]);
  res.json(full);
});

// Laboratorios, recetas, citas y pagos del paciente (compartido Dra./Recepción)
r.get('/:id/overview', async (req, res) => {
  const id = idParam(req.params.id);
  const [labs, rx, appts, pays] = await Promise.all([
    q(`${ORDER_SELECT} WHERE o.patient_id = $1 ORDER BY o.created_at DESC`, [id]),
    q(`SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC`, [id]),
    q(`SELECT * FROM appointments WHERE patient_id = $1 ORDER BY scheduled_at DESC LIMIT 50`, [id]),
    q(`SELECT * FROM payments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
  ]);
  res.json({ labs: labs.rows, prescriptions: rx.rows, appointments: appts.rows, payments: pays.rows });
});

export default r;
