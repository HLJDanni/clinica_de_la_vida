import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SettingsProvider, useAuth } from './context.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import Labs from './pages/Labs.jsx';
import Quotes from './pages/Quotes.jsx';
import Agenda from './pages/Agenda.jsx';
import Cashier from './pages/Cashier.jsx';
import SettingsPage from './pages/Settings.jsx';

function Splash() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      <motion.img src="/logo.svg" alt="" width={64} height={64} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
    </div>
  );
}

export default function App() {
  const { user, isDoctor } = useAuth();
  if (user === undefined) return <Splash />;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <SettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pacientes" element={<Patients />} />
          <Route path="pacientes/:id" element={<PatientDetail />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="laboratorio" element={<Labs />} />
          <Route path="cotizaciones" element={<Quotes />} />
          <Route path="caja" element={<Cashier />} />
          {isDoctor && <Route path="configuracion" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}
