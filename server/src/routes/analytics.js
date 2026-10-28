// Estadísticas de la clínica. Lo clínico (motivos, diagnósticos, medicamentos) solo para la Dra.
import { Router } from 'express';
import { q } from '../db.js';
import { normalize } from '../utils.js';

const r = Router();
const GT = (col) => `(${col} AT TIME ZONE 'America/Guatemala')`;
const RANGES = { 30: 30, 90: 90, 365: 365, 0: 0 };

/* ---------- Agrupación de texto libre en categorías ---------- */
const MOTIVOS = [
  ['Control prenatal', /prenatal|embaraz|gestac/],
  ['Presión arterial', /presion|hipertens|\bhta\b/],
  ['Diabetes / glucosa', /diabet|glucos|\bdm2?\b/],
  ['Dolor abdominal / gástrico', /abdom|epigastr|gastri|estomag/],
  ['Dolor de cabeza', /cefalea|migra|cabeza/],
  ['Síntomas respiratorios', /\btos\b|respira|gripe|resfr|asma|sibil/],
  ['Fiebre / garganta', /fiebre|garganta|infecc/],
  ['Dolor articular o muscular', /rodilla|articul|espalda|lumb|muscul/],
  ['Cansancio / tiroides', /cansancio|fatiga|tiroid/],
  ['Control y resultados', /control|seguimiento|resultado|revision|chequeo/],
];
const DIAGNOSTICOS = [
  ['Hipertensión arterial', /hipertens|\bhta\b/],
  ['Diabetes mellitus', /diabet|\bdm2?\b/],
  ['Gastritis / H. pylori', /gastritis|pylori/],
  ['Embarazo', /embarazo/],
  ['Asma', /asma/],
  ['Migraña', /migra/],
  ['Hipotiroidismo', /hipotiroid/],
  ['Osteoartritis', /osteoartr|artrosis/],
  ['Faringoamigdalitis', /faring|amigdal/],
  ['Dislipidemia', /dislipid|colesterol/],
  ['Infección urinaria', /urinari|\bivu\b/],
  ['Parasitosis', /parasit|amebi/],
  ['Anemia', /anemia/],
  ['Sobrepeso / obesidad', /sobrepeso|obesidad/],
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Cuenta cada categoría una vez por documento; lo no reconocido se agrupa por su primera frase. */
function classify(texts, rules, { multi = false, fallback = 'Otros' } = {}) {
  const counts = new Map();
  for (const raw of texts) {
    if (!raw) continue;
    const n = normalize(raw);
    const hits = rules.filter(([, re]) => re.test(n)).map(([label]) => label);
    const labels = hits.length ? (multi ? hits : hits.slice(0, 1)) : [fallback === 'first' ? capitalize(raw.split(/[.,;—]/)[0].trim().slice(0, 40)) : fallback];
    for (const l of new Set(labels)) counts.set(l, (counts.get(l) || 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

r.get('/analytics', async (req, res) => {
  const days = RANGES[req.query.days] ?? 30;
  const doctor = req.user.role === 'doctor';
  // Periodo actual y anterior (para comparar), en hora de Guatemala
  const from = days ? `now() - interval '${days} days'` : `'-infinity'::timestamptz`;
  const prevFrom = days ? `now() - interval '${days * 2} days'` : `'-infinity'::timestamptz`;
  const bucket = days && days <= 31 ? 'day' : days && days <= 90 ? 'week' : 'month';
  const inRange = (col) => `${col} >= ${from}`;
  const inPrev = (col) => `${col} >= ${prevFrom} AND ${col} < ${from}`;

  const [kpi, income, labs, labOps, methods, apptStatus, weekday, ages, quotes] = await Promise.all([
    q(`SELECT
         (SELECT coalesce(sum(amount),0) FROM payments WHERE ${inRange('created_at')}) AS income,
         (SELECT coalesce(sum(amount),0) FROM payments WHERE ${inPrev('created_at')}) AS income_prev,
         (SELECT count(*)::int FROM payments WHERE ${inRange('created_at')}) AS payments,
         (SELECT (SELECT count(*) FROM clinical_records WHERE ${inRange('created_at')}) + (SELECT count(*) FROM follow_ups WHERE ${inRange('created_at')}))::int AS consults,
         (SELECT (SELECT count(*) FROM clinical_records WHERE ${inPrev('created_at')}) + (SELECT count(*) FROM follow_ups WHERE ${inPrev('created_at')}))::int AS consults_prev,
         (SELECT count(*)::int FROM patients WHERE ${inRange('created_at')}) AS new_patients,
         (SELECT count(*)::int FROM patients WHERE ${inPrev('created_at')}) AS new_patients_prev,
         (SELECT count(*)::int FROM lab_orders WHERE status <> 'cancelado' AND ${inRange('created_at')}) AS lab_orders,
         (SELECT count(*)::int FROM lab_orders WHERE status <> 'cancelado' AND ${inPrev('created_at')}) AS lab_orders_prev`),
    q(`WITH b AS (
         SELECT generate_series(date_trunc('${bucket}', ${days ? `${GT('now()')} - interval '${days} days'` : `coalesce((SELECT min(${GT('created_at')}) FROM payments), ${GT('now()')})`}),
                                date_trunc('${bucket}', ${GT('now()')}), interval '1 ${bucket}') AS t)
       SELECT to_char(b.t, 'YYYY-MM-DD') AS bucket,
         coalesce(sum(p.amount) FILTER (WHERE p.concept = 'consulta'), 0) AS consulta,
         coalesce(sum(p.amount) FILTER (WHERE p.concept = 'laboratorio'), 0) AS laboratorio,
         coalesce(sum(p.amount) FILTER (WHERE p.concept = 'otro'), 0) AS otro
       FROM b LEFT JOIN payments p ON date_trunc('${bucket}', ${GT('p.created_at')}) = b.t
       GROUP BY b.t ORDER BY b.t`),
    q(`SELECT i.exam_name AS label, count(*)::int AS count, sum(i.price) AS amount
       FROM lab_order_items i JOIN lab_orders o ON o.id = i.order_id
       WHERE o.status <> 'cancelado' AND ${inRange('o.created_at')}
       GROUP BY i.exam_name ORDER BY count DESC, amount DESC LIMIT 8`),
    q(`SELECT
         count(*) FILTER (WHERE origin = 'recepcion')::int AS directo,
         count(*) FILTER (WHERE origin = 'consulta')::int AS consulta,
         round(avg(extract(epoch FROM completed_at - created_at) / 3600) FILTER (WHERE status = 'completado')::numeric, 1) AS avg_hours,
         (SELECT coalesce(sum(total),0) FROM lab_orders WHERE payment_status = 'pendiente' AND status <> 'cancelado') AS unpaid_amount,
         (SELECT count(*)::int FROM lab_orders WHERE payment_status = 'pendiente' AND status <> 'cancelado') AS unpaid_count
       FROM lab_orders WHERE status <> 'cancelado' AND ${inRange('created_at')}`),
    q(`SELECT method AS label, sum(amount) AS amount, count(*)::int AS count FROM payments WHERE ${inRange('created_at')} GROUP BY method`),
    q(`SELECT status AS label, count(*)::int AS count FROM appointments WHERE ${inRange('scheduled_at')} AND scheduled_at < now() GROUP BY status`),
    q(`SELECT extract(isodow FROM ${GT('scheduled_at')})::int AS dow, count(*)::int AS count
       FROM appointments WHERE status <> 'cancelada' AND ${inRange('scheduled_at')} GROUP BY 1`),
    q(`SELECT
         count(*) FILTER (WHERE age < 5)::int AS "0–4",
         count(*) FILTER (WHERE age BETWEEN 5 AND 14)::int AS "5–14",
         count(*) FILTER (WHERE age BETWEEN 15 AND 29)::int AS "15–29",
         count(*) FILTER (WHERE age BETWEEN 30 AND 44)::int AS "30–44",
         count(*) FILTER (WHERE age BETWEEN 45 AND 59)::int AS "45–59",
         count(*) FILTER (WHERE age >= 60)::int AS "60+",
         count(*) FILTER (WHERE gender = 'F')::int AS female,
         count(*) FILTER (WHERE gender = 'M')::int AS male
       FROM (SELECT extract(year FROM age(birth_date))::int AS age, gender FROM patients WHERE birth_date IS NOT NULL) x`),
    q(`SELECT count(*)::int AS total, count(converted_order_id)::int AS converted, coalesce(sum(total),0) AS amount
       FROM quotes WHERE ${inRange('created_at')}`),
  ]);

  const k = kpi.rows[0];
  const appts = Object.fromEntries(apptStatus.rows.map((x) => [x.label, x.count]));
  const attended = (appts.completada || 0) + (appts.no_asistio || 0);
  const ageRow = ages.rows[0];

  const result = {
    days,
    bucket,
    kpis: {
      income: k.income,
      income_prev: k.income_prev,
      avg_ticket: k.payments ? k.income / k.payments : 0,
      consults: k.consults,
      consults_prev: k.consults_prev,
      new_patients: k.new_patients,
      new_patients_prev: k.new_patients_prev,
      lab_orders: k.lab_orders,
      lab_orders_prev: k.lab_orders_prev,
      no_show_rate: attended ? (appts.no_asistio || 0) / attended : null,
    },
    income: income.rows,
    top_labs: labs.rows,
    lab: labOps.rows[0],
    pay_methods: methods.rows,
    appointments: { ...appts, by_weekday: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dow: d, count: weekday.rows.find((x) => x.dow === d)?.count || 0 })) },
    ages: ['0–4', '5–14', '15–29', '30–44', '45–59', '60+'].map((label) => ({ label, count: ageRow[label] })),
    gender: { F: ageRow.female, M: ageRow.male },
    quotes: quotes.rows[0],
  };

  if (doctor) {
    const [mot, dx, types, meds] = await Promise.all([
      q(`SELECT motivo_consulta AS t FROM clinical_records WHERE ${inRange('created_at')}
         UNION ALL SELECT motivo FROM follow_ups WHERE ${inRange('created_at')}`),
      q(`SELECT diagnostico AS t FROM clinical_records WHERE ${inRange('created_at')}
         UNION ALL SELECT diagnostico FROM follow_ups WHERE ${inRange('created_at')}`),
      q(`SELECT patient_type AS label, count(*)::int AS count FROM (
           SELECT patient_type FROM clinical_records WHERE ${inRange('created_at')}
           UNION ALL SELECT patient_type FROM follow_ups WHERE ${inRange('created_at')}) x GROUP BY 1`),
      q(`SELECT initcap(lower(trim(item->>'medicamento'))) AS label, count(*)::int AS count
         FROM prescriptions, jsonb_array_elements(items) item
         WHERE ${inRange('created_at')} AND coalesce(trim(item->>'medicamento'), '') <> ''
         GROUP BY 1 ORDER BY count DESC, label LIMIT 8`),
    ]);
    result.motivos = classify(mot.rows.map((x) => x.t), MOTIVOS).slice(0, 8);
    result.diagnosticos = classify(dx.rows.map((x) => x.t), DIAGNOSTICOS, { multi: true, fallback: 'first' }).slice(0, 8);
    result.patient_types = types.rows;
    result.medicamentos = meds.rows;
  }

  res.json(result);
});

export default r;
