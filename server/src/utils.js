import { z } from 'zod';

export const TZ = 'America/Guatemala';

/** minúsculas y sin tildes */
export const normalize = (s = '') =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "María José" + "López Pérez" -> "MJLP" */
export const initialsOf = (first = '', last = '') =>
  normalize(`${first} ${last}`)
    .split(/\s+/)
    .filter((w) => w && !['de', 'del', 'la', 'los', 'las', 'y'].includes(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const searchNameOf = (first = '', last = '') => normalize(`${first} ${last}`).replace(/\s+/g, ' ');

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export const idParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identificador inválido');
  return n;
};

// Helpers de validación: '' y undefined se tratan como null
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
export const optText = (max = 4000) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
export const optDate = () => z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').nullable());
export const optId = () => z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable());
export const examJson = z
  .record(z.string().max(60), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
  .default({});
export const patientType = z.enum(['adulto', 'pediatrico', 'embarazada']);
