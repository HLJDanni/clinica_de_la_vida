import { ageLabel, fmtDate, fmtDateTime, fullName, genderLabel, money, PATIENT_TYPES, PAY_METHODS } from '../utils.js';
import { computeImc, computePregnancy, examToText, PEDIATRIC, PREGNANCY, SYSTEMS, VITALS } from './ExamForm.jsx';

function Letterhead({ settings }) {
  return (
    <div className="doc-head">
      <img src="/logo.svg" alt="" />
      <div>
        <div className="clinic">Clínica Médica Pasión por la Vida</div>
        <div className="dr">
          {settings.doctor_name || 'Dra. Delia'} · {settings.doctor_title || 'Médico y Cirujano'}
          {settings.doctor_license ? ` · ${settings.doctor_license}` : ''}
        </div>
      </div>
      <div className="contact">
        {settings.clinic_address}
        <br />
        Tel. {settings.clinic_phone}
      </div>
    </div>
  );
}

function PatientBox({ patient, date, extra }) {
  return (
    <div className="doc-box">
      <div className="doc-grid">
        <div style={{ gridColumn: 'span 2' }}>
          <b>Paciente:</b> {fullName(patient)}
        </div>
        <div>
          <b>Fecha:</b> {fmtDate(date || new Date())}
        </div>
        <div>
          <b>Edad:</b> {ageLabel(patient.birth_date)}
        </div>
        <div>
          <b>Género:</b> {genderLabel(patient.gender)}
        </div>
        <div>
          <b>Teléfono:</b> {patient.phone || '—'}
        </div>
        {patient.address !== undefined && (
          <div style={{ gridColumn: 'span 2' }}>
            <b>Dirección:</b> {patient.address || '—'}
          </div>
        )}
        {patient.religion !== undefined && (
          <div>
            <b>Religión:</b> {patient.religion || '—'}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}

const Sec = ({ title, children }) => (
  <div className="doc-sec">
    <h4>{title}</h4>
    <div>{children || '—'}</div>
  </div>
);

function ExamTable({ exam = {}, type }) {
  const imc = computeImc(exam);
  const preg = computePregnancy(exam);
  const vit = VITALS.filter((v) => exam[v.k]);
  return (
    <div className="doc-sec">
      <h4>Examen físico</h4>
      {(vit.length > 0 || imc) && (
        <table className="doc-table" style={{ marginBottom: 6 }}>
          <tbody>
            <tr>
              {vit.map((v) => (
                <th key={v.k}>{v.label}</th>
              ))}
              {imc && <th>IMC</th>}
            </tr>
            <tr>
              {vit.map((v) => (
                <td key={v.k}>
                  {exam[v.k]} {v.suffix}
                </td>
              ))}
              {imc && <td>{imc.value} ({imc.cls})</td>}
            </tr>
          </tbody>
        </table>
      )}
      {type === 'embarazada' && (
        <div style={{ marginBottom: 4 }}>
          <b>Obstétrico: </b>
          {PREGNANCY.filter((f) => exam[f.k])
            .map((f) => `${f.label}: ${f.k === 'fur' ? fmtDate(exam[f.k]) : exam[f.k]}${f.suffix ? ` ${f.suffix}` : ''}`)
            .join(' · ')}
          {preg && ` · Edad gestacional: ${preg.eg} · FPP: ${fmtDate(preg.fpp)}`}
        </div>
      )}
      {type === 'pediatrico' &&
        PEDIATRIC.filter((f) => exam[f.k]).map((f) => (
          <div key={f.k}>
            <b>{f.label.replace(/[¿?]/g, '')}: </b>
            {exam[f.k]} {f.suffix}
          </div>
        ))}
      {SYSTEMS.filter((s) => exam[s.k]).map((s) => (
        <div key={s.k}>
          <b>{s.label.replace(/[¿?]/g, '').replace('Cuál es el estado general del paciente', 'Estado general')}: </b>
          {exam[s.k]}
        </div>
      ))}
    </div>
  );
}

const Sign = ({ settings }) => (
  <div className="doc-sign">
    <div>
      {settings.doctor_name || 'Dra. Delia'}
      <br />
      <span style={{ fontSize: '9pt', color: '#555' }}>{settings.doctor_title || 'Médico y Cirujano'}</span>
    </div>
  </div>
);
const Foot = () => <div className="doc-foot">Clínica Médica Pasión por la Vida · Documento generado el {fmtDateTime(new Date())}</div>;

export function FichaDoc({ patient, record, settings }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">Ficha clínica — Consulta #1</div>
      <PatientBox
        patient={patient}
        date={record.created_at}
        extra={
          <div>
            <b>Tipo:</b> {PATIENT_TYPES[record.patient_type]?.label}
          </div>
        }
      />
      <div className="doc-sec">
        <h4>Antecedentes</h4>
        <table className="doc-table">
          <tbody>
            {[
              ['Médicos', patient.ant_medicos],
              ['Quirúrgicos', patient.ant_quirurgicos],
              ['Traumáticos', patient.ant_traumaticos],
              ['Alergias', patient.ant_alergias],
              ['Familiares', patient.ant_familiares],
            ].map(([k, v]) => (
              <tr key={k}>
                <th style={{ width: 130 }}>{k}</th>
                <td>{v || 'Niega'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sec title="Motivo de consulta">{record.motivo_consulta}</Sec>
      <Sec title="Historia de la enfermedad">{record.historia_enfermedad}</Sec>
      <ExamTable exam={record.examen_fisico} type={record.patient_type} />
      <Sec title="Estudios">{record.estudios}</Sec>
      <Sec title="Diagnóstico">{record.diagnostico}</Sec>
      <Sec title="Tratamiento">{record.tratamiento}</Sec>
      <Sec title="Referencia">{record.referencia}</Sec>
      <Sec title="Comentarios">{record.comentarios}</Sec>
      <Sign settings={settings} />
      <Foot />
    </div>
  );
}

export function SeguimientoDoc({ patient, fu, settings }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">Seguimiento de caso — Consulta #{fu.visit_number}</div>
      <PatientBox
        patient={patient}
        date={fu.created_at}
        extra={
          <div>
            <b>Tipo:</b> {PATIENT_TYPES[fu.patient_type]?.label}
          </div>
        }
      />
      <Sec title="Motivo de la visita">{fu.motivo}</Sec>
      <Sec title="Evolución">{fu.evolucion}</Sec>
      <ExamTable exam={fu.examen_fisico} type={fu.patient_type} />
      <Sec title="Estudios">{fu.estudios}</Sec>
      <Sec title="Diagnóstico">{fu.diagnostico}</Sec>
      <Sec title="Tratamiento">{fu.tratamiento}</Sec>
      <Sec title="Comentarios">{fu.comentarios}</Sec>
      <Sign settings={settings} />
      <Foot />
    </div>
  );
}

export function ReferenciaDoc({ patient, refl, settings }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">Hoja de referencia</div>
      <PatientBox patient={patient} date={refl.created_at} />
      <div className="doc-box">
        <b style={{ color: '#1a3d80' }}>Referido a:</b> {refl.referido_a}
        {refl.especialidad && (
          <>
            {' '}
            · <b style={{ color: '#1a3d80' }}>Especialidad:</b> {refl.especialidad}
          </>
        )}
      </div>
      <Sec title="Motivo de la referencia">{refl.motivo}</Sec>
      <Sec title="Historia de la enfermedad">{refl.historia_enfermedad}</Sec>
      <Sec title="Examen físico">{refl.examen_fisico}</Sec>
      <Sec title="Impresión clínica">{refl.impresion_clinica}</Sec>
      <Sec title="Estudios realizados">{refl.estudios_realizados}</Sec>
      <Sec title="Tratamiento">{refl.tratamiento}</Sec>
      <Sec title="Comentario">{refl.comentario}</Sec>
      <Sign settings={settings} />
      <Foot />
    </div>
  );
}

export function RecetaDoc({ patient, rx, settings }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">Receta médica</div>
      <PatientBox patient={{ ...patient, address: undefined, religion: undefined }} date={rx.created_at} />
      <div style={{ fontSize: '22pt', fontWeight: 800, color: '#2160cc', margin: '4px 0' }}>℞</div>
      {rx.items.map((it, i) => (
        <div key={i} className="rx-item">
          <b>
            {i + 1}. {it.medicamento}
          </b>
          {it.presentacion && ` — ${it.presentacion}`}
          <div style={{ color: '#333' }}>
            {[it.dosis, it.frecuencia, it.duracion && `por ${it.duracion}`].filter(Boolean).join(' · ')}
          </div>
        </div>
      ))}
      {rx.indicaciones && <Sec title="Indicaciones">{rx.indicaciones}</Sec>}
      <Sign settings={settings} />
      <Foot />
    </div>
  );
}

export function CotizacionDoc({ quote, settings }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">Cotización #{String(quote.id).padStart(5, '0')}</div>
      <div className="doc-box">
        <div className="doc-grid">
          <div style={{ gridColumn: 'span 2' }}>
            <b>Cliente:</b> {quote.customer_name}
          </div>
          <div>
            <b>Fecha:</b> {fmtDate(quote.created_at)}
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <b>Teléfono:</b> {quote.customer_phone || '—'}
          </div>
          <div>
            <b>Válida hasta:</b> {fmtDate(quote.valid_until)}
          </div>
        </div>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th style={{ width: 60, textAlign: 'center' }}>Cant.</th>
            <th style={{ width: 110, textAlign: 'right' }}>Precio</th>
            <th style={{ width: 110, textAlign: 'right' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td style={{ textAlign: 'center' }}>{it.qty}</td>
              <td style={{ textAlign: 'right' }}>{money(it.price)}</td>
              <td style={{ textAlign: 'right' }}>{money(it.price * it.qty)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ textAlign: 'right' }}>
              Subtotal
            </td>
            <td style={{ textAlign: 'right' }}>{money(quote.subtotal)}</td>
          </tr>
          {quote.discount_pct > 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'right' }}>
                Descuento ({quote.discount_pct}%)
              </td>
              <td style={{ textAlign: 'right' }}>− {money(quote.subtotal - quote.total)}</td>
            </tr>
          )}
          <tr>
            <th colSpan={3} style={{ textAlign: 'right' }}>
              TOTAL
            </th>
            <th style={{ textAlign: 'right', fontSize: '12.5pt' }}>{money(quote.total)}</th>
          </tr>
        </tbody>
      </table>
      {quote.notes && <Sec title="Observaciones">{quote.notes}</Sec>}
      <p style={{ fontSize: '9.5pt', color: '#555', marginTop: 14 }}>
        Precios en quetzales (GTQ), sujetos a cambio sin previo aviso después de la fecha de validez. Algunos exámenes requieren ayuno; consulte las indicaciones en recepción.
      </p>
      <Foot />
    </div>
  );
}

export function LabOrderDoc({ order, settings, withResults }) {
  return (
    <div className="doc">
      <Letterhead settings={settings} />
      <div className="doc-title">{withResults ? 'Resultados de laboratorio' : 'Orden de laboratorio'} #{String(order.id).padStart(5, '0')}</div>
      <PatientBox patient={order} date={order.created_at} />
      <table className="doc-table">
        <thead>
          <tr>
            <th>Examen</th>
            {withResults ? <th>Resultado</th> : <th style={{ width: 120, textAlign: 'right' }}>Precio</th>}
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id}>
              <td style={{ width: withResults ? 240 : undefined }}>{it.name}</td>
              {withResults ? <td style={{ whiteSpace: 'pre-wrap' }}>{it.result || 'Pendiente'}</td> : <td style={{ textAlign: 'right' }}>{money(it.price)}</td>}
            </tr>
          ))}
          {!withResults && (
            <tr>
              <th style={{ textAlign: 'right' }}>TOTAL</th>
              <th style={{ textAlign: 'right' }}>{money(order.total)}</th>
            </tr>
          )}
        </tbody>
      </table>
      {!withResults && (
        <p style={{ marginTop: 10 }}>
          <b>Estado de pago:</b> {order.payment_status === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
        </p>
      )}
      {withResults && <Sign settings={settings} />}
      <Foot />
    </div>
  );
}

export function ReciboDoc({ payment, patient, settings }) {
  return (
    <div className="doc" style={{ maxWidth: 520, margin: '0 auto' }}>
      <Letterhead settings={settings} />
      <div className="doc-title">Recibo de pago #{String(payment.id).padStart(5, '0')}</div>
      <table className="doc-table">
        <tbody>
          <tr>
            <th>Fecha</th>
            <td>{fmtDateTime(payment.created_at)}</td>
          </tr>
          <tr>
            <th>Recibido de</th>
            <td>{patient ? fullName(patient) : 'Cliente'}</td>
          </tr>
          <tr>
            <th>Concepto</th>
            <td>{payment.description || payment.concept}</td>
          </tr>
          <tr>
            <th>Forma de pago</th>
            <td>{PAY_METHODS[payment.method]}</td>
          </tr>
          <tr>
            <th>Monto</th>
            <td style={{ fontSize: '14pt', fontWeight: 800 }}>{money(payment.amount)}</td>
          </tr>
        </tbody>
      </table>
      <Foot />
    </div>
  );
}

export { examToText };
