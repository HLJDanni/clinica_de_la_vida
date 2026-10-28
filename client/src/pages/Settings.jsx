import { useEffect, useState } from 'react';
import { Save, Plus, FlaskConical, Building2 } from 'lucide-react';
import { api } from '../api.js';
import { useSettings, useToast } from '../context.jsx';
import { Button, Input, Modal, PageHead } from '../components/ui.jsx';
import { Catalog } from './Labs.jsx';

export default function SettingsPage() {
  const toast = useToast();
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => setForm(settings), [settings]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const s = await api.put('/settings', {
        consult_price: Number(form.consult_price),
        clinic_address: form.clinic_address,
        clinic_phone: form.clinic_phone,
        doctor_name: form.doctor_name,
        doctor_title: form.doctor_title,
        doctor_license: form.doctor_license,
      });
      setSettings(s);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title="Configuración" subtitle="Datos de la clínica, precio de consulta y catálogo de laboratorio" />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <Building2 size={17} color="var(--blue)" />
          <h3>Clínica y membrete de documentos</h3>
          <Button size="sm" icon={Save} loading={saving} onClick={save} style={{ marginLeft: 'auto' }}>
            Guardar
          </Button>
        </div>
        <div className="card-body form-grid">
          <Input className="c4" label="Precio de consulta" type="number" min={0} suffix="GTQ" value={form.consult_price} onChange={set('consult_price')} />
          <Input className="c4" label="Nombre de la doctora" value={form.doctor_name} onChange={set('doctor_name')} />
          <Input className="c4" label="Título" value={form.doctor_title} onChange={set('doctor_title')} />
          <Input className="c4" label="No. de colegiado" value={form.doctor_license} onChange={set('doctor_license')} />
          <Input className="c4" label="Teléfonos" value={form.clinic_phone} onChange={set('clinic_phone')} />
          <Input className="c4" label="Dirección" value={form.clinic_address} onChange={set('clinic_address')} />
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18 }}>Catálogo de exámenes</h2>
        <div className="spacer" />
        <Button icon={Plus} onClick={() => setEditing({ code: '', name: '', category: '', price: '', sample: '', turnaround: '', active: true })}>
          Agregar examen
        </Button>
      </div>
      <Catalog editable onEdit={setEditing} refreshKey={refresh} />
      <ExamModal exam={editing} onClose={() => setEditing(null)} onSaved={() => setRefresh((r) => r + 1)} />
    </>
  );
}

function ExamModal({ exam, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => exam && setForm({ ...exam }), [exam]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, price: Number(form.price), active: !!form.active };
      if (exam.id) await api.put(`/lab-exams/${exam.id}`, body);
      else await api.post('/lab-exams', body);
      toast.success('Examen guardado');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={!!exam}
      onClose={onClose}
      icon={FlaskConical}
      title={exam?.id ? 'Editar examen' : 'Nuevo examen'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Guardar</Button>
        </>
      }
    >
      <div className="form-grid">
        <Input className="c4" label="Código" value={form.code} onChange={set('code')} placeholder="QUI-020" />
        <Input className="c8" label="Nombre" value={form.name} onChange={set('name')} />
        <Input className="c6" label="Categoría" value={form.category} onChange={set('category')} list="exam-cats" />
        <Input className="c6" label="Precio" type="number" min={0} suffix="GTQ" value={form.price} onChange={set('price')} />
        <Input className="c6" label="Muestra" value={form.sample} onChange={set('sample')} />
        <Input className="c6" label="Tiempo de entrega" value={form.turnaround} onChange={set('turnaround')} />
        <label className="check c12">
          <input type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Disponible en el catálogo
        </label>
        <datalist id="exam-cats">
          {['Hematología', 'Química sanguínea', 'Orina y heces', 'Inmunología', 'Hormonas', 'Paquetes'].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </Modal>
  );
}
