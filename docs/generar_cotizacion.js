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
  ['5', 'Fondo de infraestructura en la nube (primeros meses de hosting y base de datos)', 300],
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
  { nombre: 'Opción 0 · Gratuita', web: 'Render Free', webMes: 0, db: 'Neon Free', dbMes: 0, dominio: 0 },
  { nombre: 'Opción 1 · Básica', web: 'Render Starter', webMes: WEB_MES, db: 'Neon Free', dbMes: 0, dominio: DOMINIO_ANIO },
  { nombre: 'Opción 2 · Todo en Render', web: 'Render Starter', webMes: WEB_MES, db: 'Render Postgres', dbMes: RENDER_PG_MES, dominio: DOMINIO_ANIO },
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
  bullet([b('Información segura y siempre a la mano: '), t('cada persona entra con su usuario y contraseña, los datos se respaldan automáticamente y se pueden consultar desde cualquier computadora, tableta o teléfono.')]),
  bullet([b('Un mejor control de la clínica: '), t('ingresos del día, exámenes más solicitados y estadísticas claras para tomar mejores decisiones.')]),
  bullet([b('Una imagen más profesional: '), t('recetas, fichas, cotizaciones y recibos impresos con el membrete de la clínica.')]),
  bullet([b('Fácil y agradable de usar: '), t('un diseño moderno y limpio, con modo claro y oscuro, pensado para que el personal lo aprenda en minutos.')]),
  p([b('Inversión total: Q 8,000.00, '), t('en un solo pago al momento de la entrega, sin anticipo. Incluye el sistema completo (Q 6,000.00) y el equipo, la red y la puesta en marcha (Q 2,000.00).')]),

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
      ['Base de datos', 'PostgreSQL 16 en Neon (alternativa: Supabase)', 'Base de datos relacional robusta, administrada, con respaldos y plan gratuito para iniciar.'],
      ['Hosting', 'Render o Railway (contenedor Node.js)', 'Despliegue automático desde GitHub, HTTPS incluido y costo mensual bajo.'],
      ['Código fuente', 'GitHub (repositorio privado)', 'Control de versiones, historial de cambios y respaldo del código.'],
      ['Dominio y SSL', 'Dominio .com + certificado SSL gratuito', 'Acceso con dirección propia y conexión cifrada.'],
    ]
  ),
  gap(),
  h2('5.1 Costos operativos mensuales estimados (no incluidos en el total)'),
  p('Se eligieron proveedores con planes gratuitos o de bajo costo para que la operación no resulte cara. Valores referenciales al tipo de cambio aproximado de Q 7.75 por US$; deben confirmarse con cada proveedor al contratar.'),
  table(
    [3000, 3360, 3000],
    [
      ['Servicio', 'Plan sugerido', 'Costo mensual aprox.'],
      ['Base de datos Neon', 'Free (1 GB) — no vence', q(0)],
      ['Hosting Render', `Free (se duerme) o Starter siempre activo (${usd(WEB_MES)})`, `${q(0)} – ${q(WEB_MES * TC)}`],
      ['Dominio .com', `Opcional, ~${usd(DOMINIO_ANIO)} al año (prorrateado)`, `${q(0)} – ${q((DOMINIO_ANIO * TC) / 12)}`],
      ['Total estimado', '', `${q(0)} – ${q(opciones[1].mesQ)}`],
    ],
    { totalRows: 1, alignRight: [2] }
  ),
  p('El fondo de infraestructura incluido en “Otros gastos” cubre el dominio del primer año o los primeros meses de un plan de pago. Existe una opción totalmente gratuita; el detalle y la proyección a varios años están en la sección 8.', { after: 60 }),

  // 6. Seguridad
  h1('6. Seguridad'),
  bullet('Contraseñas cifradas con bcrypt; nunca se almacenan en texto plano.'),
  bullet('Sesión en cookie segura (HttpOnly, SameSite estricto) con expiración de 8 horas.'),
  bullet('Bloqueo temporal de la cuenta tras 5 intentos fallidos y límite de intentos de inicio de sesión.'),
  bullet('Control de permisos validado en el servidor: recepción no puede consultar información clínica aunque intente acceder directamente.'),
  bullet('Protección contra CSRF, inyección SQL (consultas parametrizadas), cabeceras de seguridad (Helmet/CSP) y conexión HTTPS.'),
  bullet('Bitácora de auditoría de accesos, cobros y cambios en expedientes.'),
  bullet('Respaldos automáticos de la base de datos provistos por Neon/Supabase.'),

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

  // 8. Costos anuales de operación
  new Paragraph({ children: [new PageBreak()] }),
  h1('8. Costos anuales de operación (estimado)'),
  p('Además de la inversión única, el sistema necesita un servidor en la nube y una base de datos para estar disponible. Estos servicios se pagan aparte, directamente al proveedor, y no forman parte de los Q 8,000.00. La clínica puede elegir entre operar gratis o pagar por más comodidad; esta sección explica cada opción y cuánto cuesta a lo largo de los años.'),

  h2('8.1 Opción 0 · Gratuita: Q 0.00 al año'),
  p('Usa los planes gratuitos de Render (servidor) y Neon (base de datos), y la dirección gratuita clinica-pasion-por-la-vida.onrender.com. No requiere tarjeta de crédito ni pagos mensuales.'),
  table(
    [2600, 3460, 3300],
    [
      ['Servicio', 'Qué incluye gratis', 'Limitación'],
      ['Servidor (Render Free)', '750 horas al mes, HTTPS incluido', 'Se duerme tras 15 min sin uso; la siguiente visita tarda cerca de 1 minuto en abrir'],
      ['Base de datos (Neon Free)', '1 GB de espacio, 100 horas de cómputo al mes, no vence', 'Solo permite recuperar cambios de las últimas 6 horas'],
      ['Dirección web', 'clinica-pasion-por-la-vida.onrender.com', 'Sin dominio propio (.com)'],
    ]
  ),
  gap(),
  h2('¿Le alcanza a la clínica?'),
  bullet([b('Espacio: '), t(`medimos la base de datos real del sistema: cada atención completa (consulta o seguimiento, receta, cita, cobro, laboratorio y bitácora) ocupa unos ${KB_ATENCION} KB. Con 20 atenciones diarias el gigabyte gratuito alcanza para unos ${aniosCapacidad(20)} años, y aun con 50 atenciones diarias para unos ${aniosCapacidad(50)} años.`)]),
  bullet([b('Tiempo de uso: '), t('la base de datos solo cuenta horas mientras se usa y se pausa sola tras 5 minutos sin actividad. Las 100 horas de cómputo equivalen a unas 400 horas de uso real al mes, más que una jornada de 12 horas diarias de lunes a sábado (unas 310 horas).')]),
  bullet([b('Servidor: '), t('las 750 horas gratuitas cubren el mes completo (744 horas como máximo), aun si el servidor estuviera siempre encendido.')]),
  h2('Cómo aprovecharla al máximo'),
  bullet([b('Evitar la espera de 1 minuto en horario de atención: '), t('un servicio gratuito de tareas programadas (por ejemplo cron-job.org) puede visitar la app cada 10 minutos de lunes a sábado de 7:00 a. m. a 7:00 p. m. Así el servidor se mantiene despierto mientras la clínica trabaja (unas 310 horas al mes, dentro de las 750 gratuitas) y descansa de noche. La base de datos no se ve afectada porque esa visita no la consulta.')]),
  bullet([b('Respaldo mensual: '), t('como el plan gratuito solo guarda 6 horas de historial, se recomienda descargar una copia completa de la base de datos una vez al mes (toma unos minutos) y guardarla en una memoria o en la nube privada de la clínica.')]),
  bullet([b('Dominio propio opcional: '), t(`si se desea una dirección como pasionporlavida.com, el único costo es el dominio: ${q(DOMINIO_ANIO * TC)} al año. El fondo de infraestructura de la inversión lo cubre por los primeros años.`)]),
  h2('Riesgos y cómo se manejan'),
  bullet([b('Uso en producción: '), t('Render indica que sus servicios gratuitos están pensados para pruebas y proyectos pequeños, no para producción, y puede reiniciarlos en cualquier momento (el sistema se recupera solo en segundos).')]),
  bullet([b('Cambios en las condiciones: '), t('los proveedores pueden modificar o retirar sus planes gratuitos, como hizo Heroku en 2022. Si ocurre, el sistema usa tecnologías estándar (Node.js y PostgreSQL) y puede trasladarse a otro proveedor en pocas horas, sin perder información.')]),
  bullet([b('Si se superan los límites: '), t('al pasar el espacio o las horas gratuitas, el proveedor pausa el servicio hasta el mes siguiente o pide pasar a un plan de pago; no hay cobros sorpresa sin una tarjeta registrada.')]),
  h2('Cuándo subir de plan'),
  p('Si la espera al abrir llega a molestar, o la clínica crece mucho, se pasa a la Opción 1 con un solo clic en Render (cambiar el servidor a Starter). No hay que migrar datos ni reinstalar nada: la base de datos sigue siendo la misma.'),

  h2('8.2 Comparación de opciones (costo anual)'),
  table(
    [2160, 1800, 1800, 1800, 1800],
    [
      ['Concepto', ...opciones.map((o) => o.nombre)],
      ['Servidor web', ...opciones.map((o) => `${o.web}: ${q(o.webMes * 12 * TC)}`)],
      ['Base de datos', ...opciones.map((o) => `${o.db}: ${q(o.dbMes * 12 * TC)}`)],
      ['Dominio .com', ...opciones.map((o) => (o.dominio ? q(o.dominio * TC) : 'Opcional'))],
      ['App siempre despierta', ...opciones.map((o) => (o.webMes ? 'Sí' : 'En horario, con tarea programada'))],
      ['HTTPS', ...opciones.map(() => 'Incluido')],
      ['Equivalente mensual', ...opciones.map((o) => q(o.mesQ))],
      ['TOTAL ANUAL', ...opciones.map((o) => q(o.anualQ))],
    ],
    { totalRows: 1, alignRight: [1, 2, 3, 4] }
  ),
  gap(),
  h2('8.3 Proyección a varios años'),
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
  h2('¿Cuál conviene?'),
  bullet([b('Opción 0 · Gratuita (recomendada para el menor costo): '), t('Q 0.00 al año. Funciona para el volumen de una clínica como esta durante muchos años; solo requiere la tarea programada y el respaldo mensual descritos arriba.')]),
  bullet([b('Opción 1 · Básica: '), t('para que la app abra siempre al instante, a cualquier hora, y con dominio propio. Es la misma Opción 0 con el servidor de pago.')]),
  bullet([b('Opción 2 · Todo en Render: '), t('servidor y base de datos con un solo proveedor y una sola factura, con respaldos automáticos.')]),
  bullet([b('Opción 3 · Crecimiento: '), t('para cuando la clínica supere el espacio gratuito o tenga mucho más movimiento. Neon cobra solo por el tiempo de uso, por lo que el costo real puede ser menor al estimado.')]),
  h2('Notas'),
  bullet('El prototipo de demostración actual usa la base de datos gratuita de Render, que vence a los 30 días de creada. Para operar con la Opción 0, la base de datos se traslada a Neon Free antes de esa fecha.'),
  bullet(`Precios y límites tomados de las páginas oficiales de Render y Neon y de comparativas públicas, consultados en noviembre de 2026, al tipo de cambio de Q ${TC.toFixed(2)} por US$. Son referenciales y deben confirmarse al contratar.`),
  bullet('El fondo de infraestructura incluido en la inversión (sección 7.2) puede destinarse al dominio propio o a los primeros meses de un plan de pago, según la opción elegida.'),

  // 9. Cronograma
  h1('9. Cronograma de trabajo'),
  table(
    [1800, 7560],
    [
      ['Semana', 'Actividades'],
      ['Semana 1', 'Requerimientos, diseño de pantallas y modelo de base de datos.'],
      ['Semana 2', 'Backend, seguridad, usuarios, pacientes, ficha clínica y seguimiento.'],
      ['Semana 3', 'Laboratorio, cotizaciones, caja, agenda, referencias y documentos imprimibles.'],
      ['Semana 4', 'Pruebas con datos reales, instalación de red y equipo, despliegue, capacitación y entrega.'],
    ]
  ),
  p('Tiempo estimado total: 4 semanas a partir de la aprobación de la cotización.', { after: 60 }),

  // 9. Condiciones
  h1('10. Condiciones comerciales'),
  bullet([b('Forma de pago: '), t('pago único de Q 8,000.00 contra entrega e instalación del sistema. No se requiere anticipo.')]),
  bullet([b('Garantía: '), t('3 meses de corrección de errores sin costo a partir de la entrega.')]),
  bullet([b('Entregables: '), t('aplicación en producción, código fuente en GitHub, usuarios y contraseñas, manual de uso y documentación técnica.')]),
  bullet([b('Propiedad: '), t('el código y los datos son propiedad de la clínica.')]),
  h2('No incluye'),
  bullet('Costos de operación en la nube si se elige un plan de pago (servidor, base de datos o dominio); la Opción 0 no tiene costo. Ver la sección 8.'),
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
