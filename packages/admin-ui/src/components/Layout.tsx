import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

export function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>DNS-Server</h1>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/zones">Zonen</NavLink>
          <NavLink to="/dhcp">DHCP</NavLink>
          <NavLink to="/settings">Einstellungen</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span>{username}</span>
          <button onClick={() => logout()}>Abmelden</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
