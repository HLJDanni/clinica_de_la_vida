import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CalendarPlus, Check, X, Phone } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useToast } from '../context.jsx';
import { addDays, APPT_STATUS, APPT_TYPES, fmtTime, fmtWeekday, fullName, gtDateKey } from '../utils.js';
import { Avatar, Badge, Button, Empty, LoadingList, PageHead, Segmented, listItem } from '../components/ui.jsx';
import { AppointmentModal } from '../components/CareWidgets.jsx';

export default function Agenda() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'proximas';
  const today = gtDateKey();
  const range = {
    hoy: [today, today],
    manana: [addDays(today, 1), addDays(today, 1)],
    proximas: [today, addDays(today, 30)],
  }[view];
  const { data, loading, reload } = useApi(`/appointments?from=${range[0]}&to=${range[1]}`);
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const list = (data || []).filter((a) => showDone || !['cancelada', 'completada', 'no_asistio'].includes(a.status));
    return list.reduce((acc, a) => {
      const k = gtDateKey(a.scheduled_at);
      (acc[k] ||= []).push(a);
      return acc;
    }, {});
  }, [data, showDone]);

  const setStatus = async (a, status) => {
    try {
      await api.patch(`/appointments/${a.id}`, { status });
      toast.success(`Cita ${APPT_STATUS[status].label.toLowerCase()}`);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  const dayLabel = (k) => (k === today ? 'Hoy' : k === addDays(today, 1) ? 'Mañana' : fmtWeekday(k));

  return (
    <>
      <PageHead title="Agenda" subtitle="Próximas citas de los pacientes">
        <Button icon={CalendarPlus} onClick={() => setCreating(true)}>
          Agendar cita
        </Button>
      </PageHead>
      <div className="row" style={{ marginBottom: 16 }}>
        <Segmented
          value={view}
          onChange={(v) => setParams({ view: v }, { replace: true })}
          options={[
            { value: 'hoy', label: 'Hoy' },
            { value: 'manana', label: 'Mañana' },
            { value: 'proximas', label: 'Próximos 30 días' },
          ]}
        />
        <label className="check small" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar atendidas y canceladas
        </label>
      </div>

      {loading && !data ? (
        <div className="card"><LoadingList /></div>
      ) : Object.keys(groups).length ? (
        Object.entries(groups).map(([k, list]) => (
          <div key={k} className="day-group">
            <div className="day-label">
              <span style={{ textTransform: 'capitalize' }}>{dayLabel(k)}</span>
              {k === today || k === addDays(today, 1) ? <span className="muted">{fmtWeekday(k)}</span> : null}
              <Badge tone="tone-blue">{list.length}</Badge>
            </div>
            <div className="card">
              <div className="list">
                {list.map((a, i) => {
                  const st = APPT_STATUS[a.status];
                  const active = ['programada', 'confirmada'].includes(a.status);
                  return (
                    <motion.div key={a.id} className="list-item" {...listItem(i)}>
                      <div className="appt-time">
                        {fmtTime(a.scheduled_at)}
                        <small>{a.duration_min} min</small>
                      </div>
                      <Avatar patient={{ ...a, id: a.patient_id }} size={38} />
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/pacientes/${a.patient_id}`)}>
                        <div className="strong">{fullName(a)}</div>
                        <div className="small muted row" style={{ gap: 6 }}>
                          {APPT_TYPES[a.type]} · {a.reason || '—'}
                          {a.phone && (
                            <>
                              · <Phone size={12} /> {a.phone}
                            </>
                          )}
                        </div>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {active && a.status === 'programada' && (
                        <Button size="sm" variant="tinted" icon={Check} onClick={() => setStatus(a, 'confirmada')}>
                          Confirmar
                        </Button>
                      )}
                      {active && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'completada')}>
                          Atendida
                        </Button>
                      )}
                      {active && <Button size="sm" variant="ghost" icon={X} onClick={() => setStatus(a, 'cancelada')} aria-label="Cancelar cita" title="Cancelar cita" />}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <Empty icon={CalendarDays} title="Sin citas en este periodo" text="Agende una cita para verla aquí.">
            <Button variant="tinted" icon={CalendarPlus} onClick={() => setCreating(true)}>
              Agendar cita
            </Button>
          </Empty>
        </div>
      )}
      <AppointmentModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />
    </>
  );
}
