import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, ClipboardList, Check, Lock, User, AlertCircle, Eye, EyeOff, ShieldCheck, HeartPulse, FlaskConical, CalendarCheck } from 'lucide-react';
import { useAuth } from '../context.jsx';
import { Button } from '../components/ui.jsx';

const ACCOUNTS = [
  { username: 'dra.delia', name: 'Dra. Delia', role: 'Médico tratante', icon: Stethoscope, color: 'linear-gradient(140deg,#2160CC,#5b93f0)' },
  { username: 'recepcion', name: 'Recepción', role: 'Laboratorio y caja', icon: ClipboardList, color: 'linear-gradient(140deg,#1F9D6B,#4cc495)' },
];

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Ingrese usuario y contraseña');
      setShake((s) => s + 1);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
      setShake((s) => s + 1);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-art">
        <motion.div className="blob" style={{ width: 380, height: 380, background: '#7fb0ff', top: -80, right: -60 }} animate={{ x: [0, 30, 0], y: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }} />
        <motion.div className="blob" style={{ width: 320, height: 320, background: '#1338a0', bottom: -60, left: -40 }} animate={{ x: [0, -20, 0], y: [0, -30, 0] }} transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.svg" alt="" width={44} height={44} style={{ borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,.2)' }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>Clínica Médica Pasión por la Vida</div>
        </div>
        <div style={{ position: 'relative', marginTop: 'auto', marginBottom: 'auto' }}>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            Cuidamos cada historia, con pasión por la vida.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
            Expedientes, laboratorio, agenda y caja en un solo lugar, seguro y siempre disponible.
          </motion.p>
          <div className="login-features">
            {[
              [HeartPulse, 'Fichas clínicas, seguimientos y referencias'],
              [FlaskConical, 'Catálogo de laboratorio y cotizaciones'],
              [CalendarCheck, 'Recordatorio diario de citas a las 7:30 p. m.'],
            ].map(([Icon, text], i) => (
              <motion.div key={text} className="login-feature" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08, duration: 0.5 }}>
                <Icon size={18} /> {text}
              </motion.div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 12.5, opacity: 0.7 }}>© {new Date().getFullYear()} Clínica Médica Pasión por la Vida</div>
      </div>

      <div className="login-form-wrap">
        <motion.form className="login-form" onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <h2>Hola de nuevo</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Seleccione su cuenta para continuar
          </p>

          <div className="account-picker">
            {ACCOUNTS.map((a) => {
              const on = username === a.username;
              return (
                <button
                  key={a.username}
                  type="button"
                  className={`account ${on ? 'on' : ''}`}
                  onClick={() => {
                    setUsername(a.username);
                    setError('');
                    setTimeout(() => document.getElementById('pwd')?.focus(), 50);
                  }}
                >
                  <AnimatePresence>
                    {on && (
                      <motion.span className="tick" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Check size={12} strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <div className="avatar" style={{ width: 52, height: 52, background: a.color }}>
                    <a.icon size={24} />
                  </div>
                  <b>{a.name}</b>
                  <span>{a.role}</span>
                </button>
              );
            })}
          </div>

          <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-wrap">
              <User size={16} />
              <input className="input" style={{ height: 46 }} placeholder="Usuario" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.trim().toLowerCase())} />
            </div>
            <div className="input-wrap">
              <Lock size={16} />
              <input
                id="pwd"
                className="input"
                style={{ height: 46, paddingRight: 44 }}
                type={show ? 'text' : 'password'}
                placeholder="Contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Mostrar contraseña" style={{ position: 'absolute', right: 8, top: 8, border: 0, background: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 6 }}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <AnimatePresence>
              {error && (
                <motion.div className="login-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <AlertCircle size={16} /> {error}
                </motion.div>
              )}
            </AnimatePresence>
            <Button type="submit" size="lg" block loading={loading}>
              Iniciar sesión
            </Button>
          </motion.div>
          <div className="secure-note">
            <ShieldCheck size={14} /> Conexión cifrada · Sesión protegida de 8 horas
          </div>
        </motion.form>
      </div>
    </div>
  );
}
