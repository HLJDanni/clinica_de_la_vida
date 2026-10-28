import { motion, AnimatePresence } from 'framer-motion';
import { Baby, User, HeartPulse } from 'lucide-react';
import { Input, Segmented, Textarea } from './ui.jsx';
import { addDays, gtDateKey, fmtDate } from '../utils.js';

/* ---------- Definición de campos ---------- */
export const VITALS = [
  { k: 'pa', label: 'Presión arterial', suffix: 'mmHg', placeholder: '120/80' },
  { k: 'fc', label: 'Frec. cardiaca', suffix: 'lpm' },
  { k: 'fr', label: 'Frec. respiratoria', suffix: 'rpm' },
  { k: 'temp', label: 'Temperatura', suffix: '°C' },
  { k: 'spo2', label: 'Saturación O₂', suffix: '%' },
  { k: 'peso', label: 'Peso', suffix: 'kg' },
  { k: 'talla', label: 'Talla', suffix: 'cm' },
  { k: 'glucometria', label: 'Glucometría', suffix: 'mg/dL' },
];
export const SYSTEMS = [
  { k: 'estado_general', label: '¿Cuál es el estado general del paciente?' },
  { k: 'piel', label: 'Piel y faneras' },
  { k: 'cabeza_cuello', label: 'Cabeza y cuello' },
  { k: 'torax_pulmones', label: 'Tórax y pulmones' },
  { k: 'corazon', label: 'Corazón' },
  { k: 'abdomen', label: 'Abdomen' },
  { k: 'genitourinario', label: 'Genitourinario' },
  { k: 'extremidades', label: 'Extremidades' },
  { k: 'neurologico', label: 'Neurológico' },
];
export const PEDIATRIC = [
  { k: 'perimetro_cefalico', label: 'Perímetro cefálico', suffix: 'cm', short: true },
  { k: 'desarrollo', label: '¿El desarrollo psicomotor es acorde a la edad?' },
  { k: 'vacunas', label: '¿Esquema de vacunación completo?' },
  { k: 'alimentacion', label: '¿Cómo es su alimentación?' },
];
export const PREGNANCY = [
  { k: 'fur', label: 'Fecha de última regla (FUR)', type: 'date', short: true },
  { k: 'gestas', label: 'Gestas', short: true },
  { k: 'partos', label: 'Partos', short: true },
  { k: 'cesareas', label: 'Cesáreas', short: true },
  { k: 'abortos', label: 'Abortos', short: true },
  { k: 'altura_uterina', label: 'Altura uterina', suffix: 'cm', short: true },
  { k: 'fcf', label: 'Frec. cardiaca fetal', suffix: 'lpm', short: true },
  { k: 'movimientos_fetales', label: '¿Percibe movimientos fetales?', short: true },
  { k: 'presentacion', label: 'Presentación', short: true },
  { k: 'edema', label: 'Edema', short: true },
];

/* ---------- Cálculos automáticos ---------- */
export function computeImc(exam) {
  const peso = parseFloat(exam.peso);
  const talla = parseFloat(exam.talla) / 100;
  if (!peso || !talla) return null;
  const imc = peso / (talla * talla);
  const cls = imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Normal' : imc < 30 ? 'Sobrepeso' : 'Obesidad';
  return { value: imc.toFixed(1), cls };
}
export function computePregnancy(exam) {
  if (!exam.fur || !/^\d{4}-\d{2}-\d{2}$/.test(exam.fur)) return null;
  const days = Math.floor((new Date(`${gtDateKey()}T12:00:00Z`) - new Date(`${exam.fur}T12:00:00Z`)) / 86400000);
  if (days < 0 || days > 320) return null;
  return { eg: `${Math.floor(days / 7)} semanas ${days % 7} días`, fpp: addDays(exam.fur, 280) };
}

/** Texto plano del examen físico (para referencias y documentos) */
export function examToText(exam = {}, type = 'adulto') {
  const lines = [];
  const vit = VITALS.filter((v) => exam[v.k]).map((v) => `${v.label}: ${exam[v.k]} ${v.suffix}`);
  const imc = computeImc(exam);
  if (imc) vit.push(`IMC: ${imc.value} (${imc.cls})`);
  if (vit.length) lines.push(vit.join(' · '));
  if (type === 'embarazada') {
    const p = computePregnancy(exam);
    const obs = PREGNANCY.filter((f) => exam[f.k]).map((f) => `${f.label}: ${f.k === 'fur' ? fmtDate(exam[f.k]) : exam[f.k]}${f.suffix ? ` ${f.suffix}` : ''}`);
    if (p) obs.push(`Edad gestacional: ${p.eg}`, `FPP: ${fmtDate(p.fpp)}`);
    if (obs.length) lines.push(`Obstétrico — ${obs.join(' · ')}`);
  }
  if (type === 'pediatrico') {
    PEDIATRIC.filter((f) => exam[f.k]).forEach((f) => lines.push(`${f.label.replace(/[¿?]/g, '')}: ${exam[f.k]}${f.suffix ? ` ${f.suffix}` : ''}`));
  }
  SYSTEMS.filter((s) => exam[s.k]).forEach((s) => lines.push(`${s.label.replace(/[¿?]/g, '')}: ${exam[s.k]}`));
  return lines.join('\n');
}

/* ---------- Selector Adulto / Niño + Embarazada ---------- */
export function PatientTypeSelector({ value, onChange, gender }) {
  const base = value === 'pediatrico' ? 'pediatrico' : 'adulto';
  const pregnant = value === 'embarazada';
  const canPregnant = gender !== 'M' && base === 'adulto';
  return (
    <div className="row" style={{ gap: 10 }}>
      <Segmented
        value={base}
        onChange={(v) => onChange(v)}
        options={[
          { value: 'adulto', label: 'Adulto', icon: User },
          { value: 'pediatrico', label: 'Niño', icon: Baby },
        ]}
      />
      <button
        type="button"
        className={`toggle-chip ${pregnant ? 'on' : ''}`}
        disabled={!canPregnant}
        title={canPregnant ? '' : 'Disponible solo para pacientes adultas'}
        onClick={() => onChange(pregnant ? 'adulto' : 'embarazada')}
      >
        <HeartPulse size={16} />
        Embarazada
      </button>
    </div>
  );
}

/* ---------- Formulario de examen físico ---------- */
export function ExamForm({ type, value = {}, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const imc = computeImc(value);
  const preg = computePregnancy(value);
  const fade = { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="vitals">
        {VITALS.map((v) => (
          <Input key={v.k} label={v.label} suffix={v.suffix} placeholder={v.placeholder} value={value[v.k]} onChange={set(v.k)} />
        ))}
        <Input label="IMC" auto readOnly value={imc ? `${imc.value} · ${imc.cls}` : '—'} />
      </div>

      <AnimatePresence initial={false}>
        {type === 'embarazada' && (
          <motion.div key="preg" {...fade} style={{ overflow: 'hidden' }}>
            <div className="card" style={{ padding: 16, background: 'var(--pink-50)', borderColor: '#f6cadb', boxShadow: 'none' }}>
              <div className="row" style={{ marginBottom: 12, color: 'var(--pink)', fontWeight: 650 }}>
                <HeartPulse size={17} /> Control obstétrico
              </div>
              <div className="vitals">
                {PREGNANCY.map((f) => (
                  <Input key={f.k} label={f.label} type={f.type} suffix={f.suffix} value={value[f.k]} onChange={set(f.k)} />
                ))}
                <Input label="Edad gestacional" auto readOnly value={preg?.eg || '—'} />
                <Input label="Fecha probable de parto" auto readOnly value={preg ? fmtDate(preg.fpp) : '—'} />
              </div>
            </div>
          </motion.div>
        )}
        {type === 'pediatrico' && (
          <motion.div key="ped" {...fade} style={{ overflow: 'hidden' }}>
            <div className="card" style={{ padding: 16, background: 'var(--green-50)', borderColor: '#c7ead9', boxShadow: 'none' }}>
              <div className="row" style={{ marginBottom: 12, color: 'var(--green)', fontWeight: 650 }}>
                <Baby size={17} /> Evaluación pediátrica
              </div>
              <div className="form-grid">
                {PEDIATRIC.map((f) =>
                  f.short ? (
                    <Input key={f.k} className="c4" label={f.label} suffix={f.suffix} value={value[f.k]} onChange={set(f.k)} />
                  ) : (
                    <Textarea key={f.k} className="c12" minRows={1} label={f.label} value={value[f.k]} onChange={set(f.k)} />
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="form-grid">
        {SYSTEMS.map((s) => (
          <Textarea key={s.k} className="c6" minRows={1} label={s.label} value={value[s.k]} onChange={set(s.k)} placeholder="Sin hallazgos" />
        ))}
      </div>
    </div>
  );
}
