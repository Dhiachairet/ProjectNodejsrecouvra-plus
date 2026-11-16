import { ACTION_STATUS, INVOICE_STATUS } from '../format.js';

export function PageHeader({ title, children }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children && <div className="row">{children}</div>}
    </header>
  );
}

export function ErrorMessage({ error }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

export function Loading({ loading }) {
  return loading ? <p className="muted">Loading…</p> : null;
}

export function InvoiceStatus({ status }) {
  return <span className={`badge badge-${status}`}>{INVOICE_STATUS[status] ?? status}</span>;
}

export function ActionStatus({ status }) {
  return <span className={`badge badge-${status}`}>{ACTION_STATUS[status] ?? status}</span>;
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return <p className="muted small">{total ?? 0} result(s)</p>;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="ghost small" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="muted small">Page {page} of {pages} · {total} result(s)</span>
      <button type="button" className="ghost small" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

// Horizontal bars, each row scaled against the largest value
export function Bars({ rows }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <ul className="bars">
      {rows.map(row => (
        <li key={row.label}>
          <span className="bars-label">{row.label}</span>
          <span className="bars-track"><span className="bars-fill" style={{ width: `${(row.value / max) * 100}%` }} /></span>
          <span className="bars-value">{row.display ?? row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children = 'No results.' }) {
  return <p className="muted">{children}</p>;
}
