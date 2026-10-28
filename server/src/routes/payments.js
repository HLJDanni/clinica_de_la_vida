import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { optText, optId, HttpError } from '../utils.js';
import { PayMethod } from './labs.js';

const r = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// Cobros de un día (hora de Guatemala)
r.get('/payments', async (req, res) => {
  const date = dateRe.test(String(req.query.date)) ? String(req.query.date) : null;
  const { rows } = await q(
    `SELECT pay.*, p.first_name, p.last_name, u.full_name AS received_by_name
     FROM payments pay
     LEFT JOIN patients p ON p.id = pay.patient_id
     LEFT JOIN users u ON u.id = pay.received_by
     WHERE (pay.created_at AT TIME ZONE 'America/Guatemala')::date = coalesce($1::date, (now() AT TIME ZONE 'America/Guatemala')::date)
     ORDER BY pay.created_at DESC`,
    [date]
  );
  res.json(rows);
});

const PaymentSchema = z.object({
  patient_id: optId(),
  concept: z.enum(['consulta', 'otro']),
  amount: z.coerce.number().min(0).max(100000).optional(),
  description: optText(300),
  method: PayMethod,
});

r.post('/payments', async (req, res) => {
  const d = PaymentSchema.parse(req.body);
  let amount = d.amount;
  if (d.concept === 'consulta' && amount === undefined) {
    const { rows: [s] } = await q(`SELECT value FROM settings WHERE key = 'consult_price'`);
    amount = Number(s?.value || 0);
  }
  if (amount === undefined) throw new HttpError(400, 'Indique el monto');
  const { rows: [row] } = await q(
    `INSERT INTO payments (patient_id, concept, description, amount, method, received_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [d.patient_id, d.concept, d.description || (d.concept === 'consulta' ? 'Consulta médica' : null), amount, d.method, req.user.id]
  );
  await audit(req, 'create', 'payment', row.id, { amount, concept: d.concept });
  res.status(201).json(row);
});

export default r;
