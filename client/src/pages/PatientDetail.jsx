import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, MapPin, Cake, FileHeart, ClipboardList, Send, FlaskConical, Pill, CalendarDays, Wallet, UserRound, Pencil, Plus, Printer, CalendarPlus, AlertTriangle, IdCard, Church,
} from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth, usePrint, useSettings, useToast } from '../context.jsx';
import { ageLabel, APPT_STATUS, APPT_TYPES, fmtDate, fmtDateTime, fullName, genderLabel, money, PAY_METHODS } from '../utils.js';
import { Avatar, Badge, Button, Empty, LoadingList, Tabs, listItem } from '../components/ui.jsx';
import { PatientFormModal } from '../components/PatientWidgets.jsx';
import { LabOrderCard, LabOrderModal } from '../components/LabWidgets.jsx';
import { AppointmentModal, PrescriptionModal } from '../components/CareWidgets.jsx';
import { RecetaDoc, ReciboDoc } from '../components/Documents.jsx';
import { FichaTab, FollowUpsTab, ReferralsTab } from './ClinicalTabs.jsx';

export default function PatientDetail() {
  const { id } = useParams();
  const { isDoctor } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || (isDoctor ? 'ficha' : 'datos');
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  const patientQ = useApi(`/patients/${id}`);
  const overviewQ = useApi(`/patients/${id}/overview`);
  const recordQ = useApi(isDoctor ? `/patients/${id}/record` : null);
  const followQ = useApi(isDoctor ? `/patients/${id}/followups` : null);
  const refQ = useApi(isDoctor ? `/patients/${id}/referrals` : null);

  const [modal, setModal] = useState(null);
  const p = patientQ.data;
  const ov = overviewQ.data || { labs: [], prescriptions: [], appointments: [], payments: [] };
  const upcoming = ov.appointments.filter((a) => new Date(a.scheduled_at) >= new Date(Date.now() - 3600_000) && ['programada', 'confirmada'].includes(a.status)).reverse();

  if (patientQ.error) {
    return <Empty icon={UserRound} title="No se encontró el paciente" text={patientQ.error.message}><Button onClick={() => navigate('/pacientes')}>Volver</Button></Empty>;
  }
  if (!p) return <div className="card"><LoadingList rows={5} /></div>;

  const reloadAll = () => {
    patientQ.reload();
    overviewQ.reload();
    recordQ.reload();
    followQ.reload();
    refQ.reload();
  };

  const tabs = [
    ...(isDoctor
      ? [
          { value: 'ficha', label: 'Ficha clínica', icon: FileHeart },
          { value: 'seguimiento', label: 'Seguimiento', icon: ClipboardList, count: followQ.data?.length },
          { value: 'referencias', label: 'Referencias', icon: Send, count: refQ.data?.length },
        ]
      : [{ value: 'datos', label: 'Datos del paciente', icon: UserRound }]),
    { value: 'laboratorios', label: 'Laboratorios', icon: FlaskConical, count: ov.labs.length },
    { value: 'recetas', label: 'Recetas', icon: Pill, count: ov.prescriptions.length },
    { value: 'citas', label: 'Citas', icon: CalendarDays, count: upcoming.length },
    { value: 'pagos', label: 'Pagos', icon: Wallet },
    ...(isDoctor ? [{ value: 'datos', label: 'Datos', icon: UserRound }] : []),
  ];

  const sidePanel = <CarePanel patient={p} ov={ov} upcoming={upcoming} onAdd={setModal} isDoctor={isDoctor} goTab={setTab} />;
  const withSide = (content) => (
    <div className="split">
      <div style={{ minWidth: 0 }}>{content}</div>
      <div className="sticky">{sidePanel}</div>
    </div>
  );

  return (
    <>
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>
        Volver
      </Button>

      <motion.div className="card patient-hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }} style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <Avatar patient={p} size={68} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row" style={{ gap: 10 }}>
            <h1>{fullName(p)}</h1>
            <span className="chip mono">{p.initials}</span>
          </div>
          <div className="meta">
            <span><Cake size={14} /> {ageLabel(p.birth_date)} {p.birth_date && `(${fmtDate(p.birth_date)})`}</span>
            <span><UserRound size={14} /> {genderLabel(p.gender)}</span>
            <span><Phone size={14} /> {p.phone || '—'}</span>
            {p.dpi && <span><IdCard size={14} /> {p.dpi}</span>}
            {p.religion && <span><Church size={14} /> {p.religion}</span>}
            <span><MapPin size={14} /> {p.address || '—'}</span>
          </div>
          {isDoctor && p.ant_alergias && !/^niega/i.test(p.ant_alergias) && (
            <div style={{ marginTop: 10 }}>
              <Badge tone="tone-red" icon={AlertTriangle}>Alergias: {p.ant_alergias}</Badge>
            </div>
          )}
        </div>
        <div className="row">
          <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
            Editar datos
          </Button>
          <Button variant="secondary" icon={CalendarPlus} onClick={() => setModal('appt')}>
            Agendar cita
          </Button>
          {isDoctor && (
            <Button icon={Pill} onClick={() => setModal('rx')}>
              Receta
            </Button>
          )}
        </div>
      </motion.div>

      <Tabs value={tab} onChange={setTab} tabs={tabs} />

      <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
        {tab === 'ficha' && isDoctor &&
          withSide(
            recordQ.loading && !recordQ.data ? (
              <div className="card"><LoadingList /></div>
            ) : (
              <FichaTab patient={p} record={recordQ.data} onSaved={() => { recordQ.reload(); patientQ.reload(); }} onEditPatient={() => setModal('edit')} />
            )
          )}
        {tab === 'seguimiento' && isDoctor &&
          withSide(<FollowUpsTab patient={p} record={recordQ.data} followUps={followQ.data || []} onCreated={reloadAll} goToFicha={() => setTab('ficha')} />)}
        {tab === 'referencias' && isDoctor &&
          withSide(<ReferralsTab patient={p} record={recordQ.data} followUps={followQ.data || []} referrals={refQ.data || []} labs={ov.labs} onCreated={refQ.reload} />)}
        {tab === 'datos' && withSide(<DataTab patient={p} onEdit={() => setModal('edit')} isDoctor={isDoctor} />)}
        {tab === 'laboratorios' && <LabsTab labs={ov.labs} onAdd={() => setModal('lab')} onChange={overviewQ.reload} />}
        {tab === 'recetas' && <RxTab patient={p} list={ov.prescriptions} onAdd={isDoctor ? () => setModal('rx') : null} />}
        {tab === 'citas' && <ApptsTab list={ov.appointments} onAdd={() => setModal('appt')} onChange={overviewQ.reload} />}
        {tab === 'pagos' && <PaymentsTab patient={p} list={ov.payments} />}
      </motion.div>

      <PatientFormModal open={modal === 'edit'} patient={p} onClose={() => setModal(null)} onSaved={() => { setModal(null); patientQ.reload(); }} />
      <LabOrderModal open={modal === 'lab'} patient={p} onClose={() => setModal(null)} onCreated={overviewQ.reload} />
      <AppointmentModal open={modal === 'appt'} patient={p} defaultType={isDoctor ? 'seguimiento' : 'consulta'} onClose={() => setModal(null)} onSaved={overviewQ.reload} />
      {isDoctor && <PrescriptionModal open={modal === 'rx'} patient={p} onClose={() => setModal(null)} onSaved={() => { overviewQ.reload(); followQ.reload(); }} />}
    </>
  );
}

/* ---------- Panel lateral: laboratorios, recetas y próximas citas ---------- */
function CarePanel({ ov, upcoming, onAdd, isDoctor, goTab }) {
  const labs = ov.labs.filter((l) => l.status !== 'cancelado').slice(0, 3);
  const rx = ov.prescriptions.slice(0, 2);
  return (
    <div className="card">
      <div className="side-block">
        <div className="side-title">
          <FlaskConical size={16} color="var(--purple)" /> Laboratorios
          <Button size="sm" variant="tinted" icon={Plus} onClick={() => onAdd('lab')}>
            Agregar
          </Button>
        </div>
        {labs.length ? (
          labs.map((l) => (
            <div key={l.id} className="mini" style={{ cursor: 'pointer' }} onClick={() => goTab('laboratorios')}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="strong small">{fmtDate(l.created_at)}</span>
                <Badge tone={l.status === 'completado' ? 'tone-green' : 'tone-purple'}>{l.status === 'completado' ? 'Listo' : 'Pendiente'}</Badge>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>{l.items.map((i) => i.name).join(', ')}</div>
            </div>
          ))
        ) : (
          <div className="small muted">Sin laboratorios registrados.</div>
        )}
      </div>
      <div className="side-block">
        <div className="side-title">
          <Pill size={16} color="var(--green)" /> Recetas
          {isDoctor && (
            <Button size="sm" variant="tinted" icon={Plus} onClick={() => onAdd('rx')}>
              Agregar
            </Button>
          )}
        </div>
        {rx.length ? (
          rx.map((r) => (
            <div key={r.id} className="mini" style={{ cursor: 'pointer' }} onClick={() => goTab('recetas')}>
              <div className="strong small">{fmtDate(r.created_at)}</div>
              <div className="small muted" style={{ marginTop: 4 }}>{r.items.map((i) => i.medicamento).join(', ')}</div>
            </div>
          ))
        ) : (
          <div className="small muted">Sin recetas.</div>
        )}
      </div>
      <div className="side-block">
        <div className="side-title">
          <CalendarDays size={16} color="var(--blue)" /> Próximas citas
          <Button size="sm" variant="tinted" icon={Plus} onClick={() => onAdd('appt')}>
            Agendar
          </Button>
        </div>
        {upcoming.length ? (
          upcoming.slice(0, 3).map((a) => (
            <div key={a.id} className="mini">
              <div className="strong small">{fmtDateTime(a.scheduled_at)}</div>
              <div className="small muted">{a.reason || APPT_TYPES[a.type]}</div>
            </div>
          ))
        ) : (
          <div className="small muted">Sin citas agendadas.</div>
        )}
      </div>
    </div>
  );
}

function DataTab({ patient, onEdit, isDoctor }) {
  const rows = [
    ['Nombre completo', fullName(patient)],
    ['Iniciales', patient.initials],
    ['Fecha de nacimiento', fmtDate(patient.birth_date)],
    ['Edad', ageLabel(patient.birth_date)],
    ['Género', genderLabel(patient.gender)],
    ['Teléfono', patient.phone],
    ['DPI', patient.dpi],
    ['Religión', patient.religion],
    ['Dirección', patient.address],
    ['Registrado', fmtDateTime(patient.created_at)],
  ];
  const ant = [
    ['Médicos', patient.ant_medicos],
    ['Quirúrgicos', patient.ant_quirurgicos],
    ['Traumáticos', patient.ant_traumaticos],
    ['Alergias', patient.ant_alergias],
    ['Familiares', patient.ant_familiares],
  ];
  return (
    <div className="card">
      <div className="card-head">
        <UserRound size={17} color="var(--blue)" />
        <h3>Datos generales</h3>
        <Button size="sm" variant="secondary" icon={Pencil} style={{ marginLeft: 'auto' }} onClick={onEdit}>
          Editar
        </Button>
      </div>
      <dl className="kv card-body">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v || '—'}</dd>
          </div>
        ))}
      </dl>
      {isDoctor && (
        <>
          <div className="card-head" style={{ borderTop: '1px solid var(--line)' }}>
            <h3>Antecedentes</h3>
          </div>
          <dl className="kv card-body">
            {ant.map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v || 'Niega'}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

function LabsTab({ labs, onAdd, onChange }) {
  return (
    <div className="card">
      <div className="card-head">
        <FlaskConical size={17} color="var(--purple)" />
        <h3>Órdenes de laboratorio</h3>
        <Button size="sm" icon={Plus} style={{ marginLeft: 'auto' }} onClick={onAdd}>
          Nueva orden
        </Button>
      </div>
      {labs.length ? (
        <div style={{ marginTop: -1 }}>
          {labs.map((o) => (
            <LabOrderCard key={o.id} order={o} showPatient={false} onChange={onChange} />
          ))}
        </div>
      ) : (
        <Empty icon={FlaskConical} title="Sin laboratorios" text="Agregue una orden con los exámenes a realizar.">
          <Button variant="tinted" icon={Plus} onClick={onAdd}>
            Agregar laboratorio
          </Button>
        </Empty>
      )}
    </div>
  );
}

function RxTab({ patient, list, onAdd }) {
  const print = usePrint();
  const { settings } = useSettings();
  return (
    <div className="card">
      <div className="card-head">
        <Pill size={17} color="var(--green)" />
        <h3>Recetas médicas</h3>
        <span className="sub">Emitidas por la Dra. Delia</span>
        {onAdd && (
          <Button size="sm" icon={Plus} style={{ marginLeft: 'auto' }} onClick={onAdd}>
            Nueva receta
          </Button>
        )}
      </div>
      {list.length ? (
        <div className="list">
          {list.map((r, i) => (
            <motion.div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }} {...listItem(i)}>
              <div className="stat-icon tone-green">
                <Pill size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{fmtDateTime(r.created_at)}</div>
                {r.items.map((it, j) => (
                  <div key={j} className="small" style={{ marginTop: 4 }}>
                    <b>{it.medicamento}</b> {it.presentacion && <span className="muted">· {it.presentacion}</span>} — {[it.dosis, it.frecuencia, it.duracion].filter(Boolean).join(' · ')}
                  </div>
                ))}
                {r.indicaciones && <div className="small muted" style={{ marginTop: 6 }}>{r.indicaciones}</div>}
              </div>
              <Button size="sm" variant="secondary" icon={Printer} onClick={() => print(<RecetaDoc patient={patient} rx={r} settings={settings} />)}>
                Imprimir
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <Empty icon={Pill} title="Sin recetas" text={onAdd ? 'Agregue una receta para este paciente.' : 'La Dra. aún no ha emitido recetas para este paciente.'}>
          {onAdd && <Button variant="tinted" icon={Plus} onClick={onAdd}>Agregar receta</Button>}
        </Empty>
      )}
    </div>
  );
}

function ApptsTab({ list, onAdd, onChange }) {
  const toast = useToast();
  const setStatus = async (a, status) => {
    try {
      await api.patch(`/appointments/${a.id}`, { status });
      toast.success('Cita actualizada');
      onChange();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <div className="card">
      <div className="card-head">
        <CalendarDays size={17} color="var(--blue)" />
        <h3>Citas</h3>
        <Button size="sm" icon={Plus} style={{ marginLeft: 'auto' }} onClick={onAdd}>
          Agendar cita
        </Button>
      </div>
      {list.length ? (
        <div className="list">
          {list.map((a, i) => {
            const st = APPT_STATUS[a.status];
            const future = new Date(a.scheduled_at) > new Date() && ['programada', 'confirmada'].includes(a.status);
            return (
              <motion.div key={a.id} className="list-item" {...listItem(i)}>
                <div style={{ flex: 1 }}>
                  <div className="strong">{fmtDateTime(a.scheduled_at)}</div>
                  <div className="small muted">
                    {APPT_TYPES[a.type]} · {a.reason || '—'}
                  </div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
                {future && a.status === 'programada' && (
                  <Button size="sm" variant="tinted" onClick={() => setStatus(a, 'confirmada')}>
                    Confirmar
                  </Button>
                )}
                {future && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'cancelada')}>
                    Cancelar
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Empty icon={CalendarDays} title="Sin citas" text="Agende la próxima cita del paciente.">
          <Button variant="tinted" icon={Plus} onClick={onAdd}>
            Agendar
          </Button>
        </Empty>
      )}
    </div>
  );
}

function PaymentsTab({ patient, list }) {
  const print = usePrint();
  const { settings } = useSettings();
  const total = list.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="card">
      <div className="card-head">
        <Wallet size={17} color="var(--green)" />
        <h3>Historial de pagos</h3>
        <span className="sub" style={{ marginLeft: 'auto' }}>
          Total: <b>{money(total)}</b>
        </span>
      </div>
      {list.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Forma de pago</th>
              <th className="num">Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{fmtDateTime(p.created_at)}</td>
                <td>{p.description || p.concept}</td>
                <td>{PAY_METHODS[p.method]}</td>
                <td className="num strong">{money(p.amount)}</td>
                <td className="num">
                  <Button size="sm" variant="ghost" icon={Printer} onClick={() => print(<ReciboDoc payment={p} patient={patient} settings={settings} />)} aria-label="Imprimir recibo" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty icon={Wallet} title="Sin pagos registrados" />
      )}
    </div>
  );
}
