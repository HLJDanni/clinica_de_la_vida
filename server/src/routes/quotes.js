import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { audit } from '../audit.js';
import { idParam, optText, optId, HttpError } from '../utils.js';
import { createOrder, ORDER_SELECT } from './labs.js';

const r = Router();

const QUOTE_SELECT = `
  SELECT qt.*, u.full_name AS created_by_name,
    coalesce((SELECT json_agg(json_build_object('id', i.id, 'exam_id', i.exam_id, 'name', i.name, 'price', i.price, 'qty', i.qty) ORDER BY i.id)
              FROM quote_items i WHERE i.quote_id = qt.id), '[]'::json) AS items
  FROM quotes qt LEFT JOIN users u ON u.id = qt.created_by`;

const QuoteSchema = z
  .object({
    customer_name: z.string().trim().min(1, 'Indique el nombre del cliente').max(160),
    customer_phone: optText(40),
    patient_id: optId(),
    items: z.array(z.object({ exam_id: z.coerce.number().int().positive(), qty: z.coerce.number().int().min(1).max(50).default(1) })).max(60),
    include_consulta: z.boolean().default(false),
    discount_pct: z.coerce.number().min(0).max(100).default(0),
    notes: optText(1000),
    valid_days: z.coerce.number().int().min(1).max(90).default(15),
  })
  .refine((d) => d.items.length || d.include_consulta, { message: 'Agregue al menos un examen', path: ['items'] });

r.get('/quotes', async (req, res) => {
  const { rows } = await q(`${QUOTE_SELECT} ORDER BY qt.created_at DESC LIMIT 200`);
  res.json(rows);
});

r.post('/quotes', async (req, res) => {
  const d = QuoteSchema.parse(req.body);
  const quote = await tx(async (c) => {
    const ids = d.items.map((i) => i.exam_id);
    const { rows: exams } = await c.query('SELECT id, name, price FROM lab_exams WHERE id = ANY($1::int[]) AND active', [ids]);
    if (exams.length !== new Set(ids).size) throw new HttpError(400, 'Hay exámenes inválidos o inactivos');
    const lines = d.items.map((i) => {
      const e = exams.find((x) => x.id === i.exam_id);
      return { exam_id: e.id, name: e.name, price: e.price, qty: i.qty };
    });
    if (d.include_consulta) {
      const { rows: [s] } = await c.query(`SELECT value FROM settings WHERE key = 'consult_price'`);
      lines.unshift({ exam_id: null, name: 'Consulta médica — Dra. Delia', price: Number(s?.value || 0), qty: 1 });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const total = Math.round(subtotal * (1 - d.discount_pct / 100) * 100) / 100;
    const { rows: [qt] } = await c.query(
      `INSERT INTO quotes (customer_name, customer_phone, patient_id, subtotal, discount_pct, total, notes, valid_until, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, (now() AT TIME ZONE 'America/Guatemala')::date + $8::int, $9) RETURNING *`,
      [d.customer_name, d.customer_phone, d.patient_id, subtotal, d.discount_pct, total, d.notes, d.valid_days, req.user.id]
    );
    for (const l of lines) {
      await c.query('INSERT INTO quote_items (quote_id, exam_id, name, price, qty) VALUES ($1,$2,$3,$4,$5)', [qt.id, l.exam_id, l.name, l.price, l.qty]);
    }
    return qt;
  });
  await audit(req, 'create', 'quote', quote.id);
  const { rows: [full] } = await q(`${QUOTE_SELECT} WHERE qt.id = $1`, [quote.id]);
  res.status(201).json(full);
});

r.delete('/quotes/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const { rowCount } = await q('DELETE FROM quotes WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Cotización no encontrada');
  await audit(req, 'delete', 'quote', id);
  res.json({ ok: true });
});

// Convierte la cotización en una orden de laboratorio para un paciente
r.post('/quotes/:id/convert', async (req, res) => {
  const id = idParam(req.params.id);
  const { patient_id } = z.object({ patient_id: z.coerce.number().int().positive() }).parse(req.body);
  const order = await tx(async (c) => {
    const { rows: [qt] } = await c.query('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [id]);
    if (!qt) throw new HttpError(404, 'Cotización no encontrada');
    if (qt.converted_order_id) throw new HttpError(409, 'Esta cotización ya fue convertida en orden');
    const { rows: items } = await c.query('SELECT exam_id FROM quote_items WHERE quote_id = $1 AND exam_id IS NOT NULL', [id]);
    if (!items.length) throw new HttpError(400, 'La cotización no contiene exámenes de laboratorio');
    const o = await createOrder(c, {
      patientId: patient_id,
      examIds: items.map((i) => i.exam_id),
      notes: `Generada desde cotización #${id}`,
      origin: req.user.role === 'doctor' ? 'consulta' : 'recepcion',
      userId: req.user.id,
    });
    await c.query('UPDATE quotes SET converted_order_id = $2, patient_id = coalesce(patient_id, $3) WHERE id = $1', [id, o.id, patient_id]);
    return o;
  });
  await audit(req, 'convert', 'quote', id, { order_id: order.id });
  const { rows: [full] } = await q(`${ORDER_SELECT} WHERE o.id = $1`, [order.id]);
  res.status(201).json(full);
});

export default r;
