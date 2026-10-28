import { q } from './db.js';

export async function audit(req, action, entity, entityId = null, detail = null) {
  try {
    await q('INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)', [
      req.user?.id ?? null,
      action,
      entity,
      entityId,
      detail ? JSON.stringify(detail) : null,
    ]);
  } catch (err) {
    console.error('[audit]', err.message);
  }
}
