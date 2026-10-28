import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, UserPlus, X, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useAuth, useToast } from '../context.jsx';
import { ageLabel, fullName, isChild } from '../utils.js';
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from './ui.jsx';

/** Búsqueda de pacientes por nombre, iniciales, teléfono o DPI */
export function usePatientSearch(query, delay = 180) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query === null) return undefined;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get(`/patients?q=${encodeURIComponent(query)}`)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, delay]);
  return { results, loading };
}

/** Selector de paciente con creación rápida */
export function PatientPicker({ value, onChange, allowCreate = true, label = 'Paciente' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { results } = usePatientSearch(open ? q : null, 150);
  const box = useRef(null);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <Field label={label}>
        <div className="row" style={{ padding: '8px 10px', border: '1px solid var(--blue-200)', background: 'var(--blue-50)', borderRadius: 12 }}>
          <Avatar patient={value} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="strong">{fullName(value)}</div>
            <div className="small muted">
              {ageLabel(value.birth_date)} · {value.phone || 'Sin teléfono'}
            </div>
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(null)} aria-label="Quitar paciente" />
        </div>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div ref={box} style={{ position: 'relative' }}>
        <div className="input-wrap">
          <Search size={16} />
          <input
            className="input"
            placeholder="Buscar por nombre, iniciales (ej. MJLP) o teléfono…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              className="popover"
              style={{ left: 0, right: 0, width: 'auto', top: 'calc(100% + 6px)', maxHeight: 300, overflowY: 'auto' }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {results.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="palette-item"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  <Avatar patient={p} size={32} />
                  <div style={{ flex: 1 }}>
                    <div className="strong">{fullName(p)}</div>
                    <div className="small muted">
                      {p.initials} · {ageLabel(p.birth_date)} · {p.phone || '—'}
                    </div>
                  </div>
                </div>
              ))}
              {!results.length && <div className="small muted" style={{ padding: 14 }}>Sin coincidencias.</div>}
              {allowCreate && (
                <div className="palette-item" style={{ color: 'var(--blue)', fontWeight: 600, borderTop: '1px solid var(--line)' }} onClick={() => setCreating(true)}>
                  <UserPlus size={18} /> Registrar paciente nuevo{q ? ` “${q}”` : ''}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <PatientFormModal
        open={creating}
        initialName={q}
        onClose={() => setCreating(false)}
        onSaved={(p) => {
          setCreating(false);
          setOpen(false);
          setQ('');
          onChange(p);
        }}
      />
    </Field>
  );
}

const EMPTY = { first_name: '', last_name: '', birth_date: '', gender: '', address: '', phone: '', religion: '', dpi: '' };
const ANT = [
  ['ant_medicos', 'Médicos'],
  ['ant_quirurgicos', 'Quirúrgicos'],
  ['ant_traumaticos', 'Traumáticos'],
  ['ant_alergias', 'Alergias'],
  ['ant_familiares', 'Familiares'],
];

/** Formulario para registrar/editar datos generales del paciente */
export function PatientFormModal({ open, onClose, onSaved, patient, initialName = '' }) {
  const { isDoctor } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (patient) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(patient).map(([k, v]) => [k, v ?? ''])) });
    else {
      const words = initialName.trim().split(/\s+/).filter(Boolean);
      const half = Math.ceil(words.length / 2);
      setForm({ ...EMPTY, first_name: words.slice(0, half).join(' '), last_name: words.slice(half).join(' ') });
    }
  }, [open, patient, initialName]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const saved = patient ? await api.put(`/patients/${patient.id}`, form) : await api.post('/patients', form);
      toast.success(patient ? 'Datos actualizados' : 'Paciente registrado');
      onSaved?.(saved);
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      icon={UserPlus}
      title={patient ? 'Editar datos del paciente' : 'Registrar paciente'}
      subtitle="La edad y las iniciales se calculan automáticamente"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {patient ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="form-grid">
        <Input className="c6" label="Nombres" value={form.first_name} onChange={set('first_name')} autoFocus required />
        <Input className="c6" label="Apellidos" value={form.last_name} onChange={set('last_name')} required />
        <Input className="c4" label="Fecha de nacimiento" type="date" value={form.birth_date} onChange={set('birth_date')} />
        <Input className="c4" label="Edad" auto readOnly value={form.birth_date ? ageLabel(form.birth_date) : '—'} />
        <Select
          className="c4"
          label="Género"
          value={form.gender}
          onChange={set('gender')}
          options={[
            { value: '', label: 'Seleccione…' },
            { value: 'F', label: 'Femenino' },
            { value: 'M', label: 'Masculino' },
          ]}
        />
        <Input className="c4" label="Teléfono" value={form.phone} onChange={set('phone')} placeholder="5555-5555" />
        <Input className="c4" label="DPI" value={form.dpi} onChange={set('dpi')} hint="opcional" />
        <Select
          className="c4"
          label="Religión"
          value={form.religion}
          onChange={set('religion')}
          options={['', 'Católica', 'Evangélica', 'Adventista', 'Testigo de Jehová', 'Mormona', 'Otra', 'Ninguna'].map((v) => ({ value: v, label: v || 'Seleccione…' }))}
        />
        <Input className="c12" label="Dirección" value={form.address} onChange={set('address')} />
        {isDoctor && (
          <>
            <div className="c12 row" style={{ marginTop: 6, color: 'var(--blue)', fontWeight: 650 }}>
              <ShieldCheck size={16} /> Antecedentes (solo visibles para la Dra.)
            </div>
            {ANT.map(([k, l]) => (
              <Textarea key={k} className="c6" minRows={1} label={l} value={form[k]} onChange={set(k)} placeholder="Niega" />
            ))}
          </>
        )}
        {!patient && isChild(form.birth_date) && <div className="c12 small muted">Paciente pediátrico: la ficha clínica se abrirá en modo niño automáticamente.</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
