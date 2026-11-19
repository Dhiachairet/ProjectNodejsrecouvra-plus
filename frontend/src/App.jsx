import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Actions from './pages/Actions.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';

function RequireRole({ roles, children }) {
  const { can } = useAuth();
  return can(...roles) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <p className="splash">Loading…</p>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/users" element={<RequireRole roles={['admin', 'manager']}><Users /></RequireRole>} />
        <Route path="/audit" element={<RequireRole roles={['admin']}><Audit /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
