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
  ['5', 'Fondo de infraestructura en la nube (reserva para 12 meses de hosting)', 300],
  ['6', 'Capacitación presencial adicional y manuales impresos', 200],
  ['7', 'Transporte, visitas técnicas y tiempo de puesta en marcha en sitio', 200],
];
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
      ['Base de datos Neon', 'Free (0.5 GB) — suficiente para iniciar', 'Q 0.00'],
      ['Hosting Render / Railway', 'Plan inicial siempre activo (~US$ 5–7)', 'Q 40.00 – Q 55.00'],
      ['Dominio .com', '~US$ 12 al año (prorrateado)', 'Q 8.00'],
      ['Total estimado', '', 'Q 48.00 – Q 63.00'],
    ],
    { totalRows: 1, alignRight: [2] }
  ),
  p('El primer año de hosting queda cubierto con el fondo de infraestructura incluido en “Otros gastos”. Si la clínica crece, Neon y Supabase permiten escalar a planes de pago sin migrar datos.', { after: 60 }),

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

  // 8. Cronograma
  h1('8. Cronograma de trabajo'),
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
  h1('9. Condiciones comerciales'),
  bullet([b('Forma de pago: '), t('pago único de Q 8,000.00 contra entrega e instalación del sistema. No se requiere anticipo.')]),
  bullet([b('Garantía: '), t('3 meses de corrección de errores sin costo a partir de la entrega.')]),
  bullet([b('Entregables: '), t('aplicación en producción, código fuente en GitHub, usuarios y contraseñas, manual de uso y documentación técnica.')]),
  bullet([b('Propiedad: '), t('el código y los datos son propiedad de la clínica.')]),
  h2('No incluye'),
  bullet('Costos mensuales de hosting y dominio posteriores al primer año.'),
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
