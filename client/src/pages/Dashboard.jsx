import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, CalendarDays, FlaskConical, Wallet, UserPlus, CalendarPlus, FileText, Stethoscope, Clock, ArrowRight, CalendarClock } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth, useSettings } from '../context.jsx';
import { capitalize, APPT_STATUS, APPT_TYPES, fmtDateLong, fmtDateTime, fmtTime, fullName, greeting, money, ageLabel } from '../utils.js';
import { Avatar, Badge, Button, Empty, LoadingList, PageHead, listItem } from '../components/ui.jsx';
import { PatientFormModal } from '../components/PatientWidgets.jsx';
import { AppointmentModal } from '../components/CareWidgets.jsx';
import { LabOrderModal } from '../components/LabWidgets.jsx';

export default function Dashboard() {
  const { user, isDoctor } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { data, loading, reload } = useApi('/dashboard');
  const [modal, setModal] = useState(null);
  const s = data?.stats || {};

  const stats = [
    { label: 'Citas de hoy', value: s.today_appointments, icon: CalendarDays, tone: 'tone-blue', to: '/agenda' },
    { label: 'Laboratorios pendientes', value: s.pending_labs, icon: FlaskConical, tone: 'tone-purple', to: '/laboratorio' },
    isDoctor
      ? { label: 'Consultas este mes', value: (s.month_followups || 0) + (s.month_records || 0), icon: Stethoscope, tone: 'tone-green', to: '/pacientes' }
      : { label: 'Órdenes por cobrar', value: s.unpaid_labs, icon: Wallet, tone: 'tone-amber', to: '/laboratorio' },
    { label: 'Ingresos de hoy', value: money(s.today_income), icon: Wallet, tone: 'tone-green', to: '/caja' },
  ];

  return (
    <>
      <PageHead title={`${greeting()}, ${user.name}`} subtitle={capitalize(fmtDateLong(new Date()))}>
        <Button variant="secondary" icon={UserPlus} onClick={() => setModal('patient')}>
          Nuevo paciente
        </Button>
        <Button variant="secondary" icon={FlaskConical} onClick={() => setModal('lab')}>
          Orden de laboratorio
        </Button>
        <Button icon={CalendarPlus} onClick={() => setModal('appt')}>
          Agendar cita
        </Button>
      </PageHead>

      {s.tomorrow_appointments > 0 && (
        <motion.div className="banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="b-icon">
            <CalendarClock size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Mañana hay {s.tomorrow_appointments} cita{s.tomorrow_appointments === 1 ? '' : 's'} programada{s.tomorrow_appointments === 1 ? '' : 's'}
            </div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>Recibirá un recordatorio automático a las 7:30 p. m.</div>
          </div>
          <Button size="sm" onClick={() => navigate('/agenda?view=manana')}>
            Ver citas
          </Button>
        </motion.div>
      )}

      <div className="grid g4" style={{ marginBottom: 20 }}>
        {stats.map((st, i) => (
          <motion.button key={st.label} {...listItem(i)} whileHover={{ y: -3 }} className="card stat" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => navigate(st.to)}>
            <div className={`stat-icon ${st.tone}`}>
              <st.icon size={19} />
            </div>
            <div>
              <div className="stat-value">{loading ? '—' : st.value ?? 0}</div>
              <div className="stat-label">{st.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <Clock size={17} color="var(--blue)" />
            <h3>Agenda de hoy</h3>
            <span className="sub">{data?.today?.length || 0} citas</span>
            <Button variant="ghost" size="sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/agenda')}>
              Ver agenda <ArrowRight size={14} />
            </Button>
          </div>
          {loading ? (
            <LoadingList />
          ) : data.today.length ? (
            <div className="list">
              {data.today.map((a, i) => (
                <motion.div key={a.id} {...listItem(i)} className="list-item clickable" onClick={() => navigate(`/pacientes/${a.patient_id}`)}>
                  <div className="appt-time">
                    {fmtTime(a.scheduled_at)}
                    <small>{a.duration_min} min</small>
                  </div>
                  <Avatar patient={{ id: a.patient_id, ...a }} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong">{fullName(a)}</div>
                    <div className="small muted">
                      {a.reason || APPT_TYPES[a.type]} · {ageLabel(a.birth_date)}
                    </div>
                  </div>
                  <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
                </motion.div>
              ))}
            </div>
          ) : (
            <Empty icon={CalendarDays} title="Sin citas para hoy" text="Las citas agendadas aparecerán aquí." />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad" style={{ background: 'linear-gradient(140deg,#2160CC,#3f7ee8)', color: '#fff', border: 0 }}>
            <div className="small" style={{ opacity: 0.85, fontWeight: 600 }}>Precio de consulta · {settings.doctor_name || 'Dra. Delia'}</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '4px 0 12px' }}>{money(settings.consult_price)}</div>
            <div className="row">
              <Button size="sm" style={{ background: '#fff', color: 'var(--blue)' }} icon={FileText} onClick={() => navigate('/cotizaciones')}>
                Cotizar
              </Button>
              <Button size="sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }} icon={Wallet} onClick={() => navigate('/caja')}>
                Cobrar consulta
              </Button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Users size={17} color="var(--blue)" />
              <h3>Actividad reciente</h3>
            </div>
            {loading ? (
              <LoadingList rows={3} />
            ) : (
              <div className="list">
                {data.recent.map((r, i) => (
                  <div key={`${r.id}-${i}`} className="list-item clickable" style={{ padding: '11px 18px' }} onClick={() => navigate(`/pacientes/${r.id}`)}>
                    <Avatar patient={r} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong" style={{ fontSize: 13.5 }}>
                        {fullName(r)}
                      </div>
                      <div className="small muted">
                        {r.kind} · {fmtDateTime(r.at)}
                      </div>
                    </div>
                  </div>
                ))}
                {!data.recent.length && <div className="empty small">Sin actividad</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <PatientFormModal open={modal === 'patient'} onClose={() => setModal(null)} onSaved={(p) => navigate(`/pacientes/${p.id}`)} />
      <AppointmentModal open={modal === 'appt'} onClose={() => setModal(null)} onSaved={reload} />
      <LabOrderModal open={modal === 'lab'} onClose={() => setModal(null)} onCreated={reload} />
    </>
  );
}
