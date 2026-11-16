import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fullName, money } from '../format.js';
import ClientForm from '../components/ClientForm.jsx';
import { Empty, ErrorMessage, Loading, PageHeader, Pagination } from '../components/ui.jsx';

export default function Clients() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState({ page: 1, search: '', agent: '' });
  const [searchText, setSearchText] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, error, loading } = useApi('/clients', { ...query, limit: 15 });
  const agents = useApi(can('admin', 'manager') ? '/users' : null, { role: 'agent' });

  return (
    <>
      <PageHeader title="Clients">
        {!creating && <button type="button" onClick={() => setCreating(true)}>New client</button>}
      </PageHeader>

      {creating && (
        <ClientForm onCancel={() => setCreating(false)} onSaved={client => navigate(`/clients/${client._id}`)} />
      )}

      <form
        className="filters"
        role="search"
        onSubmit={event => { event.preventDefault(); setQuery(q => ({ ...q, search: searchText.trim(), page: 1 })); }}
      >
        <label>Search<input type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Name, company, email" /></label>
        {can('admin', 'manager') && (
          <label>Assigned agent
            <select value={query.agent} onChange={e => setQuery(q => ({ ...q, agent: e.target.value, page: 1 }))}>
              <option value="">All</option>
              {agents.data?.users.map(agent => <option key={agent._id} value={agent._id}>{fullName(agent)}</option>)}
            </select>
          </label>
        )}
        <button type="submit" className="ghost">Search</button>
      </form>

      <ErrorMessage error={error} />
      <Loading loading={loading && !data} />

      {data && (
        <section className="card flush">
          {data.clients.length ? (
            <table>
              <thead>
                <tr><th>Client</th><th>Contact</th><th>City</th><th>Assigned agents</th><th className="num">Invoices</th><th className="num">Outstanding</th></tr>
              </thead>
              <tbody>
                {data.clients.map(client => (
                  <tr key={client._id}>
                    <td><Link to={`/clients/${client._id}`}>{client.name}</Link><div className="muted small">{client.company}</div></td>
                    <td>{client.email}<div className="muted small">{client.phone}</div></td>
                    <td>{client.address?.city || '—'}</td>
                    <td>{client.assignedAgents.map(fullName).join(', ') || '—'}</td>
                    <td className="num">{client.totalInvoices}</td>
                    <td className="num">{money(client.totalUnpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty />}
        </section>
      )}

      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={page => setQuery(q => ({ ...q, page }))} />}
    </>
  );
}
