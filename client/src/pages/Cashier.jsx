import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Stethoscope, FlaskConical, Banknote, Printer, Plus, Receipt } from 'lucide-react';
import { api, useApi } from '../api.js';
import { usePrint, useSettings, useToast } from '../context.jsx';
import { fmtTime, gtDateKey, money, PAY_METHODS } from '../utils.js';
import { Badge, Button, Empty, Input, LoadingList, Modal, PageHead, Segmented, listItem } from '../components/ui.jsx';
import { PatientPicker } from '../components/PatientWidgets.jsx';
import { LabOrderCard, MethodPicker } from '../components/LabWidgets.jsx';
import { ReciboDoc } from '../components/Documents.jsx';

export default function Cashier() {
  const [date, setDate] = useState(gtDateKey());
  const paymentsQ = useApi(`/payments?date=${date}`);
  const unpaidQ = useApi('/lab-orders?payment=pendiente');
  const [charging, setCharging] = useState(false);
  const print = usePrint();
  const { settings } = useSettings();
  const list = paymentsQ.data || [];
  const sum = (f) => list.filter(f).reduce((s, p) => s + p.amount, 0);
  const unpaid = (unpaidQ.data || []).filter((o) => o.status !== 'cancelado');

  const cards = [
    { label: 'Total del día', value: sum(() => true), icon: Wallet, tone: 'tone-blue' },
    { label: 'Consultas', value: sum((p) => p.concept === 'consulta'), icon: Stethoscope, tone: 'tone-green' },
    { label: 'Laboratorio', value: sum((p) => p.concept === 'laboratorio'), icon: FlaskConical, tone: 'tone-purple' },
    { label: 'Efectivo / Tarjeta / Transf.', value: null, icon: Banknote, tone: 'tone-amber', text: `${money(sum((p) => p.method === 'efectivo'))} · ${money(sum((p) => p.method === 'tarjeta'))} · ${money(sum((p) => p.method === 'transferencia'))}` },
  ];

  return (
    <>
      <PageHead title="Caja y cobros" subtitle="Cobro de consultas y exámenes de laboratorio">
        <Input type="date" value={date} max={gtDateKey()} onChange={(e) => setDate(e.target.value || gtDateKey())} />
        <Button icon={Plus} onClick={() => setCharging(true)}>
          Cobrar consulta
        </Button>
      </PageHead>

      <div className="grid g4" style={{ marginBottom: 20 }}>
        {cards.map((c, i) => (
          <motion.div key={c.label} className="card stat" {...listItem(i)}>
            <div className={`stat-icon ${c.tone}`}>
              <c.icon size={19} />
            </div>
            <div>
              <div className="stat-value" style={c.text ? { fontSize: 15, marginTop: 6 } : undefined}>
                {c.text || money(c.value)}
              </div>
              <div className="stat-label">{c.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <Receipt size={17} color="var(--blue)" />
            <h3>Movimientos</h3>
            <span className="sub">{list.length} cobros</span>
          </div>
          {paymentsQ.loading && !paymentsQ.data ? (
            <LoadingList />
          ) : list.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Concepto</th>
                  <th>Pago</th>
                  <th className="num">Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{fmtTime(p.created_at)}</td>
                    <td className="strong">{p.first_name ? `${p.first_name} ${p.last_name}` : '—'}</td>
                    <td>
                      <Badge tone={p.concept === 'consulta' ? 'tone-green' : p.concept === 'laboratorio' ? 'tone-purple' : 'tone-gray'}>{p.description || p.concept}</Badge>
                    </td>
                    <td>{PAY_METHODS[p.method]}</td>
                    <td className="num strong">{money(p.amount)}</td>
                    <td className="num">
                      <Button size="sm" variant="ghost" icon={Printer} aria-label="Imprimir recibo" onClick={() => print(<ReciboDoc payment={p} patient={p.first_name ? p : null} settings={settings} />)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon={Wallet} title="Sin cobros en esta fecha" />
          )}
        </div>

        <div className="card sticky">
          <div className="card-head">
            <FlaskConical size={17} color="var(--amber)" />
            <h3>Laboratorios por cobrar</h3>
            <Badge tone="tone-amber">{unpaid.length}</Badge>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unpaid.map((o) => (
              <LabOrderCard key={o.id} order={o} compact onChange={() => { unpaidQ.reload(); paymentsQ.reload(); }} />
            ))}
            {!unpaid.length && <div className="empty small">Todo al día 🎉</div>}
          </div>
        </div>
      </div>

      <ConsultChargeModal open={charging} onClose={() => setCharging(false)} onDone={(pay, patient) => { paymentsQ.reload(); print(<ReciboDoc payment={pay} patient={patient} settings={settings} />); }} />
    </>
  );
}

function ConsultChargeModal({ open, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [patient, setPatient] = useState(null);
  const [concept, setConcept] = useState('consulta');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);
  const value = concept === 'consulta' ? (amount === '' ? settings.consult_price : amount) : amount;

  const save = async () => {
    setSaving(true);
    try {
      const pay = await api.post('/payments', { patient_id: patient?.id || null, concept, amount: Number(value), description: desc || null, method });
      toast.success(`Cobro registrado: ${money(pay.amount)}`);
      onDone(pay, patient);
      onClose();
      setPatient(null);
      setAmount('');
      setDesc('');
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
      width={540}
      icon={Wallet}
      title="Registrar cobro"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="success" onClick={save} loading={saving} disabled={!value}>Cobrar {money(value)}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented value={concept} onChange={setConcept} options={[{ value: 'consulta', label: 'Consulta médica', icon: Stethoscope }, { value: 'otro', label: 'Otro cobro' }]} />
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="form-grid">
          <Input className="c6" label="Monto" type="number" min={0} suffix="GTQ" value={concept === 'consulta' && amount === '' ? settings.consult_price : amount} onChange={(e) => setAmount(e.target.value)} hint={concept === 'consulta' ? 'precio vigente' : ''} />
          <Input className="c6" label="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={concept === 'consulta' ? 'Consulta médica' : 'Ej. curación'} />
        </div>
        <MethodPicker value={method} onChange={setMethod} />
      </div>
    </Modal>
  );
}

