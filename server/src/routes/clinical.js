// Ficha clínica, seguimientos y referencias — exclusivo de la Dra.
import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { audit } from '../audit.js';
import { idParam, optText, examJson, patientType, HttpError } from '../utils.js';
import { RxItem } from './prescriptions.js';

const r = Router();

const ANTECEDENTES = ['ant_medicos', 'ant_quirurgicos', 'ant_traumaticos', 'ant_alergias', 'ant_familiares'];

const RecordSchema = z.object({
  patient_type: patientType,
  motivo_consulta: optText(),
  historia_enfermedad: optText(8000),
  examen_fisico: examJson,
  estudios: optText(),
  diagnostico: optText(),
  tratamiento: optText(),
  referencia: optText(),
  comentarios: optText(),
  antecedentes: z.object(Object.fromEntries(ANTECEDENTES.map((a) => [a, optText()]))).partial().optional(),
});

async function ensurePatient(client, id) {
  const { rowCount } = await client.query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Paciente no encontrado');
}

/* ---------- Ficha clínica (consulta #1) ---------- */
r.get('/patients/:id/record', async (req, res) => {
  const id = idParam(req.params.id);
  const { rows: [rec] } = await q('SELECT * FROM clinical_records WHERE patient_id = $1', [id]);
  res.json(rec || null);
});

r.put('/patients/:id/record', async (req, res) => {
  const id = idParam(req.params.id);
  const d = RecordSchema.parse(req.body);
  const rec = await tx(async (c) => {
    await ensurePatient(c, id);
    const { rows: [row] } = await c.query(
      `INSERT INTO clinical_records (patient_id, patient_type, motivo_consulta, historia_enfermedad, examen_fisico,
         estudios, diagnostico, tratamiento, referencia, comentarios, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (patient_id) DO UPDATE SET
         patient_type = EXCLUDED.patient_type, motivo_consulta = EXCLUDED.motivo_consulta,
         historia_enfermedad = EXCLUDED.historia_enfermedad, examen_fisico = EXCLUDED.examen_fisico,
         estudios = EXCLUDED.estudios, diagnostico = EXCLUDED.diagnostico, tratamiento = EXCLUDED.tratamiento,
         referencia = EXCLUDED.referencia, comentarios = EXCLUDED.comentarios, updated_at = now()
       RETURNING *`,
      [id, d.patient_type, d.motivo_consulta, d.historia_enfermedad, JSON.stringify(d.examen_fisico), d.estudios,
        d.diagnostico, d.tratamiento, d.referencia, d.comentarios, req.user.id]
    );
    if (d.antecedentes) {
      const keys = ANTECEDENTES.filter((k) => k in d.antecedentes);
      if (keys.length) {
        await c.query(
          `UPDATE patients SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
          [id, ...keys.map((k) => d.antecedentes[k])]
        );
      }
    }
    return row;
  });
  await audit(req, 'upsert', 'clinical_record', rec.id);
  res.json(rec);
});

/* ---------- Seguimientos ---------- */
const FollowUpSchema = z.object({
  patient_type: patientType,
  motivo: optText(),
  evolucion: optText(8000),
  examen_fisico: examJson,
  estudios: optText(),
  diagnostico: optText(),
  tratamiento: optText(),
  comentarios: optText(),
  prescription: z
    .object({ items: z.array(RxItem).max(20), indicaciones: optText() })
    .optional()
    .nullable(),
  next_appointment: z
    .object({ scheduled_at: z.string().datetime({ offset: true }), reason: optText(300) })
    .optional()
    .nullable(),
});

r.get('/patients/:id/followups', async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await q(
    `SELECT f.*,
       (SELECT row_to_json(p) FROM prescriptions p WHERE p.follow_up_id = f.id LIMIT 1) AS prescription
     FROM follow_ups f WHERE f.patient_id = $1 ORDER BY f.created_at DESC`,
    [id]
  );
  res.json(rows);
});

r.post('/patients/:id/followups', async (req, res) => {
  const id = idParam(req.params.id);
  const d = FollowUpSchema.parse(req.body);
  const fu = await tx(async (c) => {
    await ensurePatient(c, id);
    const { rows: [rec] } = await c.query('SELECT id FROM clinical_records WHERE patient_id = $1', [id]);
    if (!rec) throw new HttpError(409, 'Primero debe registrarse la ficha clínica (consulta #1)');
    const { rows: [row] } = await c.query(
      `INSERT INTO follow_ups (patient_id, record_id, visit_number, patient_type, motivo, evolucion, examen_fisico,
         estudios, diagnostico, tratamiento, comentarios, created_by)
       VALUES ($1, $2, (SELECT count(*) + 2 FROM follow_ups WHERE patient_id = $1), $3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [id, rec.id, d.patient_type, d.motivo, d.evolucion, JSON.stringify(d.examen_fisico), d.estudios, d.diagnostico,
        d.tratamiento, d.comentarios, req.user.id]
    );
    if (d.prescription?.items?.length) {
      await c.query(
        `INSERT INTO prescriptions (patient_id, follow_up_id, items, indicaciones, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [id, row.id, JSON.stringify(d.prescription.items), d.prescription.indicaciones, req.user.id]
      );
    }
    // La cita del día se marca como atendida automáticamente
    await c.query(
      `UPDATE appointments SET status = 'completada'
       WHERE patient_id = $1 AND status IN ('programada', 'confirmada')
         AND (scheduled_at AT TIME ZONE 'America/Guatemala')::date = (now() AT TIME ZONE 'America/Guatemala')::date`,
      [id]
    );
    if (d.next_appointment) {
      await c.query(
        `INSERT INTO appointments (patient_id, scheduled_at, type, reason, created_by) VALUES ($1, $2, 'seguimiento', $3, $4)`,
        [id, d.next_appointment.scheduled_at, d.next_appointment.reason || 'Seguimiento', req.user.id]
      );
    }
    return row;
  });
  await audit(req, 'create', 'follow_up', fu.id);
  res.status(201).json(fu);
});

r.put('/followups/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = FollowUpSchema.omit({ prescription: true, next_appointment: true }).parse(req.body);
  const { rows: [row] } = await q(
    `UPDATE follow_ups SET patient_type=$2, motivo=$3, evolucion=$4, examen_fisico=$5, estudios=$6, diagnostico=$7,
       tratamiento=$8, comentarios=$9, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, d.patient_type, d.motivo, d.evolucion, JSON.stringify(d.examen_fisico), d.estudios, d.diagnostico, d.tratamiento, d.comentarios]
  );
  if (!row) throw new HttpError(404, 'Seguimiento no encontrado');
  await audit(req, 'update', 'follow_up', id);
  res.json(row);
});

/* ---------- Referencias ---------- */
const ReferralSchema = z.object({
  referido_a: z.string().trim().min(1, 'Indique a dónde se refiere').max(200),
  especialidad: optText(120),
  motivo: optText(),
  historia_enfermedad: optText(8000),
  examen_fisico: optText(8000),
  comentario: optText(),
  tratamiento: optText(),
  impresion_clinica: optText(),
  estudios_realizados: optText(),
});
const REF_COLS = Object.keys(ReferralSchema.shape);

r.get('/patients/:id/referrals', async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await q('SELECT * FROM referrals WHERE patient_id = $1 ORDER BY created_at DESC', [id]);
  res.json(rows);
});

r.post('/patients/:id/referrals', async (req, res) => {
  const id = idParam(req.params.id);
  const d = ReferralSchema.parse(req.body);
  await ensurePatient({ query: q }, id);
  const { rows: [row] } = await q(
    `INSERT INTO referrals (patient_id, ${REF_COLS.join(', ')}, created_by)
     VALUES ($1, ${REF_COLS.map((_, i) => `$${i + 2}`).join(', ')}, $${REF_COLS.length + 2}) RETURNING *`,
    [id, ...REF_COLS.map((k) => d[k]), req.user.id]
  );
  await audit(req, 'create', 'referral', row.id);
  res.status(201).json(row);
});

r.put('/referrals/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = ReferralSchema.parse(req.body);
  const { rows: [row] } = await q(
    `UPDATE referrals SET ${REF_COLS.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...REF_COLS.map((k) => d[k])]
  );
  if (!row) throw new HttpError(404, 'Referencia no encontrada');
  await audit(req, 'update', 'referral', id);
  res.json(row);
});

export default r;
