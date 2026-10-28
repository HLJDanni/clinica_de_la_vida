// Datos de prueba para validar todas las funcionalidades.
// Uso: npm run db:seed  (borra los datos existentes y vuelve a cargar)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { initialsOf, searchNameOf } from '../src/utils.js';

const c = await pool.connect();
const one = async (sql, params) => (await c.query(sql, params)).rows[0];

// Fecha/hora en zona de Guatemala (UTC-6, sin horario de verano)
const gtNow = new Date(Date.now() - 6 * 3600_000);
const gt = (dayOffset, h = 9, m = 0) =>
  new Date(Date.UTC(gtNow.getUTCFullYear(), gtNow.getUTCMonth(), gtNow.getUTCDate() + dayOffset, h + 6, m)).toISOString();
const gtDate = (dayOffset) => gt(dayOffset).slice(0, 10);

try {
  await c.query('BEGIN');
  await c.query(`TRUNCATE audit_log, appointments, prescriptions, quote_items, quotes, payments, lab_order_items, lab_orders,
    lab_exams, referrals, follow_ups, clinical_records, patients, settings, users RESTART IDENTITY CASCADE`);

  /* ---------- Usuarios (solo dos) ---------- */
  const doctorPass = process.env.DOCTOR_PASSWORD || 'Delia#Vida2026';
  const receptionPass = process.env.RECEPTION_PASSWORD || 'Recepcion#2026';
  const dra = await one(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES ('dra.delia', $1, 'Dra. Delia', 'doctor') RETURNING id`,
    [await bcrypt.hash(doctorPass, 12)]
  );
  const rec = await one(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES ('recepcion', $1, 'Recepción', 'reception') RETURNING id`,
    [await bcrypt.hash(receptionPass, 12)]
  );

  /* ---------- Configuración ---------- */
  const settings = {
    consult_price: '150',
    clinic_address: '4a. Avenida 5-23, Zona 1, Guatemala',
    clinic_phone: '2230-4512 · 5521-8890',
    doctor_name: 'Dra. Delia',
    doctor_title: 'Médico y Cirujano',
    doctor_license: 'Colegiado No. 00000',
  };
  for (const [k, v] of Object.entries(settings)) await c.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [k, v]);

  /* ---------- Catálogo de laboratorio ---------- */
  const exams = [
    ['HEM-001', 'Hematología completa', 'Hematología', 60, 'Sangre (tubo lila)', '2 horas'],
    ['HEM-002', 'Velocidad de sedimentación', 'Hematología', 30, 'Sangre (tubo lila)', '2 horas'],
    ['HEM-003', 'Grupo sanguíneo y factor Rh', 'Hematología', 35, 'Sangre (tubo lila)', '1 hora'],
    ['HEM-004', 'Recuento de plaquetas', 'Hematología', 35, 'Sangre (tubo lila)', '2 horas'],
    ['HEM-005', 'Tiempo de protrombina (TP)', 'Hematología', 75, 'Sangre (tubo celeste)', '4 horas'],
    ['HEM-006', 'Tiempo de tromboplastina parcial (TPT)', 'Hematología', 75, 'Sangre (tubo celeste)', '4 horas'],
    ['QUI-001', 'Glucosa en ayunas', 'Química sanguínea', 25, 'Sangre (ayuno 8 h)', '1 hora'],
    ['QUI-002', 'Glucosa postprandial', 'Química sanguínea', 25, 'Sangre', '1 hora'],
    ['QUI-003', 'Hemoglobina glicosilada (HbA1c)', 'Química sanguínea', 150, 'Sangre (tubo lila)', '24 horas'],
    ['QUI-004', 'Curva de tolerancia a la glucosa', 'Química sanguínea', 120, 'Sangre (ayuno 8 h)', '3 horas'],
    ['QUI-005', 'Perfil lipídico', 'Química sanguínea', 150, 'Sangre (ayuno 12 h)', '4 horas'],
    ['QUI-006', 'Colesterol total', 'Química sanguínea', 35, 'Sangre (ayuno 12 h)', '2 horas'],
    ['QUI-007', 'Triglicéridos', 'Química sanguínea', 35, 'Sangre (ayuno 12 h)', '2 horas'],
    ['QUI-008', 'Creatinina', 'Química sanguínea', 40, 'Sangre', '2 horas'],
    ['QUI-009', 'Nitrógeno de urea (BUN)', 'Química sanguínea', 40, 'Sangre', '2 horas'],
    ['QUI-010', 'Ácido úrico', 'Química sanguínea', 40, 'Sangre', '2 horas'],
    ['QUI-011', 'Perfil hepático', 'Química sanguínea', 200, 'Sangre', '24 horas'],
    ['QUI-012', 'Transaminasas (TGO / TGP)', 'Química sanguínea', 80, 'Sangre', '4 horas'],
    ['QUI-013', 'Electrolitos (Na, K, Cl)', 'Química sanguínea', 150, 'Sangre', '4 horas'],
    ['URI-001', 'Examen general de orina', 'Orina y heces', 30, 'Orina (primera de la mañana)', '1 hora'],
    ['URI-002', 'Urocultivo', 'Orina y heces', 125, 'Orina (frasco estéril)', '72 horas'],
    ['HEC-001', 'Examen general de heces', 'Orina y heces', 30, 'Heces', '1 hora'],
    ['HEC-002', 'Heces seriadas (3 muestras)', 'Orina y heces', 75, 'Heces', '72 horas'],
    ['HEC-003', 'Sangre oculta en heces', 'Orina y heces', 60, 'Heces', '2 horas'],
    ['HEC-004', 'Coprocultivo', 'Orina y heces', 125, 'Heces', '72 horas'],
    ['INM-001', 'Prueba de embarazo en sangre (β-hCG cualitativa)', 'Inmunología', 75, 'Sangre', '1 hora'],
    ['INM-002', 'β-hCG cuantitativa', 'Inmunología', 150, 'Sangre', '24 horas'],
    ['INM-003', 'VIH (prueba rápida)', 'Inmunología', 100, 'Sangre', '30 minutos'],
    ['INM-004', 'VDRL', 'Inmunología', 45, 'Sangre', '2 horas'],
    ['INM-005', 'Hepatitis B (HBsAg)', 'Inmunología', 110, 'Sangre', '2 horas'],
    ['INM-006', 'Proteína C reactiva (PCR)', 'Inmunología', 75, 'Sangre', '2 horas'],
    ['INM-007', 'Factor reumatoideo', 'Inmunología', 75, 'Sangre', '2 horas'],
    ['INM-008', 'Antiestreptolisinas (ASO)', 'Inmunología', 75, 'Sangre', '2 horas'],
    ['INM-009', 'Reacción de Widal', 'Inmunología', 60, 'Sangre', '2 horas'],
    ['INM-010', 'Dengue NS1', 'Inmunología', 175, 'Sangre', '2 horas'],
    ['INM-011', 'Helicobacter pylori en heces', 'Inmunología', 150, 'Heces', '2 horas'],
    ['INM-012', 'Antígeno prostático específico (PSA)', 'Inmunología', 150, 'Sangre', '24 horas'],
    ['HOR-001', 'TSH', 'Hormonas', 125, 'Sangre', '24 horas'],
    ['HOR-002', 'T4 libre', 'Hormonas', 125, 'Sangre', '24 horas'],
    ['HOR-003', 'Perfil tiroideo (TSH, T3, T4)', 'Hormonas', 300, 'Sangre', '24 horas'],
    ['PAQ-001', 'Perfil prenatal', 'Paquetes', 350, 'Sangre y orina', '24 horas'],
    ['PAQ-002', 'Chequeo general (hematología, glucosa, orina, heces, perfil lipídico)', 'Paquetes', 250, 'Sangre, orina y heces', '24 horas'],
  ];
  const examId = {};
  for (const [code, name, cat, price, sample, tat] of exams) {
    const e = await one(
      `INSERT INTO lab_exams (code, name, category, price, sample, turnaround) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [code, name, cat, price, sample, tat]
    );
    examId[code] = { id: e.id, name, price };
  }

  /* ---------- Pacientes ---------- */
  const patients = [
    { k: 'maria', first: 'María José', last: 'López Pérez', birth: '1990-04-12', g: 'F', addr: 'Zona 1, Ciudad de Guatemala', phone: '5512-3456', rel: 'Católica', dpi: '2456 78901 0101',
      ant: { ant_medicos: 'Gastritis crónica desde 2018.', ant_quirurgicos: 'Apendicectomía (2010).', ant_traumaticos: 'Niega.', ant_alergias: 'Penicilina (urticaria).', ant_familiares: 'Madre con diabetes mellitus tipo 2. Padre hipertenso.' } },
    { k: 'carlos', first: 'Carlos Enrique', last: 'Ramírez Castillo', birth: '1978-09-03', g: 'M', addr: 'Mixco, Guatemala', phone: '4421-9087', rel: 'Evangélica', dpi: '1987 65432 0108',
      ant: { ant_medicos: 'Hipertensión arterial (2015), en tratamiento con losartán.', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Fractura de radio derecho (2004).', ant_alergias: 'Niega.', ant_familiares: 'Padre fallecido por infarto agudo de miocardio.' } },
    { k: 'ana', first: 'Ana Lucía', last: 'Méndez Orellana', birth: '1996-02-20', g: 'F', addr: 'Villa Nueva, Guatemala', phone: '3018-7744', rel: 'Católica', dpi: '3012 44556 0115',
      ant: { ant_medicos: 'Niega.', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Niega.', ant_alergias: 'Niega.', ant_familiares: 'Abuela materna con preeclampsia.' } },
    { k: 'sofia', first: 'Sofía Valentina', last: 'García Morales', birth: '2019-06-15', g: 'F', addr: 'Zona 7, Ciudad de Guatemala', phone: '5590-1122', rel: 'Católica', dpi: null,
      ant: { ant_medicos: 'Asma leve intermitente.', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Niega.', ant_alergias: 'Ácaros del polvo.', ant_familiares: 'Madre con rinitis alérgica.' } },
    { k: 'jose', first: 'José Antonio', last: 'Hernández Cifuentes', birth: '1955-11-28', g: 'M', addr: 'San Miguel Petapa, Guatemala', phone: '4877-3301', rel: 'Católica', dpi: '1655 32100 0101',
      ant: { ant_medicos: 'Diabetes mellitus tipo 2 (2009). Hipertensión arterial (2012).', ant_quirurgicos: 'Colecistectomía (2016).', ant_traumaticos: 'Niega.', ant_alergias: 'Sulfas.', ant_familiares: 'Hermanos con diabetes.' } },
    { k: 'luisa', first: 'Luisa Fernanda', last: 'Ortiz Barrios', birth: '1985-07-09', g: 'F', addr: 'Zona 18, Ciudad de Guatemala', phone: '5133-6620', rel: 'Evangélica', dpi: '2210 98765 0101',
      ant: { ant_medicos: 'Hipotiroidismo (2020).', ant_quirurgicos: 'Cesárea (2014).', ant_traumaticos: 'Niega.', ant_alergias: 'Niega.', ant_familiares: 'Madre con hipotiroidismo.' } },
    { k: 'diego', first: 'Diego Alejandro', last: 'Pérez Sandoval', birth: '2015-03-22', g: 'M', addr: 'Chinautla, Guatemala', phone: '3345-0098', rel: 'Adventista', dpi: null,
      ant: { ant_medicos: 'Niega.', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Esguince de tobillo izquierdo (2023).', ant_alergias: 'Niega.', ant_familiares: 'Niega.' } },
    { k: 'rosa', first: 'Rosa Elena', last: 'Cabrera de León', birth: '1962-01-17', g: 'F', addr: 'Zona 5, Ciudad de Guatemala', phone: '2251-4478', rel: 'Católica', dpi: '1599 11223 0101',
      ant: { ant_medicos: 'Osteoartritis de rodillas. Dislipidemia.', ant_quirurgicos: 'Histerectomía (2008).', ant_traumaticos: 'Niega.', ant_alergias: 'AINES (gastritis).', ant_familiares: 'Madre con osteoporosis.' } },
    { k: 'kevin', first: 'Kevin Estuardo', last: 'Monzón Juárez', birth: '2001-10-05', g: 'M', addr: 'Zona 12, Ciudad de Guatemala', phone: '4012-5567', rel: 'Ninguna', dpi: '3301 22114 0101', ant: {} },
    { k: 'gabriela', first: 'Gabriela Isabel', last: 'Rodas Fuentes', birth: '1993-12-01', g: 'F', addr: 'Santa Catarina Pinula, Guatemala', phone: '5678-2210', rel: 'Evangélica', dpi: '2789 33456 0101',
      ant: { ant_medicos: 'Anemia ferropénica (2021).', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Niega.', ant_alergias: 'Niega.', ant_familiares: 'Padre con hipertensión.' } },
    { k: 'marco', first: 'Marco Tulio', last: 'Aguilar Velásquez', birth: '1970-05-30', g: 'M', addr: 'Fraijanes, Guatemala', phone: '4590-7781', rel: 'Católica', dpi: '1755 66778 0101', ant: {} },
    { k: 'andrea', first: 'Andrea Paola', last: 'Chávez Roldán', birth: '1999-08-14', g: 'F', addr: 'Zona 11, Ciudad de Guatemala', phone: '3122-9045', rel: 'Católica', dpi: '3088 77665 0101',
      ant: { ant_medicos: 'Migraña sin aura.', ant_quirurgicos: 'Niega.', ant_traumaticos: 'Niega.', ant_alergias: 'Niega.', ant_familiares: 'Madre con migraña.' } },
  ];
  const P = {};
  for (const p of patients) {
    const row = await one(
      `INSERT INTO patients (first_name, last_name, birth_date, gender, address, phone, religion, dpi, initials, search_name,
         ant_medicos, ant_quirurgicos, ant_traumaticos, ant_alergias, ant_familiares, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now() - interval '60 days') RETURNING id`,
      [p.first, p.last, p.birth, p.g, p.addr, p.phone, p.rel, p.dpi, initialsOf(p.first, p.last), searchNameOf(p.first, p.last),
        p.ant.ant_medicos ?? null, p.ant.ant_quirurgicos ?? null, p.ant.ant_traumaticos ?? null, p.ant.ant_alergias ?? null,
        p.ant.ant_familiares ?? null, rec.id]
    );
    P[p.k] = row.id;
  }

  /* ---------- Fichas clínicas (consulta #1) ---------- */
  const adultExam = (o = {}) => ({
    pa: '120/80', fc: '76', fr: '16', temp: '36.6', spo2: '98', peso: '68', talla: '162', glucometria: '',
    estado_general: 'Consciente, orientada, hidratada, sin distrés respiratorio.',
    piel: 'Normocoloreada, sin lesiones.', cabeza_cuello: 'Normocéfalo, sin adenopatías.',
    torax_pulmones: 'Murmullo vesicular presente, sin agregados.', corazon: 'Ruidos cardiacos rítmicos, sin soplos.',
    abdomen: 'Blando, depresible, no doloroso.', genitourinario: 'Diferido.', extremidades: 'Sin edema, pulsos presentes.',
    neurologico: 'Sin déficit focal.', ...o,
  });
  const records = [
    ['maria', 'adulto', -45, 'Dolor abdominal en epigastrio de 1 semana de evolución.',
      'Paciente refiere dolor urente en epigastrio, de intensidad 6/10, que empeora con ayuno y comidas irritantes. Acompañado de pirosis y náuseas ocasionales. Niega vómitos, melena o pérdida de peso.',
      adultExam({ peso: '61', talla: '158', abdomen: 'Blando, doloroso a la palpación profunda en epigastrio, sin signos de irritación peritoneal.' }),
      'Hematología completa, H. pylori en heces.', 'Gastritis aguda. Descartar infección por H. pylori.',
      'Omeprazol 20 mg c/12 h por 14 días. Dieta blanda, evitar irritantes.', '', 'Control en 2 semanas con resultados.'],
    ['carlos', 'adulto', -40, 'Control de presión arterial y cefalea.',
      'Paciente hipertenso conocido, refiere cefalea occipital por las mañanas desde hace 10 días, sin alteraciones visuales. Adherencia irregular al tratamiento.',
      adultExam({ pa: '150/95', fc: '82', peso: '88', talla: '172', estado_general: 'Consciente, orientado, sobrepeso.' }),
      'Perfil lipídico, creatinina, glucosa en ayunas.', 'Hipertensión arterial no controlada. Sobrepeso.',
      'Losartán 50 mg c/12 h. Dieta hiposódica. Caminata 30 min diarios.', '', 'Se refuerza adherencia al tratamiento.'],
    ['ana', 'embarazada', -30, 'Control prenatal — primer control.',
      'Paciente primigesta con amenorrea de 12 semanas, prueba de embarazo positiva. Refiere náuseas matutinas. Niega sangrado o dolor pélvico.',
      adultExam({ pa: '110/70', peso: '58', talla: '160', fur: gtDate(-114), gestas: '1', partos: '0', cesareas: '0', abortos: '0', altura_uterina: '', fcf: '150', movimientos_fetales: 'No percibidos aún', presentacion: 'No aplica', edema: 'Ausente' }),
      'Perfil prenatal, ultrasonido obstétrico.', 'Embarazo intrauterino de 12 semanas por FUR. Hiperémesis leve.',
      'Ácido fólico 5 mg c/día. Sulfato ferroso 300 mg c/día. Dimenhidrinato si náuseas.', '', 'Control prenatal mensual.'],
    ['sofia', 'pediatrico', -25, 'Tos y dificultad respiratoria leve.',
      'Madre refiere que la niña presenta tos seca de 3 días, de predominio nocturno, con silbido de pecho. Sin fiebre.',
      { pa: '', fc: '110', fr: '28', temp: '36.9', spo2: '95', peso: '22', talla: '115', perimetro_cefalico: '',
        desarrollo: 'Acorde a la edad.', vacunas: 'Esquema completo según carné.', alimentacion: 'Dieta familiar, buen apetito.',
        estado_general: 'Activa, reactiva, hidratada.', torax_pulmones: 'Sibilancias espiratorias bilaterales leves.', corazon: 'Rítmico, sin soplos.', abdomen: 'Blando, no doloroso.' },
      'Ninguno.', 'Crisis asmática leve.', 'Salbutamol inhalado 2 puff c/6 h con espaciador por 5 días.', '', 'Signos de alarma explicados a la madre.'],
    ['jose', 'adulto', -50, 'Control de diabetes e hipertensión.',
      'Paciente con DM2 e HTA conocidas. Refiere poliuria y polidipsia leves en el último mes. Glucometrías en casa entre 180 y 220 mg/dL.',
      adultExam({ pa: '140/90', fc: '78', peso: '84', talla: '168', glucometria: '210', extremidades: 'Pulsos pedios disminuidos, sensibilidad conservada.' }),
      'HbA1c, perfil lipídico, creatinina, orina.', 'Diabetes mellitus tipo 2 descompensada. Hipertensión arterial estadio 1.',
      'Metformina 850 mg c/12 h. Glibenclamida 5 mg c/día. Losartán 50 mg c/día.', 'Oftalmología para fondo de ojo.', 'Educación en dieta para diabético.'],
    ['luisa', 'adulto', -20, 'Cansancio y aumento de peso.',
      'Paciente con hipotiroidismo conocido, refiere fatiga, intolerancia al frío y aumento de 4 kg en 3 meses.',
      adultExam({ pa: '115/75', fc: '62', peso: '72', talla: '160' }),
      'TSH, T4 libre.', 'Hipotiroidismo en control subóptimo.', 'Levotiroxina 75 mcg en ayunas.', '', ''],
    ['diego', 'pediatrico', -15, 'Fiebre y dolor de garganta.',
      'Paciente de 10 años con fiebre de 38.8 °C de 2 días, odinofagia y malestar general.',
      { fc: '100', fr: '20', temp: '38.6', spo2: '98', peso: '33', talla: '138', desarrollo: 'Adecuado.', vacunas: 'Completo.', alimentacion: 'Disminución del apetito.',
        estado_general: 'Febril, hidratado.', cabeza_cuello: 'Amígdalas hipertróficas con exudado blanquecino, adenopatías cervicales dolorosas.' },
      'ASO.', 'Faringoamigdalitis bacteriana.', 'Amoxicilina 500 mg c/8 h por 10 días. Acetaminofén si fiebre.', '', ''],
    ['rosa', 'adulto', -35, 'Dolor de rodillas.',
      'Paciente con osteoartritis conocida, refiere aumento del dolor en ambas rodillas al subir gradas, rigidez matutina de 15 minutos.',
      adultExam({ pa: '130/85', peso: '74', talla: '155', extremidades: 'Crepitación en ambas rodillas, sin derrame.' }),
      'Perfil lipídico, ácido úrico.', 'Osteoartritis de rodillas. Dislipidemia.', 'Glucosamina 1500 mg c/día. Paracetamol 500 mg c/8 h PRN. Fisioterapia.', 'Traumatología.', ''],
    ['gabriela', 'embarazada', -10, 'Control prenatal.',
      'Paciente G2P1 con embarazo de 24 semanas. Refiere movimientos fetales presentes. Niega sangrado, cefalea o edema.',
      adultExam({ pa: '115/70', peso: '66', talla: '163', fur: gtDate(-178), gestas: '2', partos: '1', cesareas: '0', abortos: '0', altura_uterina: '23', fcf: '142', movimientos_fetales: 'Presentes', presentacion: 'Indiferente', edema: 'Ausente' }),
      'Hematología, orina, curva de tolerancia a la glucosa.', 'Embarazo de 24 semanas por FUR, evolución normal.', 'Sulfato ferroso 300 mg c/día. Calcio 600 mg c/día.', '', ''],
    ['andrea', 'adulto', -5, 'Cefalea recurrente.',
      'Paciente con migraña conocida, refiere aumento de frecuencia de crisis a 3 por semana, pulsátil, con fotofobia.',
      adultExam({ pa: '110/70', peso: '57', talla: '165' }),
      'Ninguno por ahora.', 'Migraña sin aura, episódica frecuente.', 'Naproxeno 550 mg al inicio de la crisis. Diario de cefalea.', '', ''],
  ];
  const R = {};
  for (const [k, type, day, motivo, historia, exam, estudios, dx, tx, ref, com] of records) {
    const row = await one(
      `INSERT INTO clinical_records (patient_id, patient_type, motivo_consulta, historia_enfermedad, examen_fisico, estudios,
         diagnostico, tratamiento, referencia, comentarios, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
      [P[k], type, motivo, historia, JSON.stringify(exam), estudios, dx, tx, ref || null, com || null, dra.id, gt(day, 10, 0)]
    );
    R[k] = row.id;
  }

  /* ---------- Seguimientos ---------- */
  const followUps = [
    ['maria', 'adulto', -30, 'Control con resultados.', 'Mejoría del dolor en un 70%. Persiste pirosis ocasional.',
      { pa: '115/75', fc: '72', temp: '36.5', peso: '61', talla: '158', abdomen: 'Blando, leve dolor en epigastrio.' },
      'H. pylori en heces: POSITIVO.', 'Gastritis por H. pylori.', 'Terapia triple: claritromicina + amoxicilina alternativa (alergia a penicilina: metronidazol) + omeprazol por 14 días.', '',
      [{ medicamento: 'Omeprazol', presentacion: 'Cápsulas 20 mg', dosis: '1 cápsula', frecuencia: 'Cada 12 horas', duracion: '14 días' },
        { medicamento: 'Claritromicina', presentacion: 'Tabletas 500 mg', dosis: '1 tableta', frecuencia: 'Cada 12 horas', duracion: '14 días' },
        { medicamento: 'Metronidazol', presentacion: 'Tabletas 500 mg', dosis: '1 tableta', frecuencia: 'Cada 12 horas', duracion: '14 días' }]],
    ['maria', 'adulto', -12, 'Control post tratamiento.', 'Asintomática. Completó tratamiento.',
      { pa: '110/70', fc: '70', temp: '36.4', peso: '62', talla: '158', abdomen: 'Blando, no doloroso.' },
      '', 'Gastritis por H. pylori tratada.', 'Continuar dieta. Omeprazol 20 mg c/día por 30 días.', 'Control de erradicación en 4 semanas.', null],
    ['carlos', 'adulto', -20, 'Control de presión arterial.', 'Cefalea resuelta. Adherente al tratamiento.',
      { pa: '132/85', fc: '76', peso: '86', talla: '172' }, 'Perfil lipídico: colesterol 238 mg/dL, LDL 160 mg/dL.',
      'Hipertensión arterial en control. Dislipidemia.', 'Continuar losartán. Agregar atorvastatina 20 mg c/noche.', '',
      [{ medicamento: 'Atorvastatina', presentacion: 'Tabletas 20 mg', dosis: '1 tableta', frecuencia: 'Cada noche', duracion: '3 meses' },
        { medicamento: 'Losartán', presentacion: 'Tabletas 50 mg', dosis: '1 tableta', frecuencia: 'Cada 12 horas', duracion: 'Continuo' }]],
    ['ana', 'embarazada', -2, 'Control prenatal.', 'Náuseas disminuidas. Sin molestias.',
      { pa: '110/70', peso: '60', talla: '160', fur: gtDate(-114), altura_uterina: '14', fcf: '148', movimientos_fetales: 'No percibidos aún', edema: 'Ausente' },
      'Perfil prenatal normal. Grupo O Rh+.', 'Embarazo de 16 semanas, evolución normal.', 'Continuar ácido fólico y hierro.', 'Ultrasonido morfológico a las 20 semanas.', null],
    ['jose', 'adulto', -25, 'Control con resultados.', 'Refiere mejor control, glucometrías entre 140-160.',
      { pa: '135/85', fc: '74', peso: '83', talla: '168', glucometria: '150' }, 'HbA1c 8.9 %. Creatinina 1.0 mg/dL.',
      'DM2 en mejoría. HTA en control.', 'Continuar esquema. Dieta y ejercicio.', '', null],
    ['sofia', 'pediatrico', -18, 'Control de asma.', 'Sin tos ni silbido de pecho.',
      { fc: '98', fr: '22', temp: '36.6', spo2: '98', peso: '22', talla: '115', torax_pulmones: 'Murmullo vesicular sin agregados.' },
      '', 'Asma leve intermitente controlada.', 'Salbutamol solo en crisis.', '', null],
  ];
  const visit = {};
  for (const [k, type, day, motivo, evol, exam, estudios, dx, tx, com, rx] of followUps) {
    visit[k] = (visit[k] || 1) + 1;
    const fu = await one(
      `INSERT INTO follow_ups (patient_id, record_id, visit_number, patient_type, motivo, evolucion, examen_fisico, estudios,
         diagnostico, tratamiento, comentarios, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
      [P[k], R[k], visit[k], type, motivo, evol, JSON.stringify(exam), estudios || null, dx, tx, com || null, dra.id, gt(day, 11, 0)]
    );
    if (rx) {
      await c.query(
        `INSERT INTO prescriptions (patient_id, follow_up_id, items, indicaciones, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [P[k], fu.id, JSON.stringify(rx), 'Tomar con alimentos. Regresar si presenta efectos adversos.', dra.id, gt(day, 11, 5)]
      );
    }
  }

  /* ---------- Recetas adicionales ---------- */
  const extraRx = [
    ['ana', -30, [{ medicamento: 'Ácido fólico', presentacion: 'Tabletas 5 mg', dosis: '1 tableta', frecuencia: 'Cada día', duracion: 'Hasta semana 14' },
      { medicamento: 'Sulfato ferroso', presentacion: 'Tabletas 300 mg', dosis: '1 tableta', frecuencia: 'Cada día', duracion: 'Todo el embarazo' }], 'Tomar el hierro con jugo de naranja.'],
    ['sofia', -25, [{ medicamento: 'Salbutamol', presentacion: 'Inhalador 100 mcg', dosis: '2 puff con espaciador', frecuencia: 'Cada 6 horas', duracion: '5 días' }], 'Acudir a emergencia si hay dificultad para respirar.'],
    ['jose', -50, [{ medicamento: 'Metformina', presentacion: 'Tabletas 850 mg', dosis: '1 tableta', frecuencia: 'Cada 12 horas', duracion: 'Continuo' },
      { medicamento: 'Glibenclamida', presentacion: 'Tabletas 5 mg', dosis: '1 tableta', frecuencia: 'Antes del desayuno', duracion: 'Continuo' },
      { medicamento: 'Losartán', presentacion: 'Tabletas 50 mg', dosis: '1 tableta', frecuencia: 'Cada día', duracion: 'Continuo' }], 'Dieta para diabético. Glucometría diaria.'],
    ['diego', -15, [{ medicamento: 'Amoxicilina', presentacion: 'Cápsulas 500 mg', dosis: '1 cápsula', frecuencia: 'Cada 8 horas', duracion: '10 días' },
      { medicamento: 'Acetaminofén', presentacion: 'Tabletas 500 mg', dosis: '1 tableta', frecuencia: 'Cada 6 horas si hay fiebre', duracion: '3 días' }], 'Completar el antibiótico aunque mejore.'],
    ['luisa', -20, [{ medicamento: 'Levotiroxina', presentacion: 'Tabletas 75 mcg', dosis: '1 tableta', frecuencia: 'En ayunas', duracion: 'Continuo' }], 'Tomar 30 minutos antes del desayuno.'],
    ['andrea', -5, [{ medicamento: 'Naproxeno', presentacion: 'Tabletas 550 mg', dosis: '1 tableta', frecuencia: 'Al inicio de la crisis', duracion: 'Según necesidad' }], 'Llevar diario de cefalea.'],
  ];
  for (const [k, day, items, ind] of extraRx) {
    await c.query(`INSERT INTO prescriptions (patient_id, items, indicaciones, created_by, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [P[k], JSON.stringify(items), ind, dra.id, gt(day, 10, 30)]);
  }

  /* ---------- Referencias ---------- */
  await c.query(
    `INSERT INTO referrals (patient_id, referido_a, especialidad, motivo, historia_enfermedad, examen_fisico, comentario, tratamiento,
       impresion_clinica, estudios_realizados, created_by, created_at)
     VALUES ($1,'Hospital Roosevelt — Consulta Externa','Oftalmología','Evaluación de fondo de ojo por diabetes de larga evolución.',$2,$3,
       'Paciente colaborador, se solicita contrarreferencia.', 'Metformina 850 mg c/12 h, glibenclamida 5 mg c/día, losartán 50 mg c/día.',
       'Diabetes mellitus tipo 2. Hipertensión arterial.', 'HbA1c 8.9 %. Creatinina 1.0 mg/dL.', $4, $5)`,
    [P.jose, 'Paciente con DM2 de 15 años de evolución e HTA, refiere visión borrosa ocasional.',
      'PA 135/85 mmHg, FC 74 lpm, peso 83 kg. Pulsos pedios disminuidos.', dra.id, gt(-24, 12)]
  );
  await c.query(
    `INSERT INTO referrals (patient_id, referido_a, especialidad, motivo, historia_enfermedad, examen_fisico, comentario, tratamiento,
       impresion_clinica, estudios_realizados, created_by, created_at)
     VALUES ($1,'Dr. Roberto Estrada','Traumatología y Ortopedia','Evaluación de osteoartritis de rodillas con dolor persistente.',$2,$3,
       '', 'Glucosamina, paracetamol PRN, fisioterapia.', 'Osteoartritis de rodillas bilateral.', 'Perfil lipídico, ácido úrico.', $4, $5)`,
    [P.rosa, 'Dolor de rodillas de 2 años de evolución, empeora con la actividad.', 'Crepitación en ambas rodillas, sin derrame articular.', dra.id, gt(-34, 12)]
  );

  /* ---------- Órdenes de laboratorio y cobros ---------- */
  const orders = [
    ['maria', -45, ['HEM-001', 'INM-011'], 'consulta', 'completado', 'pagado', 'efectivo',
      { 'HEM-001': 'Hb 12.8 g/dL, Leucocitos 7,200/mm³, Plaquetas 260,000. Normal.', 'INM-011': 'POSITIVO' }],
    ['carlos', -40, ['QUI-005', 'QUI-008', 'QUI-001'], 'consulta', 'completado', 'pagado', 'tarjeta',
      { 'QUI-005': 'Colesterol 238, HDL 38, LDL 160, Triglicéridos 200 mg/dL', 'QUI-008': '0.9 mg/dL', 'QUI-001': '98 mg/dL' }],
    ['ana', -30, ['PAQ-001'], 'consulta', 'completado', 'pagado', 'efectivo', { 'PAQ-001': 'Hb 12.1 g/dL. Orina normal. VDRL no reactivo. VIH no reactivo. Grupo O Rh+. Glucosa 82 mg/dL.' }],
    ['jose', -50, ['QUI-003', 'QUI-005', 'QUI-008', 'URI-001'], 'consulta', 'completado', 'pagado', 'transferencia',
      { 'QUI-003': '8.9 %', 'QUI-005': 'Colesterol 210, LDL 130 mg/dL', 'QUI-008': '1.0 mg/dL', 'URI-001': 'Glucosuria ++. Sin proteínas.' }],
    ['kevin', -3, ['HEM-001', 'URI-001', 'HEC-001'], 'recepcion', 'completado', 'pagado', 'efectivo',
      { 'HEM-001': 'Normal.', 'URI-001': 'Normal.', 'HEC-001': 'Quistes de Entamoeba histolytica.' }],
    ['marco', -1, ['QUI-001', 'QUI-005', 'INM-012'], 'recepcion', 'en_proceso', 'pagado', 'tarjeta', {}],
    ['gabriela', 0, ['HEM-001', 'URI-001', 'QUI-004'], 'consulta', 'solicitado', 'pendiente', null, {}],
    ['luisa', 0, ['HOR-001', 'HOR-002'], 'consulta', 'solicitado', 'pendiente', null, {}],
    ['kevin', 0, ['HEC-002'], 'recepcion', 'solicitado', 'pendiente', null, {}],
    ['rosa', -34, ['QUI-005', 'QUI-010'], 'consulta', 'completado', 'pagado', 'efectivo', { 'QUI-005': 'Colesterol 225 mg/dL', 'QUI-010': '5.8 mg/dL' }],
  ];
  for (const [k, day, codes, origin, status, payStatus, method, results] of orders) {
    const total = codes.reduce((s, cd) => s + examId[cd].price, 0);
    const at = day === 0 ? new Date(Date.now() - 2 * 3600_000).toISOString() : gt(day, 9, 30);
    const o = await one(
      `INSERT INTO lab_orders (patient_id, origin, status, payment_status, total, created_by, created_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [P[k], origin, status, payStatus, total, origin === 'consulta' ? dra.id : rec.id, at, status === 'completado' ? gt(day + 1, 10) : null]
    );
    for (const cd of codes) {
      await c.query('INSERT INTO lab_order_items (order_id, exam_id, exam_name, price, result) VALUES ($1,$2,$3,$4,$5)',
        [o.id, examId[cd].id, examId[cd].name, examId[cd].price, results[cd] || null]);
    }
    if (payStatus === 'pagado') {
      await c.query(
        `INSERT INTO payments (patient_id, concept, lab_order_id, description, amount, method, received_by, created_at)
         VALUES ($1,'laboratorio',$2,$3,$4,$5,$6,$7)`,
        [P[k], o.id, `Orden de laboratorio #${o.id}`, total, method, rec.id, at]
      );
    }
  }
  // Cobros de consulta
  const consults = [['maria', -45], ['carlos', -40], ['ana', -30], ['jose', -50], ['ana', -2], ['andrea', -5], ['gabriela', 0], ['luisa', 0]];
  for (const [k, day] of consults) {
    const at = day === 0 ? new Date(Date.now() - 3 * 3600_000).toISOString() : gt(day, 10);
    await c.query(
      `INSERT INTO payments (patient_id, concept, description, amount, method, received_by, created_at) VALUES ($1,'consulta','Consulta médica',150,$2,$3,$4)`,
      [P[k], day % 2 ? 'tarjeta' : 'efectivo', rec.id, at]
    );
  }

  /* ---------- Citas ---------- */
  const appts = [
    ['gabriela', 0, 8, 30, 'consulta', 'Control prenatal', 'completada'],
    ['luisa', 0, 10, 0, 'seguimiento', 'Control de tiroides', 'completada'],
    ['carlos', 0, 16, 0, 'seguimiento', 'Control de presión arterial', 'confirmada'],
    ['maria', 1, 8, 0, 'seguimiento', 'Control de erradicación H. pylori', 'confirmada'],
    ['jose', 1, 9, 30, 'seguimiento', 'Control de diabetes', 'programada'],
    ['sofia', 1, 11, 0, 'consulta', 'Control de niña sana', 'programada'],
    ['kevin', 1, 7, 30, 'laboratorio', 'Entrega de muestras de heces seriadas', 'programada'],
    ['andrea', 1, 15, 0, 'seguimiento', 'Revisión de diario de cefalea', 'programada'],
    ['ana', 3, 9, 0, 'seguimiento', 'Control prenatal 20 semanas', 'programada'],
    ['rosa', 4, 10, 30, 'seguimiento', 'Control de osteoartritis', 'programada'],
    ['diego', 6, 14, 0, 'seguimiento', 'Control post tratamiento', 'programada'],
    ['marco', 2, 8, 0, 'consulta', 'Revisión de resultados de laboratorio', 'programada'],
    ['luisa', 9, 9, 0, 'seguimiento', 'Control con TSH', 'programada'],
    ['gabriela', 14, 8, 30, 'seguimiento', 'Control prenatal 26 semanas', 'programada'],
    ['carlos', -20, 9, 0, 'seguimiento', 'Control de presión arterial', 'completada'],
    ['maria', -12, 10, 0, 'seguimiento', 'Control post tratamiento', 'completada'],
    ['andrea', -8, 11, 0, 'consulta', 'Cefalea', 'no_asistio'],
  ];
  for (const [k, day, h, m, type, reason, status] of appts) {
    await c.query(
      `INSERT INTO appointments (patient_id, scheduled_at, duration_min, type, reason, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [P[k], gt(day, h, m), type === 'laboratorio' ? 15 : 30, type, reason, status, rec.id]
    );
  }

  /* ---------- Cotizaciones ---------- */
  const quotes = [
    ['Familia Gómez Ruiz', '5544-1200', null, [['PAQ-002', 3]], false, 10, 'Chequeo general para 3 personas.'],
    ['Pedro Castañeda', '4433-2211', null, [['QUI-005', 1], ['QUI-003', 1], ['QUI-001', 1], ['QUI-008', 1]], true, 0, ''],
    ['Kevin Estuardo Monzón Juárez', '4012-5567', 'kevin', [['HEC-002', 1], ['INM-011', 1]], false, 0, 'Seguimiento de parasitosis.'],
  ];
  for (const [name, phone, pk, items, consulta, disc, notes] of quotes) {
    const lines = items.map(([cd, qty]) => ({ exam_id: examId[cd].id, name: examId[cd].name, price: examId[cd].price, qty }));
    if (consulta) lines.unshift({ exam_id: null, name: 'Consulta médica — Dra. Delia', price: 150, qty: 1 });
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const total = Math.round(subtotal * (1 - disc / 100) * 100) / 100;
    const qt = await one(
      `INSERT INTO quotes (customer_name, customer_phone, patient_id, subtotal, discount_pct, total, notes, valid_until, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [name, phone, pk ? P[pk] : null, subtotal, disc, total, notes || null, gtDate(12), rec.id, gt(-3, 15)]
    );
    for (const l of lines) {
      await c.query('INSERT INTO quote_items (quote_id, exam_id, name, price, qty) VALUES ($1,$2,$3,$4,$5)', [qt.id, l.exam_id, l.name, l.price, l.qty]);
    }
  }

  await c.query('COMMIT');
  console.log('Datos de prueba cargados.');
  console.log('  Dra. Delia  → usuario: dra.delia  contraseña:', doctorPass);
  console.log('  Recepción   → usuario: recepcion  contraseña:', receptionPass);
} catch (err) {
  await c.query('ROLLBACK');
  console.error(err);
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
