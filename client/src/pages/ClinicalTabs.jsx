import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileHeart, Printer, Save, Plus, Stethoscope, Send, ChevronDown, Copy, Pill, CalendarPlus, ClipboardList, Pencil } from 'lucide-react';
import { api } from '../api.js';
import { usePrint, useSettings, useToast } from '../context.jsx';
import { addDays, ageLabel, fmtDate, fmtDateTime, fullName, genderLabel, gtDateKey, isChild, PATIENT_TYPES, toGtIso } from '../utils.js';
import { Badge, Button, Empty, Input, Modal, Textarea, listItem } from '../components/ui.jsx';
import { ExamForm, PatientTypeSelector, examToText } from '../components/ExamForm.jsx';
import { FichaDoc, ReferenciaDoc, SeguimientoDoc } from '../components/Documents.jsx';
import { RxEditor, emptyRx } from '../components/CareWidgets.jsx';

const ANT = [
  ['ant_medicos', 'Médicos'],
  ['ant_quirurgicos', 'Quirúrgicos'],
  ['ant_traumaticos', 'Traumáticos'],
  ['ant_alergias', 'Alergias'],
  ['ant_familiares', 'Familiares'],
];

const Section = ({ n, title, right, children }) => (
  <div className="section">
    <div className="section-title">
      <span className="num-badge">{n}</span>
      <h3>{title}</h3>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
    {children}
  </div>
);

const defaultType = (patient) => (isChild(patient.birth_date) ? 'pediatrico' : 'adulto');

function recordToForm(record, patient) {
  return {
    patient_type: record?.patient_type || defaultType(patient),
    motivo_consulta: record?.motivo_consulta || '',
    historia_enfermedad: record?.historia_enfermedad || '',
    examen_fisico: record?.examen_fisico || {},
    estudios: record?.estudios || '',
    diagnostico: record?.diagnostico || '',
    tratamiento: record?.tratamiento || '',
    referencia: record?.referencia || '',
    comentarios: record?.comentarios || '',
    antecedentes: Object.fromEntries(ANT.map(([k]) => [k, patient[k] || ''])),
  };
}

/* ======================= FICHA CLÍNICA ======================= */
export function FichaTab({ patient, record, onSaved, onEditPatient }) {
  const toast = useToast();
  const print = usePrint();
  const { settings } = useSettings();
  const initial = useMemo(() => recordToForm(record, patient), [record, patient]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(!!record);

  useEffect(() => {
    setForm(initial);
    setStarted(!!record);
  }, [initial, record]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setAnt = (k) => (e) => setForm((f) => ({ ...f, antecedentes: { ...f.antecedentes, [k]: e.target.value } }));

  const save = async () => {
    setSaving(true);
    try {
      const rec = await api.put(`/patients/${patient.id}/record`, form);
      toast.success(record ? 'Ficha clínica actualizada' : 'Ficha clínica creada');
      onSaved(rec);
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!started) {
    return (
      <div className="card">
        <Empty icon={FileHeart} title="Este paciente aún no tiene ficha clínica" text="La ficha clínica corresponde a la consulta #1. Las siguientes visitas se registran como seguimiento.">
          <Button icon={Plus} onClick={() => setStarted(true)}>
            Iniciar ficha clínica
          </Button>
        </Empty>
      </div>
    );
  }

  const type = PATIENT_TYPES[form.patient_type];

  return (
    <>
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <FileHeart size={18} color="var(--blue)" />
          <div>
            <h3>Ficha clínica · Consulta #1</h3>
            <div className="sub">{record ? `Registrada el ${fmtDateTime(record.created_at)}` : 'Nueva ficha'}</div>
          </div>
          <div style={{ marginLeft: 'auto' }} className="row">
            <PatientTypeSelector value={form.patient_type} gender={patient.gender} onChange={(v) => setForm((f) => ({ ...f, patient_type: v }))} />
            {record && (
              <Button variant="secondary" icon={Printer} onClick={() => print(<FichaDoc patient={patient} record={record} settings={settings} />)}>
                Imprimir
              </Button>
            )}
          </div>
        </div>

        <Section n={1} title="Datos del paciente" right={<Button size="sm" variant="ghost" icon={Pencil} onClick={onEditPatient}>Editar</Button>}>
          <div className="form-grid">
            <Input className="c6" label="Nombre" auto readOnly value={fullName(patient)} />
            <Input className="c3" label="Edad" auto readOnly value={ageLabel(patient.birth_date)} />
            <Input className="c3" label="Género" auto readOnly value={genderLabel(patient.gender)} />
            <Input className="c3" label="Teléfono" auto readOnly value={patient.phone || '—'} />
            <Input className="c3" label="Religión" auto readOnly value={patient.religion || '—'} />
            <Input className="c6" label="Dirección" auto readOnly value={patient.address || '—'} />
          </div>
        </Section>

        <Section n={2} title="Antecedentes">
          <div className="form-grid">
            {ANT.map(([k, l]) => (
              <Textarea key={k} className={k === 'ant_familiares' ? 'c12' : 'c6'} minRows={1} label={l} value={form.antecedentes[k]} onChange={setAnt(k)} placeholder="Niega" />
            ))}
          </div>
        </Section>

        <Section n={3} title="Motivo de consulta">
          <Textarea minRows={1} value={form.motivo_consulta} onChange={set('motivo_consulta')} placeholder="¿Por qué consulta el paciente?" />
        </Section>

        <Section n={4} title="Historia de la enfermedad">
          <Textarea minRows={3} value={form.historia_enfermedad} onChange={set('historia_enfermedad')} placeholder="Inicio, evolución, síntomas asociados…" />
        </Section>

        <Section n={5} title="Examen físico" right={<Badge tone={type.tone}>{type.label}</Badge>}>
          <ExamForm type={form.patient_type} value={form.examen_fisico} onChange={(v) => setForm((f) => ({ ...f, examen_fisico: v }))} />
        </Section>

        <Section n={6} title="Estudios">
          <Textarea minRows={1} value={form.estudios} onChange={set('estudios')} placeholder="Laboratorios, imágenes u otros estudios solicitados" />
        </Section>

        <Section n={7} title="Diagnóstico" right={<PatientTypeSelector value={form.patient_type} gender={patient.gender} onChange={(v) => setForm((f) => ({ ...f, patient_type: v }))} />}>
          <Textarea minRows={2} value={form.diagnostico} onChange={set('diagnostico')} placeholder="Impresión clínica / diagnóstico" />
        </Section>

        <Section n={8} title="Tratamiento">
          <Textarea minRows={2} value={form.tratamiento} onChange={set('tratamiento')} />
        </Section>

        <Section n={9} title="Referencia">
          <Textarea minRows={1} value={form.referencia} onChange={set('referencia')} placeholder="Especialidad o institución, si aplica" />
        </Section>

        <Section n={10} title="Comentarios">
          <Textarea minRows={1} value={form.comentarios} onChange={set('comentarios')} />
        </Section>
      </div>

      <AnimatePresence>
        {(dirty || !record) && (
          <motion.div className="save-bar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
            <span style={{ flex: 1, fontWeight: 500 }}>{record ? 'Tiene cambios sin guardar' : 'Complete la ficha y guárdela'}</span>
            {record && (
              <Button variant="secondary" size="sm" onClick={() => setForm(initial)}>
                Descartar
              </Button>
            )}
            <Button size="sm" icon={Save} loading={saving} onClick={save}>
              Guardar ficha
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ======================= SEGUIMIENTOS ======================= */
export function FollowUpsTab({ patient, record, followUps, onCreated, goToFicha }) {
  const print = usePrint();
  const { settings } = useSettings();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(followUps[0]?.id);

  if (!record) {
    return (
      <div className="card">
        <Empty icon={ClipboardList} title="Primero registre la ficha clínica" text="El seguimiento continúa a partir de la consulta #1.">
          <Button onClick={goToFicha}>Ir a ficha clínica</Button>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="muted">
          {followUps.length} seguimiento{followUps.length === 1 ? '' : 's'} registrado{followUps.length === 1 ? '' : 's'} · Se llena una hoja por visita
        </div>
        <div className="spacer" />
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Nuevo seguimiento
        </Button>
      </div>

      <div className="timeline">
        {followUps.map((f, i) => {
          const expanded = open === f.id;
          return (
            <motion.div key={f.id} className="tl-item" {...listItem(i)}>
              <div className="tl-dot">{f.visit_number}</div>
              <div className="card">
                <div className="card-head" style={{ cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : f.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <h3>Consulta #{f.visit_number}</h3>
                      <Badge tone={PATIENT_TYPES[f.patient_type].tone}>{PATIENT_TYPES[f.patient_type].label}</Badge>
                      {f.prescription && <Badge tone="tone-green" icon={Pill}>Receta</Badge>}
                    </div>
                    <div className="sub">
                      {fmtDateTime(f.created_at)} · {f.diagnostico || f.motivo || 'Sin diagnóstico'}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" icon={Printer} onClick={(e) => { e.stopPropagation(); print(<SeguimientoDoc patient={patient} fu={f} settings={settings} />); }}>
                    Imprimir
                  </Button>
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDown size={18} color="var(--text-3)" />
                  </motion.span>
                </div>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
                      <dl className="kv card-body">
                        <dt>Motivo</dt>
                        <dd>{f.motivo || '—'}</dd>
                        <dt>Evolución</dt>
                        <dd>{f.evolucion || '—'}</dd>
                        <dt>Examen físico</dt>
                        <dd>{examToText(f.examen_fisico, f.patient_type) || '—'}</dd>
                        <dt>Estudios</dt>
                        <dd>{f.estudios || '—'}</dd>
                        <dt>Diagnóstico</dt>
                        <dd>{f.diagnostico || '—'}</dd>
                        <dt>Tratamiento</dt>
                        <dd>{f.tratamiento || '—'}</dd>
                        <dt>Comentarios</dt>
                        <dd>{f.comentarios || '—'}</dd>
                        {f.prescription && (
                          <>
                            <dt>Receta</dt>
                            <dd>{f.prescription.items.map((it) => `${it.medicamento} ${it.presentacion || ''} — ${[it.dosis, it.frecuencia, it.duracion].filter(Boolean).join(', ')}`).join('\n')}</dd>
                          </>
                        )}
                      </dl>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
        <div className="tl-item">
          <div className="tl-dot" style={{ background: 'var(--blue)', color: '#fff' }}>1</div>
          <div className="card card-body row">
            <FileHeart size={17} color="var(--blue)" />
            <div style={{ flex: 1 }}>
              <div className="strong">Consulta #1 · Ficha clínica</div>
              <div className="small muted">
                {fmtDateTime(record.created_at)} · {record.diagnostico}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={goToFicha}>
              Ver ficha
            </Button>
          </div>
        </div>
      </div>

      <FollowUpModal open={creating} onClose={() => setCreating(false)} patient={patient} record={record} last={followUps[0]} onCreated={onCreated} />
    </>
  );
}

function FollowUpModal({ open, onClose, patient, record, last, onCreated }) {
  const toast = useToast();
  const prev = last || record;
  const blank = () => ({
    patient_type: prev?.patient_type || defaultType(patient),
    motivo: '',
    evolucion: '',
    examen_fisico: { talla: prev?.examen_fisico?.talla || '', fur: prev?.examen_fisico?.fur || '', gestas: prev?.examen_fisico?.gestas || '', partos: prev?.examen_fisico?.partos || '', cesareas: prev?.examen_fisico?.cesareas || '', abortos: prev?.examen_fisico?.abortos || '' },
    estudios: '',
    diagnostico: '',
    tratamiento: '',
    comentarios: '',
  });
  const [form, setForm] = useState(blank);
  const [withRx, setWithRx] = useState(false);
  const [rx, setRx] = useState([emptyRx()]);
  const [rxInd, setRxInd] = useState('');
  const [withAppt, setWithAppt] = useState(false);
  const [apptDate, setApptDate] = useState(addDays(gtDateKey(), 15));
  const [apptTime, setApptTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank());
      setWithRx(false);
      setRx([emptyRx()]);
      setRxInd('');
      setWithAppt(false);
      setApptDate(addDays(gtDateKey(), 15));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const copyPrev = (k) => setForm((f) => ({ ...f, [k]: prev?.[k] || '' }));
  const CopyBtn = ({ k }) => (prev?.[k] ? <Button size="sm" variant="ghost" icon={Copy} onClick={() => copyPrev(k)}>Usar anterior</Button> : null);

  const save = async () => {
    setSaving(true);
    try {
      const items = rx.filter((i) => i.medicamento.trim());
      await api.post(`/patients/${patient.id}/followups`, {
        ...form,
        prescription: withRx && items.length ? { items, indicaciones: rxInd } : null,
        next_appointment: withAppt ? { scheduled_at: toGtIso(apptDate, apptTime), reason: 'Seguimiento' } : null,
      });
      toast.success('Seguimiento registrado');
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={920}
      icon={Stethoscope}
      title="Nuevo seguimiento de caso"
      subtitle={`${fullName(patient)} · se registrará como consulta #${(last?.visit_number || 1) + 1}`}
      footer={
        <>
          <div className="spacer" />
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Save} onClick={save} loading={saving}>
            Guardar seguimiento
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="row">
          <span className="strong">Tipo de paciente</span>
          <PatientTypeSelector value={form.patient_type} gender={patient.gender} onChange={(v) => setForm((f) => ({ ...f, patient_type: v }))} />
        </div>
        {prev && (
          <div className="mini">
            <span className="strong">Última consulta ({fmtDate(prev.created_at)}): </span>
            {prev.diagnostico || '—'} · <span className="muted">{prev.tratamiento}</span>
          </div>
        )}
        <div className="form-grid">
          <Textarea className="c6" minRows={1} label="Motivo de la visita" value={form.motivo} onChange={set('motivo')} />
          <Textarea className="c6" minRows={1} label="Evolución" value={form.evolucion} onChange={set('evolucion')} placeholder="¿Cómo ha evolucionado desde la última visita?" />
        </div>
        <div>
          <div className="strong" style={{ marginBottom: 10 }}>Examen físico</div>
          <ExamForm type={form.patient_type} value={form.examen_fisico} onChange={(v) => setForm((f) => ({ ...f, examen_fisico: v }))} />
        </div>
        <div className="form-grid">
          <div className="c6">
            <Textarea minRows={1} label="Estudios" value={form.estudios} onChange={set('estudios')} />
          </div>
          <div className="c6">
            <Textarea minRows={1} label={<>Diagnóstico <CopyBtn k="diagnostico" /></>} value={form.diagnostico} onChange={set('diagnostico')} />
          </div>
          <div className="c6">
            <Textarea minRows={2} label={<>Tratamiento <CopyBtn k="tratamiento" /></>} value={form.tratamiento} onChange={set('tratamiento')} />
          </div>
          <div className="c6">
            <Textarea minRows={2} label="Comentarios" value={form.comentarios} onChange={set('comentarios')} />
          </div>
        </div>

        <div className="mini" style={{ padding: 14 }}>
          <label className="check">
            <input type="checkbox" checked={withRx} onChange={(e) => setWithRx(e.target.checked)} />
            <Pill size={16} color="var(--green)" /> Emitir receta con este seguimiento
          </label>
          <AnimatePresence>
            {withRx && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <RxEditor items={rx} onChange={setRx} />
                  <Textarea label="Indicaciones" minRows={1} value={rxInd} onChange={(e) => setRxInd(e.target.value)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mini" style={{ padding: 14 }}>
          <label className="check">
            <input type="checkbox" checked={withAppt} onChange={(e) => setWithAppt(e.target.checked)} />
            <CalendarPlus size={16} color="var(--blue)" /> Agendar próxima cita de seguimiento
          </label>
          {withAppt && (
            <div className="form-grid" style={{ paddingTop: 12 }}>
              <Input className="c6" type="date" label="Fecha" min={gtDateKey()} value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
              <Input className="c6" type="time" label="Hora" value={apptTime} onChange={(e) => setApptTime(e.target.value)} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ======================= REFERENCIAS ======================= */
export function ReferralsTab({ patient, record, followUps, referrals, labs, onCreated }) {
  const print = usePrint();
  const { settings } = useSettings();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="muted">La hoja de referencia se llena automáticamente con la información más reciente del expediente.</div>
        <div className="spacer" />
        <Button icon={Send} onClick={() => setCreating(true)}>
          Nueva referencia
        </Button>
      </div>
      <div className="card">
        {referrals.length ? (
          <div className="list">
            {referrals.map((r, i) => (
              <motion.div key={r.id} className="list-item" {...listItem(i)}>
                <div className="stat-icon tone-blue">
                  <Send size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong">
                    {r.referido_a} {r.especialidad && <span className="muted">· {r.especialidad}</span>}
                  </div>
                  <div className="small muted">
                    {fmtDateTime(r.created_at)} · {r.motivo}
                  </div>
                </div>
                <Button size="sm" variant="secondary" icon={Printer} onClick={() => print(<ReferenciaDoc patient={patient} refl={r} settings={settings} />)}>
                  Imprimir
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <Empty icon={Send} title="Sin referencias" text="Cuando refiera al paciente a un especialista, la hoja aparecerá aquí lista para imprimir." />
        )}
      </div>
      <ReferralModal open={creating} onClose={() => setCreating(false)} patient={patient} record={record} followUps={followUps} labs={labs} onCreated={onCreated} />
    </>
  );
}

function referralDraft(record, followUps, labs) {
  const last = followUps[0] || record;
  const results = labs
    .filter((o) => o.status === 'completado')
    .slice(0, 3)
    .flatMap((o) => o.items.filter((i) => i.result).map((i) => `${i.name}: ${i.result}`));
  return {
    referido_a: '',
    especialidad: '',
    motivo: record?.referencia || '',
    historia_enfermedad: [record?.historia_enfermedad, ...followUps.slice().reverse().map((f) => f.evolucion && `Consulta #${f.visit_number}: ${f.evolucion}`)].filter(Boolean).join('\n'),
    examen_fisico: last ? examToText(last.examen_fisico, last.patient_type) : '',
    comentario: '',
    tratamiento: last?.tratamiento || '',
    impresion_clinica: last?.diagnostico || '',
    estudios_realizados: [last?.estudios, ...results].filter(Boolean).join('\n'),
  };
}

function ReferralModal({ open, onClose, patient, record, followUps, labs, onCreated }) {
  const toast = useToast();
  const print = usePrint();
  const { settings } = useSettings();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(referralDraft(record, followUps, labs));
  }, [open, record, followUps, labs]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (andPrint) => {
    setSaving(true);
    try {
      const r = await api.post(`/patients/${patient.id}/referrals`, form);
      toast.success('Referencia guardada');
      onCreated();
      onClose();
      if (andPrint) print(<ReferenciaDoc patient={patient} refl={r} settings={settings} />);
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={860}
      icon={Send}
      title="Hoja de referencia"
      subtitle="Prellenada con la ficha, el último seguimiento y los resultados de laboratorio"
      footer={
        <>
          <Button variant="secondary" onClick={() => save(false)} loading={saving}>
            Guardar
          </Button>
          <Button icon={Printer} onClick={() => save(true)} loading={saving}>
            Guardar e imprimir
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Input className="c8" label="Referido a (institución o médico)" value={form.referido_a} onChange={set('referido_a')} placeholder="Ej. Hospital Roosevelt — Consulta Externa" autoFocus />
        <Input className="c4" label="Especialidad" value={form.especialidad} onChange={set('especialidad')} placeholder="Ej. Cardiología" />
        <div className="c12 mini">
          <span className="strong">{fullName(patient)}</span> · {ageLabel(patient.birth_date)} · {genderLabel(patient.gender)} · {patient.phone || 'Sin teléfono'}
          <span className="auto-tag" style={{ marginLeft: 8 }}>Datos automáticos</span>
        </div>
        <Textarea className="c12" minRows={1} label="Motivo de la referencia" value={form.motivo} onChange={set('motivo')} />
        <Textarea className="c12" minRows={2} label="Historia de la enfermedad" value={form.historia_enfermedad} onChange={set('historia_enfermedad')} />
        <Textarea className="c12" minRows={2} label="Examen físico" value={form.examen_fisico} onChange={set('examen_fisico')} />
        <Textarea className="c6" minRows={2} label="Impresión clínica" value={form.impresion_clinica} onChange={set('impresion_clinica')} />
        <Textarea className="c6" minRows={2} label="Estudios realizados" value={form.estudios_realizados} onChange={set('estudios_realizados')} />
        <Textarea className="c6" minRows={2} label="Tratamiento" value={form.tratamiento} onChange={set('tratamiento')} />
        <Textarea className="c6" minRows={2} label="Comentario" value={form.comentario} onChange={set('comentario')} />
      </div>
    </Modal>
  );
}
