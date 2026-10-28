import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { q } from './db.js';
import { audit } from './audit.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

export const COOKIE = 'cmpv_session';
const SESSION_HOURS = 8;
const MAX_ATTEMPTS = 5;
const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: isProd, path: '/' };
// Hash ficticio para que el tiempo de respuesta no revele si el usuario existe
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 10);

const publicUser = (u) => ({ id: u.id, username: u.username, name: u.full_name, role: u.role });

/** Protección CSRF: toda petición que modifica datos debe venir del SPA (cabecera personalizada). */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Solicitud rechazada' });
  }
  next();
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Debe iniciar sesión' });
  try {
    const p = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    req.user = { id: Number(p.sub), role: p.role, name: p.name, username: p.username };
    next();
  } catch {
    res.clearCookie(COOKIE, cookieOpts);
    res.status(401).json({ error: 'Su sesión expiró, vuelva a ingresar' });
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: 'No tiene permisos para acceder a esta sección' });

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' },
});

const LoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(50),
  password: z.string().min(1).max(200),
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = LoginSchema.parse(req.body);
  const {
    rows: [u],
  } = await q('SELECT * FROM users WHERE username = $1', [username]);

  if (u?.locked_until && new Date(u.locked_until) > new Date()) {
    return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intente en 15 minutos.' });
  }

  const ok = await bcrypt.compare(password, u?.password_hash || DUMMY_HASH);
  if (!u || !ok) {
    if (u) {
      await q(
        `UPDATE users SET
           failed_attempts = CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_attempts + 1 END,
           locked_until = CASE WHEN locked_until IS NULL AND failed_attempts + 1 >= $2
                               THEN now() + interval '15 minutes' ELSE NULL END
         WHERE id = $1`,
        [u.id, MAX_ATTEMPTS]
      );
      await audit({ user: { id: u.id } }, 'login_failed', 'user', u.id);
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  await q('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1', [u.id]);
  const token = jwt.sign({ role: u.role, name: u.full_name, username: u.username }, SECRET, {
    subject: String(u.id),
    expiresIn: `${SESSION_HOURS}h`,
    algorithm: 'HS256',
  });
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: SESSION_HOURS * 3600_000 });
  await audit({ user: { id: u.id } }, 'login', 'user', u.id);
  res.json({ user: publicUser(u) });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, cookieOpts);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const {
    rows: [u],
  } = await q('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!u) return res.status(401).json({ error: 'Usuario no encontrado' });
  res.json({ user: publicUser(u) });
});
