import { useState } from 'react';
import { useApi } from '../api.js';
import { AUDIT_ACTION, ROLE, dateTime } from '../format.js';
import { Empty, ErrorMessage, Loading, PageHeader, Pagination } from '../components/ui.jsx';

const NO_FILTERS = { page: 1, action: '', entity: '', user: '', from: '', to: '' };

const ACTION_GROUPS = {
  auth: 'Authentication',
  user: 'Users',
  client: 'Clients',
  invoice: 'Invoices',
  action: 'Collection actions'
};

const ENTITIES = ['User', 'Client', 'Invoice', 'CollectionAction'];

export default function Audit() {
  const [query, setQuery] = useState(NO_FILTERS);
  const { data, error, loading } = useApi('/audit', { ...query, limit: 25 });
  const users = useApi('/users');

  const setFilter = (name) => (event) => setQuery(q => ({ ...q, [name]: event.target.value, page: 1 }));

  return (
    <>
      <PageHeader title="Audit log" />
      <p className="muted small">Read-only trail of sensitive actions: who did what, on which record, when and from which address.</p>

      <form className="filters" onSubmit={event => event.preventDefault()}>
        <label>Area
          <select value={query.action} onChange={setFilter('action')}>
            <option value="">All</option>
            {Object.entries(ACTION_GROUPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option disabled>──────────</option>
            {Object.entries(AUDIT_ACTION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Entity
          <select value={query.entity} onChange={setFilter('entity')}>
            <option value="">All</option>
            {ENTITIES.map(entity => <option key={entity} value={entity}>{entity}</option>)}
          </select>
        </label>
        <label>User
          <select value={query.user} onChange={setFilter('user')}>
            <option value="">All</option>
            {users.data?.users.map(user => <option key={user._id} value={user._id}>{user.email}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={query.from} onChange={setFilter('from')} /></label>
        <label>To<input type="date" value={query.to} onChange={setFilter('to')} /></label>
        <button type="button" className="ghost" onClick={() => setQuery(NO_FILTERS)}>Reset</button>
      </form>

      <ErrorMessage error={error} />
      <Loading loading={loading && !data} />

      {data && (
        <>
          <section className="card flush">
            {data.logs.length ? (
              <table>
                <thead>
                  <tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {data.logs.map(log => (
                    <tr key={log._id}>
                      <td className="nowrap">{dateTime(log.createdAt)}</td>
                      <td>{log.userEmail ?? '—'}<div className="muted small">{ROLE[log.role] ?? ''}</div></td>
                      <td>{AUDIT_ACTION[log.action] ?? log.action}<div className="muted small"><code>{log.action}</code></div></td>
                      <td>{log.entity ?? '—'}</td>
                      <td><code className="details-json">{log.details ? JSON.stringify(log.details) : ''}</code></td>
                      <td className="small">{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty />}
          </section>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={page => setQuery(q => ({ ...q, page }))} />
        </>
      )}
    </>
  );
}
