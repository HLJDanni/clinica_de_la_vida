import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { requireRole } from '../auth.js';
import patients from './patients.js';
import clinical from './clinical.js';
import prescriptions from './prescriptions.js';
import labs from './labs.js';
import payments from './payments.js';
import quotes from './quotes.js';
import appointments from './appointments.js';

const api = Router();

/* ---------- Configuración ---------- */
const SETTING_KEYS = ['consult_price', 'clinic_address', 'clinic_phone', 'doctor_name', 'doctor_title', 'doctor_license'];

api.get('/settings', async (req, res) => {
  const { rows } = await q('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.key === 'consult_price' ? Number(r.value) : r.value])));
});

api.put('/settings', requireRole('doctor'), async (req, res) => {
  const d = z
    .object({
      consult_price: z.coerce.number().min(0).max(100000).optional(),
      clinic_address: z.string().trim().max(300).optional(),
      clinic_phone: z.string().trim().max(60).optional(),
      doctor_name: z.string().trim().max(120).optional(),
      doctor_title: z.string().trim().max(120).optional(),
      doctor_license: z.string().trim().max(60).optional(),
    })
    .parse(req.body);
  for (const k of SETTING_KEYS) {
    if (d[k] === undefined) continue;
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, String(d[k])]);
  }
  await audit(req, 'update', 'settings', null, d);
  const { rows } = await q('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.key === 'consult_price' ? Number(r.value) : r.value])));
});

/* ---------- Tablero ---------- */
api.get('/dashboard', async (req, res) => {
  const doctor = req.user.role === 'doctor';
  const { rows: [stats] } = await q(
    `SELECT
       (SELECT count(*)::int FROM patients) AS patients,
       (SELECT count(*)::int FROM appointments a WHERE (a.scheduled_at AT TIME ZONE 'America/Guatemala')::date = (now() AT TIME ZONE 'America/Guatemala')::date
          AND a.status <> 'cancelada') AS today_appointments,
       (SELECT count(*)::int FROM appointments a WHERE (a.scheduled_at AT TIME ZONE 'America/Guatemala')::date = (now() AT TIME ZONE 'America/Guatemala')::date + 1
          AND a.status IN ('programada', 'confirmada')) AS tomorrow_appointments,
       (SELECT count(*)::int FROM lab_orders WHERE status IN ('solicitado', 'en_proceso')) AS pending_labs,
       (SELECT count(*)::int FROM lab_orders WHERE payment_status = 'pendiente' AND status <> 'cancelado') AS unpaid_labs,
       (SELECT coalesce(sum(amount), 0) FROM payments WHERE (created_at AT TIME ZONE 'America/Guatemala')::date = (now() AT TIME ZONE 'America/Guatemala')::date) AS today_income,
       (SELECT count(*)::int FROM follow_ups WHERE date_trunc('month', created_at AT TIME ZONE 'America/Guatemala') = date_trunc('month', now() AT TIME ZONE 'America/Guatemala')) AS month_followups,
       (SELECT count(*)::int FROM clinical_records WHERE date_trunc('month', created_at AT TIME ZONE 'America/Guatemala') = date_trunc('month', now() AT TIME ZONE 'America/Guatemala')) AS month_records`
  );
  const { rows: today } = await q(
    `SELECT a.*, p.first_name, p.last_name, p.phone, p.initials, p.birth_date
     FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE (a.scheduled_at AT TIME ZONE 'America/Guatemala')::date = (now() AT TIME ZONE 'America/Guatemala')::date
     ORDER BY a.scheduled_at`
  );
  const { rows: recent } = await q(
    doctor
      ? `SELECT p.id, p.first_name, p.last_name, p.initials, p.birth_date, p.gender, x.at, x.kind
         FROM (SELECT patient_id, created_at AS at, 'Seguimiento' AS kind FROM follow_ups
               UNION ALL SELECT patient_id, updated_at, 'Ficha clínica' FROM clinical_records
               UNION ALL SELECT patient_id, created_at, 'Referencia' FROM referrals) x
         JOIN patients p ON p.id = x.patient_id ORDER BY x.at DESC LIMIT 6`
      : `SELECT p.id, p.first_name, p.last_name, p.initials, p.birth_date, p.gender, o.created_at AS at, 'Laboratorio' AS kind
         FROM lab_orders o JOIN patients p ON p.id = o.patient_id ORDER BY o.created_at DESC LIMIT 6`
  );
  res.json({ stats, today, recent });
});

// Ficha clínica, seguimiento y referencia: solo la Dra.
api.use(['/patients/:id/record', '/patients/:id/followups', '/patients/:id/referrals', '/followups', '/referrals'], requireRole('doctor'));
api.use('/patients', patients);
api.use(prescriptions);
api.use(labs);
api.use(payments);
api.use(quotes);
api.use(appointments);
api.use(clinical);

export default api;
