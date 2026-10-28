import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { api } from './api.js';

/* ---------- Tema claro / oscuro ---------- */
const THEME_KEY = 'cmpv-theme';
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');
function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
/** Preferencia guardada; si no hay, la del sistema operativo */
export const initialTheme = () => storedTheme() || (darkQuery()?.matches ? 'dark' : 'light');
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f141b' : '#2160CC');
}

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  // Sigue al sistema mientras la persona no haya elegido un tema
  useEffect(() => {
    const mq = darkQuery();
    if (!mq) return undefined;
    const onChange = (e) => {
      if (storedTheme()) return;
      const next = e.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* almacenamiento no disponible */
    }
    const run = () => {
      applyTheme(next);
      setTheme(next);
    };
    // Fundido cruzado del navegador: una sola captura, sin transicionar cada elemento
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(() => flushSync(run));
    else run();
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

/* ---------- Sesión ---------- */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = verificando

  useEffect(() => {
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (username, password) => {
    const d = await api.post('/auth/login', { username, password });
    setUser(d.user);
    return d.user;
  };
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  };
  const isDoctor = user?.role === 'doctor';
  return <AuthCtx.Provider value={{ user, login, logout, isDoctor }}>{children}</AuthCtx.Provider>;
}

/* ---------- Configuración de la clínica ---------- */
const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const reload = useCallback(() => api.get('/settings').then(setSettings).catch(() => {}), []);
  useEffect(() => {
    reload();
  }, [reload]);
  return <SettingsCtx.Provider value={{ settings, setSettings, reload }}>{children}</SettingsCtx.Provider>;
}

/* ---------- Notificaciones (toasts) ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, msg) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, type, msg }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3600);
  }, []);
  const api_ = {
    success: (m) => push('success', m),
    error: (m) => push('error', typeof m === 'string' ? m : m?.message || 'Ocurrió un error'),
    info: (m) => push('info', m),
  };
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <ToastCtx.Provider value={api_}>
      {children}
      <div className="toasts">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                className={`toast ${t.type}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 600, damping: 38 }}
              >
                <Icon size={18} />
                {t.msg}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Impresión de documentos ---------- */
const PrintCtx = createContext(null);
export const usePrint = () => useContext(PrintCtx);

export function PrintProvider({ children }) {
  const [doc, setDoc] = useState(null);
  useLayoutEffect(() => {
    if (!doc) return;
    const done = () => setDoc(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 80); // deja que carguen imágenes
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [doc]);
  return (
    <PrintCtx.Provider value={setDoc}>
      {children}
      {doc && createPortal(<div className="print-root">{doc}</div>, document.body)}
    </PrintCtx.Provider>
  );
}
