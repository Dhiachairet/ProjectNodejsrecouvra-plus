import { NavLink } from 'react-router-dom';
import { useAuth } from '../useAuth.js';
import { ROLE, fullName } from '../format.js';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clients', label: 'Clients' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/actions', label: 'Collection actions' },
  { to: '/users', label: 'Users', roles: ['admin', 'manager'] },
  { to: '/audit', label: 'Audit log', roles: ['admin'] }
];

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Recouvra<span>+</span></div>
        <nav aria-label="Main navigation">
          {LINKS.filter(link => !link.roles || can(...link.roles)).map(link => (
            <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
          ))}
        </nav>
        <div className="session">
          <div>{fullName(user)}</div>
          <div className="muted small">{ROLE[user.role]}</div>
          <button type="button" className="ghost small" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
