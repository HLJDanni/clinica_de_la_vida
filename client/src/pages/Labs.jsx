import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Plus, Search, Stethoscope, BookOpen, ListChecks, FileText } from 'lucide-react';
import { useApi } from '../api.js';
import { useSettings } from '../context.jsx';
import { money, normalizeText } from '../utils.js';
import { Button, Empty, LoadingList, PageHead, Segmented, Tabs } from '../components/ui.jsx';
import { LabOrderCard, LabOrderModal } from '../components/LabWidgets.jsx';

export default function Labs() {
  const [tab, setTab] = useState('ordenes');
  const navigate = useNavigate();
  return (
    <>
      <PageHead title="Laboratorio" subtitle="Órdenes, cobros, resultados y catálogo de exámenes con precios">
        <Button variant="secondary" icon={FileText} onClick={() => navigate('/cotizaciones')}>
          Cotizar
        </Button>
      </PageHead>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'ordenes', label: 'Órdenes', icon: ListChecks },
          { value: 'catalogo', label: 'Catálogo y precios', icon: BookOpen },
        ]}
      />
      {tab === 'ordenes' ? <Orders /> : <Catalog />}
    </>
  );
}

const FILTERS = {
  por_cobrar: (o) => o.payment_status === 'pendiente' && o.status !== 'cancelado',
  en_proceso: (o) => ['solicitado', 'en_proceso'].includes(o.status),
  listos: (o) => o.status === 'completado',
  todas: () => true,
};

function Orders() {
  const { data, loading, reload } = useApi('/lab-orders');
  const [filter, setFilter] = useState('por_cobrar');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const all = data || [];
  const list = all.filter(FILTERS[filter]).filter((o) => !q || normalizeText(`${o.first_name} ${o.last_name} ${o.initials} ${o.id}`).includes(normalizeText(q)));
  const count = (f) => all.filter(FILTERS[f]).length;

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'por_cobrar', label: 'Por cobrar', count: count('por_cobrar') },
            { value: 'en_proceso', label: 'En proceso', count: count('en_proceso') },
            { value: 'listos', label: 'Listos', count: count('listos') },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} />
          <input className="input" placeholder="Buscar paciente o # de orden" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Nueva orden
        </Button>
      </div>
      {loading && !data ? (
        <LoadingList />
      ) : list.length ? (
        <div style={{ marginTop: -1 }}>
          {list.map((o) => (
            <LabOrderCard key={o.id} order={o} onChange={reload} />
          ))}
        </div>
      ) : (
        <Empty icon={FlaskConical} title="No hay órdenes en esta vista" text="Las órdenes creadas en consulta o en recepción aparecerán aquí." />
      )}
      <LabOrderModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </div>
  );
}

export function Catalog({ editable, onEdit, refreshKey }) {
  const { data, loading } = useApi(editable ? '/lab-exams?all=1' : '/lab-exams', [refreshKey]);
  const { settings } = useSettings();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const n = normalizeText(q);
    return (data || [])
      .filter((e) => !n || normalizeText(`${e.name} ${e.code} ${e.category}`).includes(n))
      .reduce((acc, e) => {
        (acc[e.category] ||= []).push(e);
        return acc;
      }, {});
  }, [data, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card card-pad row" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
        <div className="stat-icon" style={{ background: 'var(--blue)', color: '#fff' }}>
          <Stethoscope size={19} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="strong">Consulta médica con {settings.doctor_name || 'la Dra. Delia'}</div>
          <div className="small muted">Precio vigente de la consulta</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{money(settings.consult_price)}</div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="input-wrap" style={{ flex: 1 }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar examen, código o categoría…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="sub">{data?.length || 0} exámenes</span>
        </div>
        {loading && !data ? (
          <LoadingList />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Examen</th>
                <th>Muestra</th>
                <th>Entrega</th>
                <th className="num">Precio</th>
                {editable && <th />}
              </tr>
            </thead>
            {Object.entries(groups).map(([cat, list]) => (
              <tbody key={cat}>
                <tr>
                  <td colSpan={editable ? 6 : 5} className="exam-cat" style={{ position: 'static' }}>
                    {cat}
                  </td>
                </tr>
                {list.map((e) => (
                  <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                    <td className="mono small muted">{e.code}</td>
                    <td className="strong">{e.name}</td>
                    <td className="small">{e.sample}</td>
                    <td className="small">{e.turnaround}</td>
                    <td className="num strong">{money(e.price)}</td>
                    {editable && (
                      <td className="num">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(e)}>
                          Editar
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </div>
    </div>
  );
}
