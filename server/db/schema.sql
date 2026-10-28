-- Clínica Médica Pasión por la Vida — esquema PostgreSQL
-- Compatible con PostgreSQL 14+ (Neon, Supabase, local)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('doctor', 'reception')),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Datos generales del paciente (compartidos entre Recepción y Dra.)
CREATE TABLE IF NOT EXISTS patients (
  id              SERIAL PRIMARY KEY,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  birth_date      DATE,
  gender          TEXT CHECK (gender IN ('F', 'M')),
  address         TEXT,
  phone           TEXT,
  religion        TEXT,
  dpi             TEXT,
  -- Búsqueda por iniciales y nombre completo (sin tildes)
  initials        TEXT NOT NULL,
  search_name     TEXT NOT NULL,
  -- Antecedentes (solo visibles para la Dra.)
  ant_medicos     TEXT,
  ant_quirurgicos TEXT,
  ant_traumaticos TEXT,
  ant_alergias    TEXT,
  ant_familiares  TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patients_search_trgm ON patients USING gin (search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_initials_idx ON patients (initials);

-- Ficha clínica: consulta #1 (una por paciente)
CREATE TABLE IF NOT EXISTS clinical_records (
  id                  SERIAL PRIMARY KEY,
  patient_id          INT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  patient_type        TEXT NOT NULL DEFAULT 'adulto' CHECK (patient_type IN ('adulto', 'pediatrico', 'embarazada')),
  motivo_consulta     TEXT,
  historia_enfermedad TEXT,
  examen_fisico       JSONB NOT NULL DEFAULT '{}'::jsonb,
  estudios            TEXT,
  diagnostico         TEXT,
  tratamiento         TEXT,
  referencia          TEXT,
  comentarios         TEXT,
  created_by          INT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seguimiento de caso: una ficha por visita posterior
CREATE TABLE IF NOT EXISTS follow_ups (
  id            SERIAL PRIMARY KEY,
  patient_id    INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  record_id     INT REFERENCES clinical_records(id) ON DELETE SET NULL,
  visit_number  INT NOT NULL,
  patient_type  TEXT NOT NULL DEFAULT 'adulto' CHECK (patient_type IN ('adulto', 'pediatrico', 'embarazada')),
  motivo        TEXT,
  evolucion     TEXT,
  examen_fisico JSONB NOT NULL DEFAULT '{}'::jsonb,
  estudios      TEXT,
  diagnostico   TEXT,
  tratamiento   TEXT,
  comentarios   TEXT,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS follow_ups_patient_idx ON follow_ups (patient_id, created_at DESC);

-- Hoja de referencia
CREATE TABLE IF NOT EXISTS referrals (
  id                  SERIAL PRIMARY KEY,
  patient_id          INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  referido_a          TEXT NOT NULL,
  especialidad        TEXT,
  motivo              TEXT,
  historia_enfermedad TEXT,
  examen_fisico       TEXT,
  comentario          TEXT,
  tratamiento         TEXT,
  impresion_clinica   TEXT,
  estudios_realizados TEXT,
  created_by          INT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_patient_idx ON referrals (patient_id, created_at DESC);

-- Catálogo de exámenes de laboratorio
CREATE TABLE IF NOT EXISTS lab_exams (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sample     TEXT,
  turnaround TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Órdenes de laboratorio (desde consulta o directo en recepción)
CREATE TABLE IF NOT EXISTS lab_orders (
  id             SERIAL PRIMARY KEY,
  patient_id     INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  origin         TEXT NOT NULL DEFAULT 'recepcion' CHECK (origin IN ('consulta', 'recepcion')),
  status         TEXT NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'en_proceso', 'completado', 'cancelado')),
  payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'pagado')),
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     INT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS lab_orders_patient_idx ON lab_orders (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lab_order_items (
  id        SERIAL PRIMARY KEY,
  order_id  INT NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  exam_id   INT REFERENCES lab_exams(id) ON DELETE SET NULL,
  exam_name TEXT NOT NULL,
  price     NUMERIC(10,2) NOT NULL,
  result    TEXT
);

-- Cobros (consultas, laboratorio y otros)
CREATE TABLE IF NOT EXISTS payments (
  id           SERIAL PRIMARY KEY,
  patient_id   INT REFERENCES patients(id) ON DELETE SET NULL,
  concept      TEXT NOT NULL CHECK (concept IN ('consulta', 'laboratorio', 'otro')),
  lab_order_id INT REFERENCES lab_orders(id) ON DELETE SET NULL,
  description  TEXT,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method       TEXT NOT NULL CHECK (method IN ('efectivo', 'tarjeta', 'transferencia')),
  received_by  INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_created_idx ON payments (created_at DESC);

-- Cotizaciones de varios exámenes
CREATE TABLE IF NOT EXISTS quotes (
  id             SERIAL PRIMARY KEY,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT,
  patient_id     INT REFERENCES patients(id) ON DELETE SET NULL,
  subtotal       NUMERIC(10,2) NOT NULL,
  discount_pct   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  total          NUMERIC(10,2) NOT NULL,
  notes          TEXT,
  valid_until    DATE NOT NULL,
  converted_order_id INT REFERENCES lab_orders(id) ON DELETE SET NULL,
  created_by     INT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id       SERIAL PRIMARY KEY,
  quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  exam_id  INT REFERENCES lab_exams(id) ON DELETE SET NULL,
  name     TEXT NOT NULL,
  price    NUMERIC(10,2) NOT NULL,
  qty      INT NOT NULL DEFAULT 1 CHECK (qty > 0)
);

-- Recetas médicas
CREATE TABLE IF NOT EXISTS prescriptions (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  follow_up_id INT REFERENCES follow_ups(id) ON DELETE SET NULL,
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  indicaciones TEXT,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions (patient_id, created_at DESC);

-- Citas
CREATE TABLE IF NOT EXISTS appointments (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 5 AND 240),
  type         TEXT NOT NULL DEFAULT 'consulta' CHECK (type IN ('consulta', 'seguimiento', 'laboratorio')),
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'confirmada', 'completada', 'cancelada', 'no_asistio')),
  notes        TEXT,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_when_idx ON appointments (scheduled_at);

-- Bitácora de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INT,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
