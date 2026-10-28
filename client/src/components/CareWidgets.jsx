import { useEffect, useState } from 'react';
import { CalendarPlus, Pill, Plus, Trash2, Printer } from 'lucide-react';
import { api } from '../api.js';
import { usePrint, useSettings, useToast } from '../context.jsx';
import { addDays, APPT_TYPES, fmtDateTime, gtDateKey, toGtIso } from '../utils.js';
import { Button, Input, Modal, Segmented, Textarea } from './ui.jsx';
import { PatientPicker } from './PatientWidgets.jsx';
import { RecetaDoc } from './Documents.jsx';

/* ---------- Medicamentos ---------- */
export const emptyRx = () => ({ medicamento: '', presentacion: '', dosis: '', frecuencia: '', duracion: '' });
const FREQS = ['Cada 6 horas', 'Cada 8 horas', 'Cada 12 horas', 'Cada día', 'Cada noche', 'Si hay dolor o fiebre'];

export function RxEditor({ items, onChange }) {
  const set = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} className="mini" style={{ padding: 12 }}>
          <div className="form-grid">
            <Input className="c6" label={`Medicamento ${i + 1}`} value={it.medicamento} onChange={(e) => set(i, 'medicamento', e.target.value)} placeholder="Ej. Amoxicilina" />
            <Input className="c6" label="Presentación" value={it.presentacion} onChange={(e) => set(i, 'presentacion', e.target.value)} placeholder="Cápsulas 500 mg" />
            <Input className="c4" label="Dosis" value={it.dosis} onChange={(e) => set(i, 'dosis', e.target.value)} placeholder="1 cápsula" />
            <div className="c4 field">
              <label>Frecuencia</label>
              <input className="input" list="rx-freqs" value={it.frecuencia} onChange={(e) => set(i, 'frecuencia', e.target.value)} placeholder="Cada 8 horas" />
            </div>
            <Input className="c3" label="Duración" value={it.duracion} onChange={(e) => set(i, 'duracion', e.target.value)} placeholder="7 días" />
            <div className="c1" style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
              <Button variant="ghost" icon={Trash2} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar" disabled={items.length === 1} />
            </div>
          </div>
        </div>
      ))}
      <datalist id="rx-freqs">
        {FREQS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <Button variant="tinted" size="sm" icon={Plus} onClick={() => onChange([...items, emptyRx()])} style={{ alignSelf: 'flex-start' }}>
        Agregar medicamento
      </Button>
    </div>
  );
}

export function PrescriptionModal({ open, onClose, patient, onSaved, preset }) {
  const toast = useToast();
  const print = usePrint();
  const { settings } = useSettings();
  const [items, setItems] = useState([emptyRx()]);
  const [ind, setInd] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setItems([emptyRx()]);
      setInd(preset || '');
    }
  }, [open, preset]);

  const save = async (andPrint) => {
    const clean = items.filter((i) => i.medicamento.trim());
    if (!clean.length) return toast.error('Agregue al menos un medicamento');
    setSaving(true);
    try {
      const rx = await api.post(`/patients/${patient.id}/prescriptions`, { items: clean, indicaciones: ind });
      toast.success('Receta guardada');
      onSaved?.(rx);
      onClose();
      if (andPrint) print(<RecetaDoc patient={patient} rx={rx} settings={settings} />);
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
      icon={Pill}
      title="Nueva receta médica"
      subtitle={patient && `${patient.first_name} ${patient.last_name}`}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <RxEditor items={items} onChange={setItems} />
        <Textarea label="Indicaciones generales" minRows={2} value={ind} onChange={(e) => setInd(e.target.value)} placeholder="Ej. tomar con alimentos, regresar si hay fiebre…" />
      </div>
    </Modal>
  );
}

/* ---------- Citas ---------- */
const QUICK_TIMES = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

export function AppointmentModal({ open, onClose, patient: fixedPatient, onSaved, defaultType = 'consulta' }) {
  const toast = useToast();
  const [patient, setPatient] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [type, setType] = useState(defaultType);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (open) {
      setPatient(fixedPatient || null);
      setDate(addDays(gtDateKey(), 1));
      setTime('09:00');
      setType(defaultType);
      setReason('');
      setConflict(null);
    }
  }, [open, fixedPatient, defaultType]);

  const save = async (force = false) => {
    if (!patient) return toast.error('Seleccione un paciente');
    setSaving(true);
    try {
      const a = await api.post('/appointments', {
        patient_id: patient.id,
        scheduled_at: toGtIso(date, time),
        type,
        reason,
        duration_min: type === 'laboratorio' ? 15 : 30,
        force,
      });
      toast.success(`Cita agendada: ${fmtDateTime(a.scheduled_at)}`);
      onSaved?.(a);
      onClose();
    } catch (e) {
      if (e.data?.conflict) setConflict(e.message);
      else toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon={CalendarPlus}
      title="Agendar cita"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {conflict ? (
            <Button variant="danger" onClick={() => save(true)} loading={saving}>
              Agendar de todos modos
            </Button>
          ) : (
            <Button onClick={() => save(false)} loading={saving}>
              Agendar
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!fixedPatient && <PatientPicker value={patient} onChange={setPatient} />}
        <Segmented value={type} onChange={setType} options={Object.entries(APPT_TYPES).map(([value, label]) => ({ value, label }))} />
        <div className="form-grid">
          <Input className="c6" type="date" label="Fecha" value={date} min={gtDateKey()} onChange={(e) => { setDate(e.target.value); setConflict(null); }} />
          <Input className="c6" type="time" label="Hora" value={time} step={900} onChange={(e) => { setTime(e.target.value); setConflict(null); }} />
        </div>
        <div className="chips">
          {QUICK_TIMES.map((t) => (
            <button key={t} type="button" className="chip" style={{ cursor: 'pointer', ...(t === time ? { background: 'var(--blue-50)', borderColor: 'var(--blue-200)', color: 'var(--blue)' } : {}) }} onClick={() => { setTime(t); setConflict(null); }}>
              {t}
            </button>
          ))}
        </div>
        <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. control de presión arterial" />
        {conflict && <div className="login-error">{conflict}</div>}
      </div>
    </Modal>
  );
}
