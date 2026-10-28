import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { audit } from '../audit.js';
import { requireRole } from '../auth.js';
import { idParam, optText, HttpError } from '../utils.js';

export const RxItem = z.object({
  medicamento: z.string().trim().min(1, 'Indique el medicamento').max(200),
  presentacion: optText(120),
  dosis: optText(120),
  frecuencia: optText(120),
  duracion: optText(120),
});

const RxSchema = z.object({
  items: z.array(RxItem).min(1, 'Agregue al menos un medicamento').max(20),
  indicaciones: optText(),
});

const r = Router();

r.get('/patients/:id/prescriptions', async (req, res) => {
  const { rows } = await q('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [idParam(req.params.id)]);
  res.json(rows);
});

r.post('/patients/:id/prescriptions', requireRole('doctor'), async (req, res) => {
  const id = idParam(req.params.id);
  const d = RxSchema.parse(req.body);
  const { rows: [row] } = await q(
    `INSERT INTO prescriptions (patient_id, items, indicaciones, created_by)
     SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM patients WHERE id = $1) RETURNING *`,
    [id, JSON.stringify(d.items), d.indicaciones, req.user.id]
  );
  if (!row) throw new HttpError(404, 'Paciente no encontrado');
  await audit(req, 'create', 'prescription', row.id);
  res.status(201).json(row);
});

r.delete('/prescriptions/:id', requireRole('doctor'), async (req, res) => {
  const id = idParam(req.params.id);
  const { rowCount } = await q('DELETE FROM prescriptions WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Receta no encontrada');
  await audit(req, 'delete', 'prescription', id);
  res.json({ ok: true });
});

export default r;
