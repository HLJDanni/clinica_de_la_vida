import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Printer, Trash2, Minus, Plus, ArrowRightLeft, Check, Stethoscope } from 'lucide-react';
import { api, useApi } from '../api.js';
import { usePrint, useSettings, useToast } from '../context.jsx';
import { fmtDate, fullName, money } from '../utils.js';
import { Badge, Button, Empty, Input, LoadingList, Modal, PageHead, Textarea, listItem } from '../components/ui.jsx';
import { ExamPicker } from '../components/LabWidgets.jsx';
import { PatientPicker } from '../components/PatientWidgets.jsx';
import { CotizacionDoc } from '../components/Documents.jsx';

export default function Quotes() {
  const toast = useToast();
  const print = usePrint();
  const { settings } = useSettings();
  const { data: exams } = useApi('/lab-exams');
  const quotesQ = useApi('/quotes');
  const [patient, setPatient] = useState(null);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState({}); // exam_id -> qty
  const [consulta, setConsulta] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(null);

  const selected = (exams || []).filter((e) => items[e.id]);
  const subtotal = selected.reduce((s, e) => s + e.price * items[e.id], 0) + (consulta ? Number(settings.consult_price || 0) : 0);
  const total = Math.round(subtotal * (1 - (Number(discount) || 0) / 100) * 100) / 100;

  const toggle = (id) => setItems((it) => {
    const n = { ...it };
    if (n[id]) delete n[id];
    else n[id] = 1;
    return n;
  });
  const setQty = (id, d) => setItems((it) => ({ ...it, [id]: Math.max(1, Math.min(50, it[id] + d)) }));
  const pickPatient = (p) => {
    setPatient(p);
    if (p) {
      setCustomer(fullName(p));
      setPhone(p.phone || '');
    }
  };
  const reset = () => {
    setItems({});
    setConsulta(false);
    setDiscount(0);
    setNotes('');
    setPatient(null);
    setCustomer('');
    setPhone('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const qt = await api.post('/quotes', {
        customer_name: customer,
        customer_phone: phone,
        patient_id: patient?.id || null,
        items: Object.entries(items).map(([exam_id, qty]) => ({ exam_id: Number(exam_id), qty })),
        include_consulta: consulta,
        discount_pct: Number(discount) || 0,
        notes,
      });
      toast.success(`Cotización #${qt.id} guardada`);
      print(<CotizacionDoc quote={qt} settings={settings} />);
      reset();
      quotesQ.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (qt) => {
    try {
      await api.del(`/quotes/${qt.id}`);
      toast.success('Cotización eliminada');
      quotesQ.reload();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <>
      <PageHead title="Cotizaciones" subtitle="Cotice varios exámenes a la vez, con o sin consulta médica" />
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-grid">
            <div className="c12">
              <PatientPicker label="Paciente registrado (opcional)" value={patient} onChange={pickPatient} allowCreate={false} />
            </div>
            <Input className="c8" label="Nombre del cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Persona que solicita la cotización" />
            <Input className="c4" label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="check mini" style={{ padding: 12 }}>
            <input type="checkbox" checked={consulta} onChange={(e) => setConsulta(e.target.checked)} />
            <Stethoscope size={16} color="var(--blue)" /> Incluir consulta médica con {settings.doctor_name || 'la Dra. Delia'} · <b>{money(settings.consult_price)}</b>
          </label>
          <ExamPicker exams={exams || []} selected={Object.keys(items).map(Number)} onToggle={toggle} height={420} />
        </div>

        <div className="card sticky">
          <div className="card-head">
            <FileText size={17} color="var(--blue)" />
            <h3>Resumen</h3>
            <span className="sub" style={{ marginLeft: 'auto' }}>
              {selected.length + (consulta ? 1 : 0)} conceptos
            </span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <AnimatePresence initial={false}>
              {consulta && (
                <motion.div key="consulta" className="list-item" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div style={{ flex: 1 }} className="small strong">Consulta médica</div>
                  <div className="mono small strong">{money(settings.consult_price)}</div>
                </motion.div>
              )}
              {selected.map((e) => (
                <motion.div key={e.id} className="list-item" style={{ padding: '10px 16px', gap: 8 }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong">{e.name}</div>
                    <div className="small muted">{money(e.price)} c/u</div>
                  </div>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <Button size="sm" variant="ghost" icon={Minus} onClick={() => setQty(e.id, -1)} aria-label="Menos" />
                    <span className="mono strong" style={{ width: 18, textAlign: 'center' }}>{items[e.id]}</span>
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => setQty(e.id, 1)} aria-label="Más" />
                  </div>
                  <div className="mono small strong" style={{ width: 78, textAlign: 'right' }}>{money(e.price * items[e.id])}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {!selected.length && !consulta && <div className="empty small">Seleccione exámenes del catálogo</div>}
          </div>
          <div className="card-body" style={{ borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row">
              <span className="muted">Subtotal</span>
              <span className="spacer" />
              <span className="mono strong">{money(subtotal)}</span>
            </div>
            <Input label="Descuento" type="number" min={0} max={100} suffix="%" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Textarea label="Observaciones" minRows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="total-box">
              <span className="strong">Total</span>
              <b>{money(total)}</b>
            </div>
            <Button block size="lg" icon={Printer} loading={saving} disabled={!customer.trim() || (!selected.length && !consulta)} onClick={save}>
              Guardar e imprimir
            </Button>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, margin: '28px 0 12px' }}>Cotizaciones recientes</h2>
      <div className="card">
        {quotesQ.loading && !quotesQ.data ? (
          <LoadingList />
        ) : quotesQ.data?.length ? (
          <div className="list">
            {quotesQ.data.map((qt, i) => (
              <motion.div key={qt.id} className="list-item" {...listItem(i)}>
                <div className="stat-icon tone-blue">
                  <FileText size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="strong">{qt.customer_name}</span>
                    <span className="small muted">#{qt.id}</span>
                    {qt.converted_order_id && <Badge tone="tone-green" icon={Check}>Convertida en orden #{qt.converted_order_id}</Badge>}
                    {!qt.converted_order_id && new Date(qt.valid_until) < new Date() && <Badge tone="tone-amber">Vencida</Badge>}
                  </div>
                  <div className="small muted">
                    {fmtDate(qt.created_at)} · {qt.items.length} conceptos · válida hasta {fmtDate(qt.valid_until)}
                  </div>
                </div>
                <div className="mono strong" style={{ fontSize: 15 }}>{money(qt.total)}</div>
                <Button size="sm" variant="ghost" icon={Printer} onClick={() => print(<CotizacionDoc quote={qt} settings={settings} />)} aria-label="Imprimir" />
                {!qt.converted_order_id && qt.items.some((it) => it.exam_id) && (
                  <Button size="sm" variant="tinted" icon={ArrowRightLeft} onClick={() => setConverting(qt)}>
                    Convertir en orden
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(qt)} aria-label="Eliminar" />
              </motion.div>
            ))}
          </div>
        ) : (
          <Empty icon={FileText} title="Aún no hay cotizaciones" />
        )}
      </div>

      <ConvertModal quote={converting} onClose={() => setConverting(null)} onDone={quotesQ.reload} />
    </>
  );
}

function ConvertModal({ quote, onClose, onDone }) {
  const toast = useToast();
  const [patient, setPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  const convert = async () => {
    if (!patient) return toast.error('Seleccione o registre el paciente');
    setSaving(true);
    try {
      const o = await api.post(`/quotes/${quote.id}/convert`, { patient_id: patient.id });
      toast.success(`Orden de laboratorio #${o.id} creada`);
      onDone();
      onClose();
      setPatient(null);
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={!!quote}
      onClose={onClose}
      width={520}
      icon={ArrowRightLeft}
      title="Convertir en orden de laboratorio"
      subtitle={quote && `Cotización #${quote.id} · ${quote.customer_name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={convert} loading={saving}>Crear orden</Button>
        </>
      }
    >
      <PatientPicker value={patient} onChange={setPatient} />
      <p className="small muted">Los exámenes se crearán con el precio vigente del catálogo. La consulta, si estaba incluida, se cobra en Caja.</p>
    </Modal>
  );
}
