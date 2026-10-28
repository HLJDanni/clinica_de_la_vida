import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Stethoscope, UserPlus, FlaskConical, Receipt, CalendarX, TrendingUp, TrendingDown, Minus, Pill, ClipboardList, Activity, Users, CalendarDays, FileText, Clock,
} from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../context.jsx';
import { money, PAY_METHODS, PATIENT_TYPES } from '../utils.js';
import { Empty, LoadingList, PageHead, Segmented, listItem } from '../components/ui.jsx';

const RANGES = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '12 meses' },
  { value: '0', label: 'Todo' },
];
const pct = (n) => `${Math.round(n * 100)}%`;
/** Techo "redondo" para el eje (1, 2, 2.5, 5 × 10ⁿ) */
const niceCeil = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v);
};
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ---------- Tooltip compartido ---------- */
function useTooltip() {
  const [tip, setTip] = useState(null);
  const bind = (content) => ({
    onMouseMove: (e) => setTip({ x: e.clientX, y: e.clientY, content }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip && (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
  return [bind, node];
}

/* ---------- Indicador con comparación contra el periodo anterior ---------- */
function Kpi({ icon: Icon, tone, label, value, current, prev, hint, inverse, i }) {
  let delta = null;
  if (prev !== undefined && prev !== null) {
    if (!prev) delta = { text: 'Sin periodo anterior', dir: 0 };
    else {
      const d = (current - prev) / prev;
      delta = { text: `${d > 0 ? '+' : ''}${Math.round(d * 100)}% vs. periodo anterior`, dir: Math.sign(Math.round(d * 100)) };
    }
  }
  const good = delta && (inverse ? delta.dir < 0 : delta.dir > 0);
  const bad = delta && (inverse ? delta.dir > 0 : delta.dir < 0);
  const DIcon = delta?.dir > 0 ? TrendingUp : delta?.dir < 0 ? TrendingDown : Minus;
  return (
    <motion.div className="card stat" {...listItem(i)}>
      <div className={`stat-icon ${tone}`}>
        <Icon size={19} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {delta && (
          <div className={`kpi-delta ${good ? 'up' : bad ? 'down' : ''}`}>
            <DIcon size={13} /> {delta.text}
          </div>
        )}
        {hint && <div className="kpi-delta">{hint}</div>}
      </div>
    </motion.div>
  );
}

function Panel({ icon: Icon, title, sub, children, className }) {
  return (
    <div className={`card ${className || ''}`}>
      <div className="card-head">
        <Icon size={17} color="var(--blue)" />
        <h3>{title}</h3>
        {sub && <span className="sub" style={{ marginLeft: 'auto' }}>{sub}</span>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

/* ---------- Barras horizontales (un solo tono: magnitud) ---------- */
function HBars({ data, format = (v) => v, extra, empty = 'Sin datos en este periodo' }) {
  const [bind, tip] = useTooltip();
  if (!data?.length) return <div className="empty small">{empty}</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="hbars">
      {data.map((d) => (
        <div key={d.label} className="hbar-row" {...bind(<><b>{d.label}</b><br />{format(d.count)}{extra ? ` · ${extra(d)}` : ''}</>)}>
          <div className="hbar-label" title={d.label}>{d.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="hbar-value">{format(d.count)}</div>
        </div>
      ))}
      {tip}
    </div>
  );
}

/* ---------- Columnas (un solo tono) ---------- */
function Columns({ data, height = 140 }) {
  const [bind, tip] = useTooltip();
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="cols" style={{ height: height + 22 }}>
      {data.map((d) => (
        <div key={d.label} className="col" {...bind(<><b>{d.label}</b><br />{d.count}</>)}>
          <div className="col-plot" style={{ height }}>
            {d.count > 0 && <span className="col-value">{d.count}</span>}
            <div className="col-fill" style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="col-label">{d.label}</div>
        </div>
      ))}
      {tip}
    </div>
  );
}

/* ---------- Barra 100% apilada con leyenda (identidad: 2–3 grupos) ---------- */
function ShareBar({ parts, format = (v) => v }) {
  const [bind, tip] = useTooltip();
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="empty small">Sin datos en este periodo</div>;
  return (
    <div>
      <div className="share-bar">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} className="share-seg" style={{ flexGrow: p.value, background: `var(--viz-${p.slot})` }} {...bind(<><b>{p.label}</b><br />{format(p.value)} · {pct(p.value / total)}</>)} />
        ))}
      </div>
      <div className="viz-legend">
        {parts.map((p) => (
          <div key={p.label} className="legend-item">
            <span className="legend-swatch" style={{ background: `var(--viz-${p.slot})` }} />
            <span>{p.label}</span>
            <b>{format(p.value)}</b>
            <span className="muted">{pct(p.value / total)}</span>
          </div>
        ))}
      </div>
      {tip}
    </div>
  );
}

/* ---------- Ingresos en el tiempo: columnas apiladas consulta / laboratorio ---------- */
function IncomeChart({ rows, bucket }) {
  const [bind, tip] = useTooltip();
  const series = [
    { key: 'consulta', label: 'Consultas', slot: 1 },
    { key: 'laboratorio', label: 'Laboratorio', slot: 2 },
    { key: 'otro', label: 'Otros cobros', slot: 3 },
  ].filter((s) => rows.some((r) => r[s.key] > 0));
  const totals = rows.map((r) => series.reduce((s, x) => s + r[x.key], 0));
  const max = niceCeil(Math.max(...totals, 1));
  const H = 180;
  const label = (b) => {
    const [y, m, d] = b.split('-').map(Number);
    return bucket === 'month' ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : `${d} ${MONTHS[m - 1]}`;
  };
  const every = Math.ceil(rows.length / 8);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  if (!series.length) return <div className="empty small">Sin cobros en este periodo</div>;
  return (
    <div>
      <div className="viz-legend" style={{ marginTop: 0, marginBottom: 14 }}>
        {series.map((s) => (
          <div key={s.key} className="legend-item">
            <span className="legend-swatch" style={{ background: `var(--viz-${s.slot})` }} />
            <span>{s.label}</span>
            <b>{money(rows.reduce((t, r) => t + r[s.key], 0))}</b>
          </div>
        ))}
      </div>
      <div className="income">
        <div className="income-axis" style={{ height: H }}>
          {ticks.slice().reverse().map((t) => (
            <span key={t}>{t >= 1000 ? `Q${(t / 1000).toFixed(1)}k` : `Q${Math.round(t)}`}</span>
          ))}
        </div>
        <div className="income-plot">
          <div className="income-grid" style={{ height: H }}>
            <i /><i /><i />
          </div>
          <div className="income-cols" style={{ height: H + 20 }}>
            {rows.map((r, i) => (
              <div
                key={r.bucket}
                className="income-col"
                {...bind(
                  <>
                    <b>{label(r.bucket)}</b>
                    {series.map((s) => (
                      <div key={s.key} className="tip-row">
                        <span className="legend-swatch" style={{ background: `var(--viz-${s.slot})` }} /> {s.label}: {money(r[s.key])}
                      </div>
                    ))}
                    <div className="tip-row"><b>Total: {money(totals[i])}</b></div>
                  </>
                )}
              >
                <div className="income-stack" style={{ height: H }}>
                  {series.map((s) =>
                    r[s.key] > 0 ? <div key={s.key} style={{ height: `${(r[s.key] / max) * 100}%`, background: `var(--viz-${s.slot})` }} /> : null
                  )}
                </div>
                <div className="col-label">{i % every === 0 ? label(r.bucket) : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {tip}
    </div>
  );
}

function Meter({ value, label }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="small muted">{label}</span>
        <b>{pct(value)}</b>
      </div>
      <div className="hbar-track" style={{ height: 10 }}>
        <div className="hbar-fill" style={{ width: pct(value), minWidth: 0 }} />
      </div>
    </div>
  );
}

const MiniStat = ({ icon: Icon, label, value }) => (
  <div className="mini-stat">
    <Icon size={16} color="var(--text-3)" />
    <div>
      <div className="small muted">{label}</div>
      <div className="strong">{value}</div>
    </div>
  </div>
);

export default function Analytics() {
  const { isDoctor } = useAuth();
  const [days, setDays] = useState('30');
  const { data, loading } = useApi(`/analytics?days=${days}`);
  const k = data?.kpis;
  const showPrev = days !== '0';

  return (
    <>
      <PageHead title="Estadísticas" subtitle="Indicadores para tomar decisiones sobre la atención, el laboratorio y los ingresos">
        <Segmented value={days} onChange={setDays} options={RANGES} />
      </PageHead>

      {loading && !data ? (
        <div className="card"><LoadingList rows={6} /></div>
      ) : !data ? (
        <Empty icon={Activity} title="No se pudieron cargar las estadísticas" />
      ) : (
        <motion.div key={days} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          <div className="grid kpi-grid" style={{ marginBottom: 20 }}>
            <Kpi i={0} icon={Wallet} tone="tone-green" label="Ingresos" value={money(k.income)} current={k.income} prev={showPrev ? k.income_prev : undefined} />
            <Kpi i={1} icon={Stethoscope} tone="tone-blue" label="Consultas atendidas" value={k.consults} current={k.consults} prev={showPrev ? k.consults_prev : undefined} />
            <Kpi i={2} icon={UserPlus} tone="tone-purple" label="Pacientes nuevos" value={k.new_patients} current={k.new_patients} prev={showPrev ? k.new_patients_prev : undefined} />
            <Kpi i={3} icon={FlaskConical} tone="tone-amber" label="Órdenes de laboratorio" value={k.lab_orders} current={k.lab_orders} prev={showPrev ? k.lab_orders_prev : undefined} />
            <Kpi i={4} icon={Receipt} tone="tone-blue" label="Ticket promedio por cobro" value={money(k.avg_ticket)} />
            <Kpi i={5} icon={CalendarX} tone="tone-red" label="Inasistencia a citas" value={k.no_show_rate === null ? '—' : pct(k.no_show_rate)} hint="Citas pasadas sin asistir" />
          </div>

          <Panel icon={TrendingUp} title="Ingresos en el tiempo" sub={`Por ${data.bucket === 'day' ? 'día' : data.bucket === 'week' ? 'semana' : 'mes'}`} className="viz-block">
            <IncomeChart rows={data.income} bucket={data.bucket} />
          </Panel>

          {isDoctor && (
            <div className="grid g2 viz-block">
              <Panel icon={ClipboardList} title="Motivos de consulta más comunes" sub="Fichas y seguimientos">
                <HBars data={data.motivos} format={(v) => `${v} visita${v === 1 ? '' : 's'}`} />
              </Panel>
              <Panel icon={Activity} title="Diagnósticos más frecuentes">
                <HBars data={data.diagnosticos} format={(v) => `${v} caso${v === 1 ? '' : 's'}`} />
              </Panel>
              <Panel icon={Pill} title="Medicamentos más recetados">
                <HBars data={data.medicamentos} format={(v) => `${v} receta${v === 1 ? '' : 's'}`} empty="Sin recetas en este periodo" />
              </Panel>
              <Panel icon={Users} title="Tipo de paciente atendido">
                <ShareBar
                  parts={['adulto', 'pediatrico', 'embarazada'].map((t, i) => ({
                    label: PATIENT_TYPES[t].label,
                    value: data.patient_types.find((x) => x.label === t)?.count || 0,
                    slot: i + 1,
                  }))}
                  format={(v) => `${v} consulta${v === 1 ? '' : 's'}`}
                />
              </Panel>
            </div>
          )}

          <div className="grid g2 viz-block">
            <Panel icon={FlaskConical} title="Laboratorios más solicitados">
              <HBars data={data.top_labs} format={(v) => `${v} solicitud${v === 1 ? '' : 'es'}`} extra={(d) => money(d.amount)} empty="Sin órdenes en este periodo" />
            </Panel>
            <Panel icon={Clock} title="Operación del laboratorio">
              <ShareBar
                parts={[
                  { label: 'Desde consulta', value: data.lab.consulta, slot: 1 },
                  { label: 'Directo en recepción', value: data.lab.directo, slot: 2 },
                ]}
                format={(v) => `${v} orden${v === 1 ? '' : 'es'}`}
              />
              <div className="mini-stats">
                <MiniStat icon={Clock} label="Entrega promedio de resultados" value={data.lab.avg_hours ? `${data.lab.avg_hours} h` : '—'} />
                <MiniStat icon={Wallet} label="Pendiente de cobro (hoy)" value={`${money(data.lab.unpaid_amount)} · ${data.lab.unpaid_count} órdenes`} />
              </div>
            </Panel>
          </div>

          <div className="grid g2 viz-block">
            <Panel icon={CalendarDays} title="Citas por día de la semana" sub="Para planificar horarios">
              <Columns data={data.appointments.by_weekday.map((d) => ({ label: WEEKDAYS[d.dow - 1], count: d.count }))} />
              <div className="mini-stats">
                <MiniStat icon={Stethoscope} label="Atendidas" value={data.appointments.completada || 0} />
                <MiniStat icon={CalendarX} label="No asistieron" value={data.appointments.no_asistio || 0} />
                <MiniStat icon={CalendarX} label="Canceladas" value={data.appointments.cancelada || 0} />
              </div>
            </Panel>
            <Panel icon={Users} title="Pacientes por edad" sub={`${data.gender.F} mujeres · ${data.gender.M} hombres`}>
              <Columns data={data.ages} />
            </Panel>
          </div>

          <div className="grid g2 viz-block">
            <Panel icon={Wallet} title="Formas de pago">
              <ShareBar
                parts={['efectivo', 'tarjeta', 'transferencia'].map((m, i) => ({ label: PAY_METHODS[m], value: data.pay_methods.find((x) => x.label === m)?.amount || 0, slot: i + 1 }))}
                format={money}
              />
            </Panel>
            <Panel icon={FileText} title="Cotizaciones" sub={`${data.quotes.total} emitidas · ${money(data.quotes.amount)}`}>
              {data.quotes.total ? (
                <>
                  <Meter value={data.quotes.converted / data.quotes.total} label="Convertidas en orden de laboratorio" />
                  <p className="small muted" style={{ marginBottom: 0 }}>
                    {data.quotes.converted} de {data.quotes.total} cotizaciones se convirtieron en orden. Dar seguimiento a las pendientes ayuda a concretar más exámenes.
                  </p>
                </>
              ) : (
                <div className="empty small">Sin cotizaciones en este periodo</div>
              )}
            </Panel>
          </div>
        </motion.div>
      )}
    </>
  );
}
