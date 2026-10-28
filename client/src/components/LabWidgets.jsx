import { useEffect, useMemo, useState } from 'react';
import { Check, FlaskConical, Search, Wallet, Printer, ClipboardCheck, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { api, useApi } from '../api.js';
import { usePrint, useSettings, useToast } from '../context.jsx';
import { fmtDateTime, fullName, LAB_STATUS, money, normalizeText, PAY_STATUS } from '../utils.js';
import { Badge, Button, Modal, Segmented, Textarea } from './ui.jsx';
import { PatientPicker } from './PatientWidgets.jsx';
import { LabOrderDoc } from './Documents.jsx';

/** Selector múltiple de exámenes del catálogo, agrupado por categoría */
export function ExamPicker({ exams = [], selected, onToggle, height = 360 }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const n = normalizeText(q);
    const list = exams.filter((e) => !n || normalizeText(`${e.name} ${e.code} ${e.category}`).includes(n));
    return list.reduce((acc, e) => {
      (acc[e.category] ||= []).push(e);
      return acc;
    }, {});
  }, [exams, q]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="input-wrap">
        <Search size={16} />
        <input className="input" placeholder="Buscar examen…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="exam-list" style={{ maxHeight: height }}>
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat}>
            <div className="exam-cat">{cat}</div>
            {list.map((e) => {
              const on = selected.includes(e.id);
              return (
                <div key={e.id} className={`exam-row ${on ? 'on' : ''}`} onClick={() => onToggle(e.id)}>
                  <div className="checkbox">{on && <Check size={14} strokeWidth={3} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong" style={{ fontSize: 13.5 }}>
                      {e.name}
                    </div>
                    <div className="small muted">
                      {e.code} · {e.sample} · {e.turnaround}
                    </div>
                  </div>
                  <div className="strong mono">{money(e.price)}</div>
                </div>
              );
            })}
          </div>
        ))}
        {!Object.keys(groups).length && <div className="empty small">No se encontraron exámenes</div>}
      </div>
    </div>
  );
}

const METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
];
export function MethodPicker({ value, onChange }) {
  return <Segmented value={value} onChange={onChange} options={METHODS} />;
}

/** Nueva orden de laboratorio (desde recepción o desde la ficha clínica) */
export function LabOrderModal({ open, onClose, patient: fixedPatient, onCreated }) {
  const toast = useToast();
  const { data: exams } = useApi(open ? '/lab-exams' : null);
  const [patient, setPatient] = useState(null);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPatient(fixedPatient || null);
      setSelected([]);
      setNotes('');
      setPayNow(false);
    }
  }, [open, fixedPatient]);

  const total = (exams || []).filter((e) => selected.includes(e.id)).reduce((s, e) => s + e.price, 0);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!patient) return toast.error('Seleccione un paciente');
    if (!selected.length) return toast.error('Seleccione al menos un examen');
    setSaving(true);
    try {
      const o = await api.post('/lab-orders', { patient_id: patient.id, exam_ids: selected, notes, pay_now: payNow ? { method } : null });
      toast.success(payNow ? `Orden #${o.id} creada y cobrada` : `Orden #${o.id} creada`);
      onCreated?.(o);
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
      width={760}
      icon={FlaskConical}
      title="Nueva orden de laboratorio"
      subtitle="Los precios se toman del catálogo vigente"
      footer={
        <>
          <div className="spacer" />
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} icon={payNow ? Wallet : Check}>
            {payNow ? `Crear y cobrar ${money(total)}` : 'Crear orden'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {fixedPatient ? null : <PatientPicker value={patient} onChange={setPatient} />}
        <ExamPicker exams={exams || []} selected={selected} onToggle={toggle} height={300} />
        <Textarea label="Notas para el laboratorio" minRows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. paciente en ayunas" />
        <div className="total-box">
          <div>
            <div className="small" style={{ fontWeight: 600 }}>
              {selected.length} examen{selected.length === 1 ? '' : 'es'} seleccionado{selected.length === 1 ? '' : 's'}
            </div>
            <label className="check small" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> Cobrar ahora
            </label>
          </div>
          <b>{money(total)}</b>
        </div>
        {payNow && <MethodPicker value={method} onChange={setMethod} />}
      </div>
    </Modal>
  );
}

export function PayModal({ order, onClose, onPaid }) {
  const toast = useToast();
  const [method, setMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);
  const pay = async () => {
    setSaving(true);
    try {
      const o = await api.post(`/lab-orders/${order.id}/pay`, { method });
      toast.success(`Cobro registrado: ${money(o.total)}`);
      onPaid?.(o);
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      width={460}
      icon={Wallet}
      title="Cobrar orden de laboratorio"
      subtitle={order && `${fullName(order)} · Orden #${order.id}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" onClick={pay} loading={saving} icon={Check}>
            Confirmar cobro
          </Button>
        </>
      }
    >
      {order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="chips">
            {order.items.map((i) => (
              <span key={i.id} className="chip">
                {i.name} · {money(i.price)}
              </span>
            ))}
          </div>
          <div className="total-box">
            <span className="strong">Total a cobrar</span>
            <b>{money(order.total)}</b>
          </div>
          <MethodPicker value={method} onChange={setMethod} />
        </div>
      )}
    </Modal>
  );
}

export function ResultsModal({ order, onClose, onSaved }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (order) setItems(order.items.map((i) => ({ id: i.id, name: i.name, result: i.result || '' })));
  }, [order]);
  const save = async (complete) => {
    setSaving(true);
    try {
      const o = await api.put(`/lab-orders/${order.id}/results`, { items: items.map(({ id, result }) => ({ id, result })), complete });
      toast.success(complete ? 'Resultados listos' : 'Resultados guardados');
      onSaved?.(o);
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      width={640}
      icon={ClipboardCheck}
      title="Resultados de laboratorio"
      subtitle={order && `${fullName(order)} · Orden #${order.id}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => save(false)} loading={saving}>
            Guardar borrador
          </Button>
          <Button variant="success" icon={Check} onClick={() => save(true)} loading={saving}>
            Marcar como listos
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it, idx) => (
          <Textarea
            key={it.id}
            label={it.name}
            minRows={1}
            value={it.result}
            onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, result: e.target.value } : x)))}
            placeholder="Escriba el resultado…"
          />
        ))}
      </div>
    </Modal>
  );
}

/** Tarjeta de orden con acciones */
export function LabOrderCard({ order, onChange, showPatient = true, compact }) {
  const print = usePrint();
  const { settings } = useSettings();
  const [paying, setPaying] = useState(null);
  const [results, setResults] = useState(null);
  const st = LAB_STATUS[order.status];
  const ps = PAY_STATUS[order.payment_status];
  return (
    <div className={compact ? 'mini' : ''} style={compact ? undefined : { padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="strong">{showPatient ? fullName(order) : `Orden #${order.id}`}</span>
            {showPatient && <span className="small muted">#{order.id}</span>}
            <Badge tone={st.tone}>{st.label}</Badge>
            {order.status !== 'cancelado' && <Badge tone={ps.tone}>{ps.label}</Badge>}
          </div>
          <div className="small muted" style={{ margin: '3px 0 8px' }}>
            {fmtDateTime(order.created_at)} · {order.origin === 'consulta' ? 'Solicitado en consulta' : 'Directo en recepción'}
          </div>
          <div className="chips">
            {order.items.map((i) => (
              <span key={i.id} className="chip" title={i.result || ''}>
                {i.result && <Check size={12} color="var(--green)" strokeWidth={3} />}
                {i.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="strong mono" style={{ fontSize: 16 }}>
            {money(order.total)}
          </div>
        </div>
      </div>
      {order.status !== 'cancelado' && (
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          {order.payment_status === 'pendiente' && (
            <Button size="sm" variant="success" icon={Wallet} onClick={() => setPaying(order)}>
              Cobrar
            </Button>
          )}
          <Button size="sm" variant="tinted" icon={ClipboardCheck} onClick={() => setResults(order)}>
            Resultados
          </Button>
          <Button size="sm" variant="ghost" icon={Printer} onClick={() => print(<LabOrderDoc order={order} settings={settings} withResults={order.status === 'completado'} />)}>
            {order.status === 'completado' ? 'Imprimir resultados' : 'Imprimir orden'}
          </Button>
        </div>
      )}
      <PayModal order={paying} onClose={() => setPaying(null)} onPaid={onChange} />
      <ResultsModal order={results} onClose={() => setResults(null)} onSaved={onChange} />
    </div>
  );
}
