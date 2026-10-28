import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { audit } from '../audit.js';
import { requireRole } from '../auth.js';
import { idParam, optText, HttpError } from '../utils.js';

export const ORDER_SELECT = `
  SELECT o.*, p.first_name, p.last_name, p.phone, p.initials, p.birth_date, p.gender,
    coalesce((SELECT json_agg(json_build_object('id', i.id, 'exam_id', i.exam_id, 'name', i.exam_name,
               'price', i.price, 'result', i.result) ORDER BY i.id)
              FROM lab_order_items i WHERE i.order_id = o.id), '[]'::json) AS items
  FROM lab_orders o JOIN patients p ON p.id = o.patient_id`;

export const PayMethod = z.enum(['efectivo', 'tarjeta', 'transferencia']);

const r = Router();

/* ---------- Catálogo ---------- */
const ExamSchema = z.object({
  code: z.string().trim().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Nombre requerido').max(160),
  category: z.string().trim().min(1).max(80),
  price: z.coerce.number().min(0).max(100000),
  sample: optText(120),
  turnaround: optText(80),
  active: z.boolean().default(true),
});

r.get('/lab-exams', async (req, res) => {
  const all = req.query.all === '1' && req.user.role === 'doctor';
  const { rows } = await q(
    `SELECT * FROM lab_exams ${all ? '' : 'WHERE active'} ORDER BY category, name`
  );
  res.json(rows);
});

r.post('/lab-exams', requireRole('doctor'), async (req, res) => {
  const d = ExamSchema.parse(req.body);
  const { rows: [row] } = await q(
    `INSERT INTO lab_exams (code, name, category, price, sample, turnaround, active) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (code) DO NOTHING RETURNING *`,
    [d.code, d.name, d.category, d.price, d.sample, d.turnaround, d.active]
  );
  if (!row) throw new HttpError(409, 'Ya existe un examen con ese código');
  await audit(req, 'create', 'lab_exam', row.id);
  res.status(201).json(row);
});

r.put('/lab-exams/:id', requireRole('doctor'), async (req, res) => {
  const id = idParam(req.params.id);
  const d = ExamSchema.parse(req.body);
  const { rows: [row] } = await q(
    `UPDATE lab_exams SET code=$2, name=$3, category=$4, price=$5, sample=$6, turnaround=$7, active=$8 WHERE id=$1 RETURNING *`,
    [id, d.code, d.name, d.category, d.price, d.sample, d.turnaround, d.active]
  );
  if (!row) throw new HttpError(404, 'Examen no encontrado');
  await audit(req, 'update', 'lab_exam', id, { price: d.price });
  res.json(row);
});

/* ---------- Órdenes ---------- */
const OrderSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  exam_ids: z.array(z.coerce.number().int().positive()).min(1, 'Seleccione al menos un examen').max(60),
  notes: optText(1000),
  pay_now: z.object({ method: PayMethod }).optional().nullable(),
});

/** Crea una orden con precios tomados del catálogo (nunca del cliente). */
export async function createOrder(c, { patientId, examIds, notes, origin, userId }) {
  const { rows: exams } = await c.query('SELECT id, name, price FROM lab_exams WHERE id = ANY($1::int[]) AND active', [examIds]);
  if (exams.length !== new Set(examIds).size) throw new HttpError(400, 'Hay exámenes inválidos o inactivos');
  const total = exams.reduce((s, e) => s + e.price, 0);
  const { rows: [order] } = await c.query(
    `INSERT INTO lab_orders (patient_id, origin, total, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [patientId, origin, total, notes, userId]
  );
  for (const e of exams) {
    await c.query('INSERT INTO lab_order_items (order_id, exam_id, exam_name, price) VALUES ($1,$2,$3,$4)', [order.id, e.id, e.name, e.price]);
  }
  return order;
}

async function payOrder(c, orderId, method, userId) {
  const { rows: [o] } = await c.query('SELECT * FROM lab_orders WHERE id = $1 FOR UPDATE', [orderId]);
  if (!o) throw new HttpError(404, 'Orden no encontrada');
  if (o.payment_status === 'pagado') throw new HttpError(409, 'La orden ya fue cobrada');
  if (o.status === 'cancelado') throw new HttpError(409, 'La orden está cancelada');
  const { rows: [pay] } = await c.query(
    `INSERT INTO payments (patient_id, concept, lab_order_id, description, amount, method, received_by)
     VALUES ($1, 'laboratorio', $2, $3, $4, $5, $6) RETURNING *`,
    [o.patient_id, o.id, `Orden de laboratorio #${o.id}`, o.total, method, userId]
  );
  await c.query(
    `UPDATE lab_orders SET payment_status = 'pagado', status = CASE WHEN status = 'solicitado' THEN 'en_proceso' ELSE status END WHERE id = $1`,
    [o.id]
  );
  return pay;
}

r.get('/lab-orders', async (req, res) => {
  const conds = [];
  const params = [];
  const { status, payment, patient_id } = req.query;
  if (status && status !== 'todas') {
    params.push(String(status));
    conds.push(`o.status = $${params.length}`);
  }
  if (payment) {
    params.push(String(payment));
    conds.push(`o.payment_status = $${params.length}`);
  }
  if (patient_id) {
    params.push(idParam(patient_id));
    conds.push(`o.patient_id = $${params.length}`);
  }
  const { rows } = await q(
    `${ORDER_SELECT} ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT 300`,
    params
  );
  res.json(rows);
});

r.post('/lab-orders', async (req, res) => {
  const d = OrderSchema.parse(req.body);
  const order = await tx(async (c) => {
    const { rowCount } = await c.query('SELECT 1 FROM patients WHERE id = $1', [d.patient_id]);
    if (!rowCount) throw new HttpError(404, 'Paciente no encontrado');
    const o = await createOrder(c, {
      patientId: d.patient_id,
      examIds: d.exam_ids,
      notes: d.notes,
      origin: req.user.role === 'doctor' ? 'consulta' : 'recepcion',
      userId: req.user.id,
    });
    if (d.pay_now) await payOrder(c, o.id, d.pay_now.method, req.user.id);
    return o;
  });
  await audit(req, 'create', 'lab_order', order.id);
  const { rows: [full] } = await q(`${ORDER_SELECT} WHERE o.id = $1`, [order.id]);
  res.status(201).json(full);
});

r.post('/lab-orders/:id/pay', async (req, res) => {
  const id = idParam(req.params.id);
  const { method } = z.object({ method: PayMethod }).parse(req.body);
  const pay = await tx((c) => payOrder(c, id, method, req.user.id));
  await audit(req, 'pay', 'lab_order', id, { amount: pay.amount, method });
  const { rows: [full] } = await q(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  res.json(full);
});

const ResultsSchema = z.object({
  items: z.array(z.object({ id: z.coerce.number().int().positive(), result: optText(4000) })).max(60),
  complete: z.boolean().default(false),
});

r.put('/lab-orders/:id/results', async (req, res) => {
  const id = idParam(req.params.id);
  const d = ResultsSchema.parse(req.body);
  await tx(async (c) => {
    const { rows: [o] } = await c.query('SELECT status FROM lab_orders WHERE id = $1 FOR UPDATE', [id]);
    if (!o) throw new HttpError(404, 'Orden no encontrada');
    if (o.status === 'cancelado') throw new HttpError(409, 'La orden está cancelada');
    for (const it of d.items) {
      await c.query('UPDATE lab_order_items SET result = $3 WHERE id = $1 AND order_id = $2', [it.id, id, it.result]);
    }
    await c.query(
      `UPDATE lab_orders SET status = $2, completed_at = CASE WHEN $2 = 'completado' THEN now() ELSE NULL END WHERE id = $1`,
      [id, d.complete ? 'completado' : 'en_proceso']
    );
  });
  await audit(req, 'results', 'lab_order', id);
  const { rows: [full] } = await q(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  res.json(full);
});

r.patch('/lab-orders/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = z.object({ status: z.enum(['solicitado', 'en_proceso', 'completado', 'cancelado']) }).parse(req.body);
  const { rows: [o] } = await q('SELECT payment_status FROM lab_orders WHERE id = $1', [id]);
  if (!o) throw new HttpError(404, 'Orden no encontrada');
  if (d.status === 'cancelado' && o.payment_status === 'pagado') throw new HttpError(409, 'No se puede cancelar una orden ya cobrada');
  await q(`UPDATE lab_orders SET status = $2, completed_at = CASE WHEN $2 = 'completado' THEN now() ELSE completed_at END WHERE id = $1`, [id, d.status]);
  await audit(req, 'status', 'lab_order', id, d);
  const { rows: [full] } = await q(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  res.json(full);
});

export default r;
