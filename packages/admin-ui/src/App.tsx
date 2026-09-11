import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Zones } from './pages/Zones';
import { ZoneDetail } from './pages/ZoneDetail';
import { Dhcp } from './pages/Dhcp';
import { Settings } from './pages/Settings';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { username, loading } = useAuth();
  if (loading) return <p className="center-loading">Lädt…</p>;
  if (!username) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/zones/:id" element={<ZoneDetail />} />
        <Route path="/dhcp" element={<Dhcp />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
