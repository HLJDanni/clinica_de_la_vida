export const TZ = 'America/Guatemala';

const moneyFmt = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 });
export const money = (n) => moneyFmt.format(Number(n || 0));

const dtf = (opts) => new Intl.DateTimeFormat('es-GT', { timeZone: TZ, ...opts });
const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00-06:00`) : new Date(d));

export const fmtDate = (d) => (d ? dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(d)) : '—');
export const fmtDateLong = (d) => (d ? dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(d)) : '—');
export const fmtTime = (d) => (d ? dtf({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d)) : '');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)} · ${fmtTime(d)}` : '—');
export const fmtWeekday = (d) => dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(d));

/** 'YYYY-MM-DD' en hora de Guatemala */
export const gtDateKey = (d = new Date()) => {
  const p = Object.fromEntries(dtf({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
export const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00-06:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return gtDateKey(d);
};
/** Hora actual en Guatemala en minutos desde medianoche */
export const gtMinutes = () => {
  const p = Object.fromEntries(dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};
export const toGtIso = (date, time) => new Date(`${date}T${time}:00-06:00`).toISOString();
export const gtTimeOf = (d) => {
  const p = Object.fromEntries(dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute}`;
};

export const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : '');

/** Edad calculada automáticamente a partir de la fecha de nacimiento */
export function ageParts(birth) {
  if (!birth) return null;
  const b = toDate(birth);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months };
}
export function ageLabel(birth) {
  const a = ageParts(birth);
  if (!a) return 'Edad no registrada';
  if (a.years < 2) return `${a.years * 12 + a.months} meses`;
  return `${a.years} años`;
}
export const isChild = (birth) => {
  const a = ageParts(birth);
  return !!a && a.years < 15;
};
export const genderLabel = (g) => (g === 'F' ? 'Femenino' : g === 'M' ? 'Masculino' : '—');

const AVATAR_COLORS = ['#2160CC', '#7A4FD6', '#1F9D6B', '#D6457F', '#C27A0E', '#0E8FB0', '#5B6CF0'];
export const avatarColor = (id = 0) => AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
export const shortInitials = (p) => `${p?.first_name?.[0] || ''}${p?.last_name?.[0] || ''}`.toUpperCase();

export const greeting = () => {
  const m = gtMinutes();
  if (m < 12 * 60) return 'Buenos días';
  if (m < 19 * 60) return 'Buenas tardes';
  return 'Buenas noches';
};

export const PATIENT_TYPES = {
  adulto: { label: 'Adulto', tone: 'tone-blue' },
  pediatrico: { label: 'Pediátrico', tone: 'tone-green' },
  embarazada: { label: 'Embarazada', tone: 'tone-pink' },
};

export const APPT_STATUS = {
  programada: { label: 'Programada', tone: 'tone-blue' },
  confirmada: { label: 'Confirmada', tone: 'tone-green' },
  completada: { label: 'Atendida', tone: 'tone-gray' },
  cancelada: { label: 'Cancelada', tone: 'tone-red' },
  no_asistio: { label: 'No asistió', tone: 'tone-amber' },
};
export const APPT_TYPES = { consulta: 'Consulta', seguimiento: 'Seguimiento', laboratorio: 'Laboratorio' };

export const LAB_STATUS = {
  solicitado: { label: 'Solicitado', tone: 'tone-blue' },
  en_proceso: { label: 'En proceso', tone: 'tone-purple' },
  completado: { label: 'Resultados listos', tone: 'tone-green' },
  cancelado: { label: 'Cancelado', tone: 'tone-red' },
};
export const PAY_STATUS = {
  pendiente: { label: 'Pendiente de pago', tone: 'tone-amber' },
  pagado: { label: 'Pagado', tone: 'tone-green' },
};
export const PAY_METHODS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

export const cx = (...a) => a.filter(Boolean).join(' ');

export const normalizeText = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
