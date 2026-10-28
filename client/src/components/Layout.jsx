import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, CalendarDays, FlaskConical, FileText, Wallet, Settings, Search, Bell, LogOut, BellRing, Clock, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context.jsx';
import { api } from '../api.js';
import { ageLabel, APPT_TYPES, fmtTime, fullName, gtDateKey, gtMinutes } from '../utils.js';
import { Avatar, Badge, Button, Modal, spring } from './ui.jsx';
import { usePatientSearch } from './PatientWidgets.jsx';

const NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/laboratorio', label: 'Laboratorio', icon: FlaskConical },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/caja', label: 'Caja y cobros', icon: Wallet },
  { to: '/configuracion', label: 'Configuración', icon: Settings, doctor: true },
];

const NOTIFY_AT = 19 * 60 + 30; // 7:30 p. m.

export default function Layout() {
  const { user, logout, isDoctor } = useAuth();
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const nav = NAV.filter((n) => !n.doctor || isDoctor);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.svg" alt="" />
          <div>
            <div className="brand-name">Pasión por la Vida</div>
            <div className="brand-sub">Clínica Médica</div>
          </div>
        </div>
        <div className="nav-label">{isDoctor ? 'Consultorio' : 'Recepción'}</div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={spring} />}
                <n.icon size={18} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, background: isDoctor ? 'linear-gradient(140deg,#2160CC,#5b93f0)' : 'linear-gradient(140deg,#1F9D6B,#4cc495)' }}>
            {isDoctor ? 'DD' : 'RE'}
          </div>
          <div className="who">
            <b>{user.name}</b>
            <span>{isDoctor ? 'Médico tratante' : 'Recepción'}</span>
          </div>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" />
        </div>
      </aside>

      <div className="main">
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <button className="search-trigger" onClick={() => setPalette(true)}>
            <Search size={16} />
            Buscar paciente por nombre o iniciales…
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <TomorrowNotifier />
            <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} className="mobile-only" aria-label="Cerrar sesión" />
          </div>
        </header>
        <main className="content">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      <nav className="mobile-nav">
        {nav.slice(0, 5).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <n.icon size={20} />
            {n.label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

/* ---------- Búsqueda global estilo Spotlight ---------- */
function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const { results } = usePatientSearch(open ? q : null, 120);
  const navigate = useNavigate();
  const list = results.slice(0, 8);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);
  useEffect(() => {
    setIdx(0);
  }, [q]);

  const go = (p) => {
    onClose();
    navigate(`/pacientes/${p.id}`);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && list[idx]) go(list[idx]);
  };

  return (
    <Modal open={open} onClose={onClose} width={620}>
      <div style={{ margin: '-6px -24px -20px' }}>
        <div className="palette-input">
          <Search size={20} color="var(--blue)" />
          <input autoFocus placeholder="Nombre completo, iniciales (MJLP), teléfono o DPI" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        </div>
        <div className="palette-results">
          {list.map((p, i) => (
            <div key={p.id} className={`palette-item ${i === idx ? 'on' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => go(p)}>
              <Avatar patient={p} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{fullName(p)}</div>
                <div className="small muted">
                  {p.initials} · {ageLabel(p.birth_date)} · {p.phone || 'Sin teléfono'}
                </div>
              </div>
              {i === idx && <ArrowRight size={16} color="var(--blue)" />}
            </div>
          ))}
          {!list.length && <div className="empty small">No se encontraron pacientes</div>}
        </div>
        <div className="palette-hint">
          <span>↑↓ navegar</span>
          <span>Enter abrir expediente</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Aviso diario de citas del día siguiente (7:30 p. m.) ---------- */
function TomorrowNotifier() {
  const [appts, setAppts] = useState([]);
  const [open, setOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [afterTime, setAfterTime] = useState(gtMinutes() >= NOTIFY_AT);
  const box = useRef(null);
  const navigate = useNavigate();

  const load = () => api.get('/appointments/tomorrow').then(setAppts).catch(() => {});

  useEffect(() => {
    load();
    const check = () => {
      const after = gtMinutes() >= NOTIFY_AT;
      setAfterTime(after);
      if (!after) return;
      const key = `cmpv-notified-${gtDateKey()}`;
      let seen = false;
      try {
        seen = localStorage.getItem(key) === '1';
      } catch {
        /* almacenamiento no disponible */
      }
      if (seen) return;
      api
        .get('/appointments/tomorrow')
        .then((list) => {
          setAppts(list);
          setAlertOpen(true);
          try {
            localStorage.setItem(key, '1');
          } catch {
            /* ignorar */
          }
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Citas de mañana', { body: `Hay ${list.length} cita(s) programada(s) para mañana.`, icon: '/logo.svg' });
          }
        })
        .catch(() => {});
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = () => {
    if (!open) {
      load();
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    }
    setOpen((o) => !o);
  };

  const List = () => (
    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
      {appts.map((a) => (
        <div key={a.id} className="list-item clickable" onClick={() => { setOpen(false); setAlertOpen(false); navigate(`/pacientes/${a.patient_id}`); }}>
          <div className="appt-time">{fmtTime(a.scheduled_at)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="strong">{fullName(a)}</div>
            <div className="small muted">{a.reason || APPT_TYPES[a.type]}</div>
          </div>
          <Badge tone={a.type === 'laboratorio' ? 'tone-purple' : 'tone-blue'}>{APPT_TYPES[a.type]}</Badge>
        </div>
      ))}
      {!appts.length && <div className="empty small">No hay citas programadas para mañana.</div>}
    </div>
  );

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={toggle} aria-label="Citas de mañana">
        <Bell size={18} />
        {afterTime && appts.length > 0 && <span className="dot" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="popover" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={spring}>
            <div className="card-head">
              <Clock size={16} color="var(--blue)" />
              <h3>Citas de mañana</h3>
              <span className="badge tone-blue" style={{ marginLeft: 'auto' }}>
                {appts.length}
              </span>
            </div>
            <List />
            <div className="small muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
              Aviso automático diario a las 7:30 p. m.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Modal open={alertOpen} onClose={() => setAlertOpen(false)} width={520} icon={BellRing} title={`Mañana hay ${appts.length} cita${appts.length === 1 ? '' : 's'}`} subtitle="Recordatorio de las 7:30 p. m." footer={<Button onClick={() => { setAlertOpen(false); navigate('/agenda?view=manana'); }}>Ver agenda de mañana</Button>}>
        <div className="card" style={{ boxShadow: 'none', overflow: 'hidden' }}>
          <List />
        </div>
      </Modal>
    </div>
  );
}
