// Genera la cotización en Word. Uso: npm install docx@9 && node generar_cotizacion.js Cotizacion_Clinica_Pasion_por_la_Vida.docx
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, BorderStyle, LevelFormat, Footer, Header, PageNumber, PageBreak,
} = require('docx');

const BLUE = '2160CC';
const DARK = '1A3D80';
const LIGHT = 'EEF4FF';
const FONT = 'Arial';
const W = 9360; // ancho útil carta con márgenes de 1"

const out = process.argv[2];

const p = (text, o = {}) =>
  new Paragraph({
    spacing: { after: o.after ?? 120, line: 300 },
    alignment: o.align,
    children: (Array.isArray(text) ? text : [text]).map((t) => (typeof t === 'string' ? new TextRun({ text: t, font: FONT, size: o.size || 21, bold: o.bold, color: o.color }) : t)),
  });
const b = (text) => new TextRun({ text, bold: true, font: FONT, size: 21 });
const t = (text) => new TextRun({ text, font: FONT, size: 21 });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text, font: FONT, size: 30, bold: true, color: BLUE })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: DARK })] });
const bullet = (parts) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 290 }, children: (Array.isArray(parts) ? parts : [t(parts)]) });

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CFD8E8' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, rows, { header = true, totalRows = 0, alignRight = [] } = {}) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, ri) => {
      const isHead = header && ri === 0;
      const isTotal = ri >= rows.length - totalRows;
      return new TableRow({
        tableHeader: isHead,
        children: r.map((cell, ci) =>
          new TableCell({
            width: { size: widths[ci], type: WidthType.DXA },
            borders,
            shading: isHead ? { fill: BLUE, type: ShadingType.CLEAR, color: 'auto' } : isTotal ? { fill: LIGHT, type: ShadingType.CLEAR, color: 'auto' } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: alignRight.includes(ci) ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [new TextRun({ text: String(cell), font: FONT, size: 19, bold: isHead || isTotal, color: isHead ? 'FFFFFF' : isTotal ? DARK : '222222' })],
              }),
            ],
          })
        ),
      });
    }),
  });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const q = (n) => `Q ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------- Datos de la cotización ---------- */
const software = [
  ['1', 'Levantamiento de requerimientos, análisis y diseño UX/UI (estilo moderno, colores institucionales)', 900],
  ['2', 'Desarrollo del backend (API REST en Node.js), autenticación y control de acceso por rol', 1500],
  ['3', 'Desarrollo del frontend SPA: vista de la Dra. Delia y vista de Recepción', 1800],
  ['4', 'Diseño de base de datos PostgreSQL, migraciones y carga de datos iniciales', 600],
  ['5', 'Documentos imprimibles (ficha, seguimiento, referencia, receta, cotización, recibos) y aviso de citas 7:30 p. m.', 500],
  ['6', 'Pruebas, despliegue en la nube, capacitación al personal y manual de uso', 700],
];
const otros = [
  ['1', 'Router Wi-Fi de doble banda e instalación/configuración de red segura', 450],
  ['2', 'Cableado, conectores y accesorios de red para recepción y consultorio', 250],
  ['3', 'UPS / regulador de voltaje para el equipo de recepción', 450],
  ['4', 'Dominio web (1 año), configuración DNS y certificado SSL', 150],
  ['5', 'Fondo de infraestructura en la nube (reserva para dominio propio o ampliación de plan)', 300],
  ['6', 'Capacitación presencial adicional y manuales impresos', 200],
  ['7', 'Transporte, visitas técnicas y tiempo de puesta en marcha en sitio', 200],
];
// Costos de operación referenciales (precios públicos consultados en noviembre de 2026)
const TC = 7.75; // Q por US$
const usd = (n) => `US$ ${n.toFixed(2)}`;
const WEB_MES = 7; // Render Starter: siempre activo, sin dormirse
const DOMINIO_ANIO = 13; // dominio .com, renovación anual aprox.
// Neon Launch por uso: 0.25 CU activo ~10 h/día (75 CU-h/mes × US$ 0.106) + 1 GB (US$ 0.35)
const NEON_LAUNCH_MES = Math.round((75 * 0.106 + 0.35) * 100) / 100;
const RENDER_PG_MES = 6 + 0.3; // Render Postgres Basic-256mb + 1 GB de almacenamiento
const opciones = [
  { nombre: 'Opción 0 · Elegida', web: 'Render Free', webMes: 0, db: 'Neon Free', dbMes: 0, dominio: 0 },
  { nombre: 'Opción 1 · Básica', web: 'Render Starter', webMes: WEB_MES, db: 'Neon Free', dbMes: 0, dominio: DOMINIO_ANIO },
  { nombre: 'Opción 2 · Solo Render', web: 'Render Starter', webMes: WEB_MES, db: 'Render Postgres', dbMes: RENDER_PG_MES, dominio: DOMINIO_ANIO },
  { nombre: 'Opción 3 · Crecimiento', web: 'Render Starter', webMes: WEB_MES, db: 'Neon Launch', dbMes: NEON_LAUNCH_MES, dominio: DOMINIO_ANIO },
].map((o) => {
  const anualUsd = o.webMes * 12 + o.dbMes * 12 + o.dominio;
  return { ...o, anualUsd, anualQ: anualUsd * TC, mesQ: (anualUsd * TC) / 12 };
});
// Capacidad del 1 GB gratuito de Neon (medido sobre la base real: ~5 KB por atención con índices y margen)
const KB_ATENCION = 6; // ~1.7 KB de datos por atención × índices y margen
const MB_BASE = 10; // estructura interna de PostgreSQL
const aniosCapacidad = (porDia) => Math.floor((1024 - MB_BASE) / ((porDia * 26 * 12 * KB_ATENCION) / 1024));
const sumSw = software.reduce((s, r) => s + r[2], 0);
const sumOt = otros.reduce((s, r) => s + r[2], 0);
if (sumSw !== 6000 || sumOt !== 2000) throw new Error(`Totales incorrectos: ${sumSw} / ${sumOt}`);

const children = [
  // Portada
  new Paragraph({ spacing: { before: 1400, after: 120 }, children: [new TextRun({ text: 'COTIZACIÓN DE SOFTWARE', font: FONT, size: 22, bold: true, color: BLUE, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Sistema de Gestión Clínica', font: FONT, size: 56, bold: true, color: '0F1B2D' })] }),
  new Paragraph({
    spacing: { after: 600 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } },
    children: [new TextRun({ text: 'Clínica Médica Pasión por la Vida', font: FONT, size: 34, color: DARK })],
  }),
  table(
    [3000, 6360],
    [
      ['No. de cotización', 'CMPV-2026-001'],
      ['Fecha', '27 de octubre de 2026'],
      ['Cliente', 'Clínica Médica Pasión por la Vida — Dra. Delia'],
      ['Proyecto', 'Aplicación web SPA de expedientes, laboratorio, agenda y caja (Fase 1)'],
      ['Validez de la oferta', '30 días calendario'],
      ['Moneda', 'Quetzales (GTQ)'],
      ['Forma de pago', 'Pago único contra entrega, sin anticipo'],
      ['Inversión total', 'Q 8,000.00'],
    ],
    { header: false, totalRows: 1 }
  ),
  new Paragraph({ children: [new PageBreak()] }),

  // 1. Resumen
  h1('1. Resumen ejecutivo'),
  p('La Clínica Médica Pasión por la Vida cuida a cada paciente con dedicación, y merece una herramienta a la altura de esa atención. Proponemos un sistema propio, hecho a la medida de su forma de trabajar, que reúne en un solo lugar lo que hoy vive en papeles, cuadernos y hojas sueltas.'),
  p('Con él, la Dra. Delia tendrá el expediente completo de cada paciente a un clic: su ficha, cada visita de seguimiento, sus recetas, sus laboratorios y sus próximas citas. Recepción podrá registrar pacientes, cotizar y cobrar exámenes en segundos, y cada noche a las 7:30 p. m. el sistema recordará qué citas hay para el día siguiente.'),
  h2('Lo que gana la clínica'),
  bullet([b('Más tiempo para los pacientes: '), t('el sistema calcula edades, índice de masa corporal y semanas de embarazo, y llena por sí solo las hojas de referencia, para escribir menos y atender más.')]),
  bullet([b('Información segura y siempre a la mano: '), t('cada persona entra con su usuario y contraseña, la información vive en la nube y la Dra. puede descargar con un clic una copia cifrada de todos los expedientes. Se consulta desde cualquier computadora, tableta o teléfono.')]),
  bullet([b('Un mejor control de la clínica: '), t('ingresos del día, exámenes más solicitados y estadísticas claras para tomar mejores decisiones.')]),
  bullet([b('Una imagen más profesional: '), t('recetas, fichas, cotizaciones y recibos impresos con el membrete de la clínica.')]),
  bullet([b('Fácil y agradable de usar: '), t('un diseño moderno y limpio, con modo claro y oscuro, pensado para que el personal lo aprenda en minutos.')]),
  p([b('Inversión total: Q 8,000.00, '), t('en un solo pago al momento de la entrega, sin anticipo. Incluye el sistema completo (Q 6,000.00) y el equipo, la red y la puesta en marcha (Q 2,000.00).')]),
  p([b('Operación mensual: Q 0.00. '), t('El sistema funcionará con su servidor en Render y su base de datos en Neon, ambos en planes gratuitos, por lo que la clínica no tendrá pagos mensuales a proveedores. La explicación completa está en la sección 8.')]),

  // 2. Flujo
  h1('2. Flujo de trabajo cubierto'),
  bullet([b('Recepción: '), t('todo paciente pasa primero por recepción, donde se registran o consultan sus datos generales.')]),
  bullet([b('Consulta médica: '), t('en la primera visita la Dra. Delia llena la ficha clínica (consulta #1).')]),
  bullet([b('Seguimiento: '), t('cada visita posterior se registra en una hoja de seguimiento, vinculada a la ficha inicial.')]),
  bullet([b('Laboratorio directo: '), t('si el paciente solo viene a laboratorio, recepción registra sus datos, el examen realizado y el cobro, sin pasar por consulta.')]),
  bullet([b('Referencia: '), t('cuando corresponde, la Dra. genera la hoja de referencia prellenada automáticamente con la información del expediente.')]),

  // 3. Alcance
  h1('3. Alcance funcional — Fase 1'),
  h2('3.1 Ficha clínica (consulta #1)'),
  p('Datos del paciente (nombre, edad calculada automáticamente, dirección, teléfono, religión, género), antecedentes médicos, quirúrgicos, traumáticos, alergias y familiares; motivo de consulta, historia de la enfermedad, examen físico guiado por preguntas, estudios, diagnóstico, tratamiento, referencia y comentarios. Incluye botones para diferenciar paciente adulto, niño y mujer embarazada, que adaptan el examen físico (evaluación pediátrica o control obstétrico con edad gestacional y fecha probable de parto calculadas por el sistema). El IMC también se calcula automáticamente.'),
  h2('3.2 Seguimiento de caso'),
  p('Una hoja por visita médica, numerada automáticamente (consulta #2, #3, …). Permite reutilizar el diagnóstico y tratamiento anteriores, emitir receta y agendar la próxima cita en el mismo paso.'),
  h2('3.3 Hoja de referencia'),
  p('Datos del paciente, motivo de la referencia, historia de la enfermedad, examen físico, comentario, tratamiento, impresión clínica y estudios realizados; se prellena con la ficha, el último seguimiento y los resultados de laboratorio para evitar re-escribir.'),
  h2('3.4 Panel del expediente'),
  p('Al consultar la ficha clínica se muestran en un panel lateral los laboratorios registrados, las recetas y las próximas citas del paciente, con botones para agregar receta, laboratorio o cita cuando no existan.'),
  h2('3.5 Laboratorio, cotizaciones y caja'),
  bullet('Catálogo de exámenes con precios, muestra y tiempo de entrega (42 exámenes iniciales, editable por la Dra.).'),
  bullet('Órdenes de laboratorio con cobro, registro de resultados e impresión.'),
  bullet('Cotizaciones de varios exámenes a la vez, con opción de incluir la consulta y aplicar descuento; conversión de cotización en orden.'),
  bullet('Caja diaria: cobros de consulta y laboratorio por forma de pago (efectivo, tarjeta, transferencia) y recibos imprimibles.'),
  h2('3.6 Agenda y notificaciones'),
  p('Agenda de citas con detección de horarios cruzados. Todos los días a las 7:30 p. m. el sistema notifica cuántas y cuáles citas hay para el día siguiente.'),
  h2('3.7 Búsqueda de expedientes'),
  p('Búsqueda instantánea por nombre completo, por iniciales (ej. “MJLP” para María José López Pérez), por teléfono o por DPI, sin importar tildes.'),
  h2('3.8 Documentos imprimibles'),
  p('Ficha clínica, seguimiento, hoja de referencia, receta médica, orden y resultados de laboratorio, cotización y recibo de pago, con membrete de la clínica.'),
  h2('3.9 Estadísticas y apariencia'),
  p('Tablero de estadísticas con ingresos en el tiempo, laboratorios más solicitados, motivos de consulta y diagnósticos más frecuentes, medicamentos más recetados, citas por día de la semana, inasistencia y formas de pago. La aplicación ofrece modo claro y modo oscuro.'),
  h2('3.10 Respaldo de seguridad'),
  p('Desde Configuración, la Dra. descarga con un clic una copia completa de la información (expedientes, seguimientos, recetas, laboratorios, citas, cobros y cotizaciones), protegida con una contraseña y cifrada con AES-256. Toma menos de un minuto; el sistema recomienda hacerlo cada 7 días, muestra la fecha del último respaldo y avisa en la pantalla de inicio cuando toca. La copia se guarda en la memoria USB o en el Google Drive de la clínica y puede restaurarse en una base de datos nueva si fuera necesario.'),

  // 4. Usuarios
  h1('4. Usuarios y permisos'),
  p('El sistema funciona con dos usuarios con usuario y contraseña. No existe registro público: solo estas dos cuentas pueden ingresar.'),
  table(
    [2600, 6760],
    [
      ['Usuario', 'Acceso'],
      ['Dra. Delia (dra.delia)', 'Acceso total: ficha clínica, seguimiento, referencias, recetas, laboratorio, cotizaciones, agenda, caja y configuración (precios y catálogo).'],
      ['Recepción (recepcion)', 'Datos del paciente, laboratorio (órdenes, cobros, resultados), catálogo y precios de exámenes, precio de la consulta, cotizaciones, próximas citas y recetas emitidas por la Dra. (solo lectura). Sin acceso a fichas clínicas, seguimientos ni referencias.'],
    ]
  ),
  p('Ambas vistas comparten la misma base de datos en tiempo real: lo que registra recepción lo ve la Dra. y viceversa.', { after: 60 }),

  // 5. Tecnología
  h1('5. Tecnologías propuestas'),
  table(
    [2400, 2800, 4160],
    [
      ['Componente', 'Tecnología', 'Justificación'],
      ['Interfaz (frontend)', 'React 18 + Vite, Framer Motion', 'SPA rápida, animaciones fluidas, funciona en computadora, tableta y teléfono.'],
      ['Servidor (backend)', 'Node.js 24 + Express 5', 'API ligera y segura; un solo servicio sirve la aplicación y los datos.'],
      ['Base de datos', 'PostgreSQL 16 en Neon (plan gratuito)', 'Base de datos robusta y administrada: 1 GB gratuito que no vence, ubicada en Oregón (EE. UU.), junto al servidor.'],
      ['Servidor en la nube', 'Render (plan gratuito, ampliable a Starter)', 'Publica la aplicación automáticamente desde GitHub, con HTTPS incluido y sin costo mensual.'],
      ['Código fuente', 'GitHub (repositorio privado)', 'Control de versiones, historial de cambios y respaldo del código.'],
      ['Dirección y SSL', 'clinica-pasion-por-la-vida.onrender.com + SSL gratuito', 'Dirección gratuita con conexión cifrada; un dominio .com propio es opcional.'],
    ]
  ),
  gap(),
  h2('5.1 Costos operativos mensuales (no incluidos en el total)'),
  p('Se eligieron proveedores con planes gratuitos para que la operación no tenga costo mensual.'),
  table(
    [3000, 3360, 3000],
    [
      ['Servicio', 'Plan sugerido', 'Costo mensual aprox.'],
      ['Servidor (Render)', 'Free', q(0)],
      ['Base de datos (Neon)', 'Free — 1 GB, no vence', q(0)],
      ['Dirección web', 'clinica-pasion-por-la-vida.onrender.com', q(0)],
      ['Total mensual', '', q(0)],
    ],
    { totalRows: 1, alignRight: [2] }
  ),
  p('Si más adelante se desea que la aplicación nunca se duerma o tener un dominio propio, la sección 8 detalla el costo de cada ampliación. El fondo de infraestructura incluido en “Otros gastos” puede cubrir esas ampliaciones al inicio.', { after: 60 }),

  // 6. Seguridad
  h1('6. Seguridad'),
  bullet('Contraseñas cifradas con bcrypt; nunca se almacenan en texto plano.'),
  bullet('Sesión en cookie segura (HttpOnly, SameSite estricto) con expiración de 8 horas.'),
  bullet('Bloqueo temporal de la cuenta tras 5 intentos fallidos y límite de intentos de inicio de sesión.'),
  bullet('Control de permisos validado en el servidor: recepción no puede consultar información clínica aunque intente acceder directamente.'),
  bullet('Protección contra CSRF, inyección SQL (consultas parametrizadas), cabeceras de seguridad (Helmet/CSP) y conexión HTTPS.'),
  bullet('Bitácora de auditoría de accesos, cobros y cambios en expedientes.'),
  bullet('Respaldos: Neon permite deshacer cambios de las últimas 6 horas, y cada semana la Dra. descarga desde el sistema una copia cifrada completa que se guarda fuera de la nube (secciones 3.10 y 8.4).'),

  new Paragraph({ children: [new PageBreak()] }),
  // 7. Inversión
  h1('7. Detalle de la inversión'),
  h2('7.1 Desarrollo de software'),
  table([700, 6460, 2200], [['#', 'Descripción', 'Monto'], ...software.map((r) => [r[0], r[1], q(r[2])]), ['', 'Subtotal software', q(sumSw)]], { totalRows: 1, alignRight: [2] }),
  gap(),
  h2('7.2 Otros gastos: equipo, redes, infraestructura y puesta en marcha'),
  table([700, 6460, 2200], [['#', 'Descripción', 'Monto'], ...otros.map((r) => [r[0], r[1], q(r[2])]), ['', 'Subtotal otros gastos', q(sumOt)]], { totalRows: 1, alignRight: [2] }),
  gap(),
  h2('7.3 Resumen'),
  table(
    [7160, 2200],
    [
      ['Concepto', 'Monto'],
      ['Desarrollo de software', q(sumSw)],
      ['Otros gastos (equipo, redes, infraestructura, tiempo)', q(sumOt)],
      ['TOTAL DE LA INVERSIÓN', q(sumSw + sumOt)],
    ],
    { totalRows: 1, alignRight: [1] }
  ),

  // 8. Arquitectura elegida y costos de operación
  new Paragraph({ children: [new PageBreak()] }),
  h1('8. Arquitectura elegida y costos de operación'),
  p('Además de la inversión única, el sistema necesita un servidor en la nube y una base de datos para estar disponible. Para que la clínica opere al menor costo posible a lo largo de los años, se eligió el servidor en Render y la base de datos en Neon, ambos en sus planes gratuitos: Q 0.00 al año.'),

  h2('8.1 Por qué Neon para la base de datos'),
  p('Render ofrece servidor y base de datos, pero su base de datos gratuita vence a los 30 días: después hay 14 días para pasarla a un plan de pago o Render la elimina con toda la información. Mantener todo en Render obliga, por lo tanto, a pagar la base de datos. Neon ofrece una base de datos gratuita que no vence. Así se comparan ambas alternativas:'),
  table(
    [2600, 3380, 3380],
    [
      ['', 'Todo en Render (servidor gratis + base de pago)', 'Render + Neon (elegida)'],
      ['Costo anual', q(RENDER_PG_MES * 12 * TC), q(0)],
      ['Costo a 5 años', q(RENDER_PG_MES * 12 * TC * 5), q(0)],
      ['¿La base de datos vence?', 'No, mientras se pague', 'No'],
      ['Espacio incluido', '1 GB', '1 GB'],
      ['Límite de uso de la base', 'Sin límite de horas, siempre encendida', '100 horas de cómputo al mes (unas 400 horas de uso real)'],
      ['Velocidad', 'Servidor y base en la misma red', 'Prácticamente igual, con la base en la misma región que el servidor'],
      ['Recuperación ante errores', 'Respaldos del plan de pago', 'Últimas 6 horas + respaldo cifrado semanal desde el sistema'],
      ['Cuentas por administrar', 'Una', 'Dos (ambas gratuitas)'],
    ],
    { header: true }
  ),
  gap(),
  p([b('Conclusión: '), t(`Render + Neon ofrece las mismas capacidades que necesita la clínica sin costo, y ahorra unos ${q(RENDER_PG_MES * 12 * TC * 5)} en cinco años frente a mantener todo en Render. A cambio, se descarga un respaldo cifrado cada semana desde el propio sistema, con un clic (sección 3.10).`)]),

  h2('8.2 Alcance y límites de los planes gratuitos'),
  table(
    [2600, 3460, 3300],
    [
      ['Servicio', 'Qué incluye gratis', 'Limitación'],
      ['Servidor (Render Free)', '750 horas al mes, HTTPS incluido, publicación automática desde GitHub', 'Se duerme tras 15 min sin uso; la siguiente visita tarda cerca de 1 minuto en abrir'],
      ['Base de datos (Neon Free)', '1 GB de espacio, 100 horas de cómputo al mes, no vence', 'Solo permite deshacer cambios de las últimas 6 horas; se pausa tras 5 min sin uso'],
      ['Dirección web', 'clinica-pasion-por-la-vida.onrender.com', 'Sin dominio propio (.com)'],
    ]
  ),
  gap(),

  h2('8.3 Capacidad para la clínica'),
  bullet([b('Espacio: '), t(`medimos la base de datos real del sistema: cada atención completa (consulta o seguimiento, receta, cita, cobro, laboratorio y bitácora) ocupa unos ${KB_ATENCION} KB. Con 20 atenciones diarias el gigabyte gratuito alcanza para unos ${aniosCapacidad(20)} años, y aun con 50 atenciones diarias para unos ${aniosCapacidad(50)} años.`)]),
  bullet([b('Tiempo de uso: '), t('la base de datos solo cuenta horas mientras se usa y se pausa sola tras 5 minutos sin actividad. Las 100 horas de cómputo equivalen a unas 400 horas de uso real al mes, más que una jornada de 12 horas de lunes a sábado (unas 310 horas).')]),
  bullet([b('Servidor: '), t('las 750 horas gratuitas cubren el mes completo (744 horas como máximo), aun si el servidor estuviera siempre encendido.')]),

  h2('8.4 Configuración realizada y recomendaciones'),
  p('El prototipo ya opera con esta arquitectura. Este es el estado de cada elemento:'),
  table(
    [2600, 4560, 2200],
    [
      ['Elemento', 'Configuración', 'Estado'],
      ['Servidor web', 'Render Free, región Oregón, se publica solo con cada cambio en GitHub', 'Listo'],
      ['Base de datos', 'Neon Free: Postgres 16, región Oregón, 1 GB, cómputo fijo en 0.25 CU para que las horas gratuitas rindan al máximo', 'Listo'],
      ['Base de datos anterior', 'La base gratuita de Render, que vencía a los 30 días, se retiró tras pasar a Neon', 'Retirada'],
      ['Respaldo de seguridad', 'Botón en Configuración, copia cifrada, aviso cada 7 días', 'Listo'],
      ['Tarea programada', 'Visita la aplicación cada 10 min, lunes a sábado de 7:00 a. m. a 7:00 p. m.', 'Pendiente (opcional)'],
      ['Cuentas a nombre de la clínica', 'Render, Neon y GitHub con el correo de la clínica', 'Pendiente, al entregar'],
      ['Repositorio de código privado', 'Que el código en GitHub no sea público', 'Pendiente'],
      ['Dominio propio', `Opcional: ${q(DOMINIO_ANIO * TC)} al año`, 'No contratado'],
    ]
  ),
  gap(),
  h2('Recomendaciones'),
  bullet([b('Respaldo semanal: '), t('cada 7 días, la Dra. pulsa “Descargar respaldo” en Configuración (menos de un minuto) y guarda el archivo en su memoria USB o en el Google Drive de la clínica. La contraseña del respaldo debe anotarse en un lugar seguro: sin ella el archivo no se puede abrir, y no se puede recuperar. No se debe enviar el archivo por WhatsApp ni por correo.')]),
  bullet([b('Cuentas a nombre de la clínica: '), t('al entregar, los proyectos de Render y Neon y el código en GitHub se transfieren a cuentas creadas con el correo de la clínica, con contraseñas seguras y verificación en dos pasos. Así la clínica es dueña de su sistema y de sus datos.')]),
  bullet([b('Repositorio privado: '), t('el código no contiene datos de pacientes, pero conviene que sea privado; Render puede seguir publicándolo igual.')]),
  bullet([b('Sin espera en horario de atención (opcional): '), t('un servicio gratuito de tareas programadas (por ejemplo cron-job.org) visita la aplicación cada 10 minutos de lunes a sábado de 7:00 a. m. a 7:00 p. m. Así el servidor se mantiene despierto mientras la clínica trabaja (unas 310 horas al mes, dentro de las 750 gratuitas) y descansa de noche. La base de datos no se ve afectada, porque esa visita no la consulta.')]),
  bullet([b('Revisión de uso: '), t('cada pocos meses se revisa en los paneles de Render y Neon el espacio y las horas consumidas, para anticipar cualquier ampliación.')]),

  h2('8.5 Riesgos y cómo se manejan'),
  bullet([b('Uso en producción: '), t('Render indica que sus servicios gratuitos están pensados para pruebas y proyectos pequeños, no para producción, y puede reiniciarlos en cualquier momento. El sistema se recupera solo en segundos; si la clínica necesita mayor garantía, basta con pasar el servidor a Starter (sección 8.6).')]),
  bullet([b('Cambios en las condiciones: '), t('los proveedores pueden modificar o retirar sus planes gratuitos, como hizo Heroku en 2022. Si ocurre, el sistema usa tecnologías estándar (Node.js y PostgreSQL) y puede trasladarse a otro proveedor en pocas horas, sin perder información, gracias al respaldo semanal.')]),
  bullet([b('Errores que se notan tarde: '), t('si se borra o modifica información por error y se descubre después de 6 horas, se recupera desde el último respaldo semanal; por eso conviene no dejar pasar más de 7 días entre respaldos.')]),
  bullet([b('Si se superan los límites: '), t('al pasar el espacio o las horas gratuitas, el proveedor pausa el servicio hasta el mes siguiente o pide pasar a un plan de pago. Sin una tarjeta registrada no hay cobros sorpresa.')]),

  h2('8.6 Cómo ampliar si se necesita'),
  p('La arquitectura elegida permite crecer sin migrar datos ni reinstalar nada. Cada ampliación es independiente y se activa desde el panel del proveedor:'),
  table(
    [2160, 1800, 1800, 1800, 1800],
    [
      ['Concepto', ...opciones.map((o) => o.nombre)],
      ['Servidor web', ...opciones.map((o) => `${o.web}: ${q(o.webMes * 12 * TC)}`)],
      ['Base de datos', ...opciones.map((o) => `${o.db}: ${q(o.dbMes * 12 * TC)}`)],
      ['Dominio .com', ...opciones.map((o) => (o.dominio ? q(o.dominio * TC) : 'Opcional'))],
      ['App siempre despierta', ...opciones.map((o) => (o.webMes ? 'Sí' : 'En horario, con tarea programada'))],
      ['Equivalente mensual', ...opciones.map((o) => q(o.mesQ))],
      ['TOTAL ANUAL', ...opciones.map((o) => q(o.anualQ))],
    ],
    { totalRows: 1, alignRight: [1, 2, 3, 4] }
  ),
  gap(),
  bullet([b('Opción 1 · Básica: '), t('si la espera de 1 minuto fuera de horario llega a molestar, o se desea un dominio propio. Se pasa el servidor a Starter con un clic; la base de datos sigue en Neon gratis.')]),
  bullet([b('Opción 2 · Solo Render: '), t('si en el futuro se prefiere un solo proveedor y una sola factura.')]),
  bullet([b('Opción 3 · Crecimiento: '), t('si la clínica superara el espacio o las horas gratuitas de Neon. Neon cobra solo por el tiempo de uso, por lo que el costo real puede ser menor al estimado.')]),

  h2('8.7 Proyección a varios años'),
  p('Costo acumulado de operación a precios actuales (sin incluir posibles aumentos de los proveedores ni variaciones del tipo de cambio):'),
  table(
    [3360, 2000, 2000, 2000],
    [
      ['Opción', '1 año', '3 años', '5 años'],
      ...opciones.map((o) => [o.nombre, q(o.anualQ), q(o.anualQ * 3), q(o.anualQ * 5)]),
      ['Opción 0 + dominio propio', q(DOMINIO_ANIO * TC), q(DOMINIO_ANIO * TC * 3), q(DOMINIO_ANIO * TC * 5)],
    ],
    { alignRight: [1, 2, 3] }
  ),
  gap(),
  h2('Notas'),
  bullet('El prototipo de demostración ya opera con el servidor en Render y la base de datos en Neon; la información de prueba se cargó de nuevo en Neon el 6 de noviembre de 2026.'),
  bullet(`Precios y límites tomados de las páginas oficiales de Render y Neon y de comparativas públicas, consultados en noviembre de 2026, al tipo de cambio de Q ${TC.toFixed(2)} por US$. Son referenciales y deben confirmarse al contratar.`),
  bullet('El fondo de infraestructura incluido en la inversión (sección 7.2) queda como reserva para un dominio propio o para la primera ampliación de plan.'),

  // 9. Cronograma
  h1('9. Cronograma de trabajo'),
  table(
    [1800, 7560],
    [
      ['Semana', 'Actividades'],
      ['Semana 1', 'Requerimientos, diseño de pantallas y modelo de base de datos.'],
      ['Semana 2', 'Backend, seguridad, usuarios, pacientes, ficha clínica y seguimiento.'],
      ['Semana 3', 'Laboratorio, cotizaciones, caja, agenda, referencias y documentos imprimibles.'],
      ['Semana 4', 'Pruebas con datos reales, instalación de red y equipo, configuración de Render y Neon, capacitación y entrega.'],
    ]
  ),
  p('Tiempo estimado total: 4 semanas a partir de la aprobación de la cotización.', { after: 60 }),

  // 9. Condiciones
  h1('10. Condiciones comerciales'),
  bullet([b('Forma de pago: '), t('pago único de Q 8,000.00 contra entrega e instalación del sistema. No se requiere anticipo.')]),
  bullet([b('Garantía: '), t('3 meses de corrección de errores sin costo a partir de la entrega.')]),
  bullet([b('Entregables: '), t('aplicación publicada en Render con su base de datos en Neon, cuentas a nombre de la clínica, botón de respaldo cifrado con su procedimiento de restauración, tarea programada de horario (opcional), código fuente en GitHub, usuarios y contraseñas, manual de uso y documentación técnica.')]),
  bullet([b('Propiedad: '), t('el código y los datos son propiedad de la clínica.')]),
  h2('No incluye'),
  bullet('Costos de ampliaciones opcionales de los proveedores (servidor Starter, base de datos de pago o dominio propio); la arquitectura elegida no tiene costo. Ver la sección 8.6.'),
  bullet('Computadoras, impresoras o mobiliario.'),
  bullet('Módulos fuera del alcance de la Fase 1 (facturación electrónica FEL, inventario de farmacia, portal de pacientes, mensajes por WhatsApp), que se cotizarán por separado.'),
];

const doc = new Document({
  creator: 'Clínica Médica Pasión por la Vida',
  title: 'Cotización — Sistema de Gestión Clínica',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: {
    config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }],
  },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Clínica Médica Pasión por la Vida · Cotización CMPV-2026-001', font: FONT, size: 16, color: '8A94A6' })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '8A94A6' })] })],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log('ok', out);
});
