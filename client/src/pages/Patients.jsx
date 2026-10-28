import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, UserPlus, Users, CalendarClock, FileHeart } from 'lucide-react';
import { useAuth } from '../context.jsx';
import { ageLabel, fmtDateTime, fullName, genderLabel } from '../utils.js';
import { Avatar, Badge, Button, Empty, LoadingList, PageHead } from '../components/ui.jsx';
import { PatientFormModal, usePatientSearch } from '../components/PatientWidgets.jsx';

export default function Patients() {
  const { isDoctor } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const { results, loading } = usePatientSearch(q);

  return (
    <>
      <PageHead title="Pacientes" subtitle="Busque expedientes por nombre completo, iniciales, teléfono o DPI">
        <Button icon={UserPlus} onClick={() => setCreating(true)}>
          Nuevo paciente
        </Button>
      </PageHead>

      <div className="card">
        <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
          <div className="input-wrap">
            <Search size={17} />
            <input
              className="input"
              style={{ height: 46, fontSize: 15 }}
              autoFocus
              placeholder="Ej. “María José López”, “MJLP” o “5512”"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        {loading && !results.length ? (
          <LoadingList rows={6} />
        ) : results.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Iniciales</th>
                <th>Edad</th>
                <th>Teléfono</th>
                <th>Próxima cita</th>
                {isDoctor && <th>Expediente</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((p, i) => (
                <motion.tr key={p.id} className="clickable" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.008, 0.06), duration: 0.12 }} onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Avatar patient={p} size={36} />
                      <div>
                        <div className="strong">{fullName(p)}</div>
                        <div className="small muted">{genderLabel(p.gender)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="chip mono">{p.initials}</span>
                  </td>
                  <td>{ageLabel(p.birth_date)}</td>
                  <td className="mono">{p.phone || '—'}</td>
                  <td>
                    {p.next_appointment ? (
                      <span className="row" style={{ gap: 6 }}>
                        <CalendarClock size={14} color="var(--blue)" /> {fmtDateTime(p.next_appointment)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {isDoctor && (
                    <td>
                      {p.has_record ? (
                        <Badge tone="tone-blue" icon={FileHeart}>
                          Ficha + {p.followups_count} seg.
                        </Badge>
                      ) : p.lab_count ? (
                        <Badge tone="tone-purple">Solo laboratorio</Badge>
                      ) : (
                        <Badge>Sin ficha</Badge>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon={Users} title="No se encontraron pacientes" text="Intente con otro nombre o iniciales, o registre un paciente nuevo.">
            <Button variant="tinted" icon={UserPlus} onClick={() => setCreating(true)}>
              Registrar paciente
            </Button>
          </Empty>
        )}
      </div>

      <PatientFormModal open={creating} initialName={q} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/pacientes/${p.id}`)} />
    </>
  );
}
