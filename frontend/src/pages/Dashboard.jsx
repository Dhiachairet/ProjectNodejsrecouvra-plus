import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ACTION_STATUS, INVOICE_STATUS, money, month, fullName } from '../format.js';
import { Bars, Empty, ErrorMessage, Kpi, Loading, PageHeader } from '../components/ui.jsx';

const NO_FILTERS = { from: '', to: '', agent: '', client: '' };

export default function Dashboard() {
  const { can } = useAuth();
  const [filters, setFilters] = useState(NO_FILTERS);
  const { data, error, loading } = useApi('/stats', filters);
  const agents = useApi(can('admin', 'manager') ? '/users' : null, { role: 'agent' });
  const clients = useApi('/clients', { limit: 500, sortBy: 'name' });

  const setFilter = (name) => (event) => setFilters(current => ({ ...current, [name]: event.target.value }));
  const stats = data?.stats;
  const overview = stats?.overview;

  return (
    <>
      <PageHeader title="Dashboard" />

      <form className="filters" aria-label="Dashboard filters" onSubmit={event => event.preventDefault()}>
        <label>From<input type="date" value={filters.from} onChange={setFilter('from')} /></label>
        <label>To<input type="date" value={filters.to} onChange={setFilter('to')} /></label>
        {can('admin', 'manager') && (
          <label>Agent
            <select value={filters.agent} onChange={setFilter('agent')}>
              <option value="">All</option>
              {agents.data?.users.map(agent => <option key={agent._id} value={agent._id}>{fullName(agent)}</option>)}
            </select>
          </label>
        )}
        <label>Client
          <select value={filters.client} onChange={setFilter('client')}>
            <option value="">All</option>
            {clients.data?.clients.map(client => <option key={client._id} value={client._id}>{client.name}</option>)}
          </select>
        </label>
        <button type="button" className="ghost" onClick={() => setFilters(NO_FILTERS)}>Reset</button>
      </form>

      <ErrorMessage error={error} />
      <Loading loading={loading && !stats} />

      {overview && (
        <>
          <div className="kpis">
            <Kpi label="Invoiced" value={money(overview.totalAmount)} hint={`${overview.totalInvoices} invoices`} />
            <Kpi label="Paid" value={money(overview.totalPaid)} />
            <Kpi label="Outstanding" value={money(overview.unpaidAmount)} />
            <Kpi label="Recovery rate" value={`${overview.recoveryRate}%`} />
            <Kpi label="Collected in period" value={money(overview.collectedInPeriod)} />
            <Kpi label="Overdue invoices" value={overview.overdueCount} />
            <Kpi label="Due within 7 days" value={overview.dueThisWeek} />
            <Kpi label="Clients" value={overview.totalClients} hint={`${overview.plannedActions} planned actions`} />
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Invoices by status</h2>
              <Bars rows={Object.entries(stats.invoicesByStatus).map(([status, row]) => ({
                label: INVOICE_STATUS[status] ?? status,
                value: row.count
              }))} />
            </section>

            <section className="card">
              <h2>Collection actions by status</h2>
              {Object.keys(stats.collectionStats).length
                ? <Bars rows={Object.entries(stats.collectionStats).map(([status, count]) => ({ label: ACTION_STATUS[status] ?? status, value: count }))} />
                : <Empty />}
            </section>

            <section className="card">
              <h2>Top 5 debtors</h2>
              {stats.topClients.length ? (
                <table>
                  <thead><tr><th>Client</th><th className="num">Invoices</th><th className="num">Outstanding</th></tr></thead>
                  <tbody>
                    {stats.topClients.map(row => (
                      <tr key={row._id}>
                        <td><Link to={`/clients/${row._id}`}>{row.client.name}</Link><div className="muted small">{row.client.company}</div></td>
                        <td className="num">{row.invoiceCount}</td>
                        <td className="num">{money(row.totalUnpaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <Empty />}
            </section>

            <section className="card">
              <h2>Collected by agent</h2>
              {stats.collectedByAgent.length ? (
                <Bars rows={stats.collectedByAgent.map(row => ({
                  label: `${row.firstName} ${row.lastName}`,
                  value: row.collected,
                  display: money(row.collected)
                }))} />
              ) : <Empty />}
            </section>

            <section className="card span-2">
              <h2>Monthly trend</h2>
              {stats.monthlyStats.length ? (
                <table>
                  <thead>
                    <tr><th>Month</th><th className="num">Invoices</th><th className="num">Invoiced</th><th className="num">Paid</th><th>Rate</th></tr>
                  </thead>
                  <tbody>
                    {stats.monthlyStats.map(row => {
                      const rate = row.totalAmount ? (row.totalPaid / row.totalAmount) * 100 : 0;
                      return (
                        <tr key={row.month}>
                          <td>{month(row.month)}</td>
                          <td className="num">{row.count}</td>
                          <td className="num">{money(row.totalAmount)}</td>
                          <td className="num">{money(row.totalPaid)}</td>
                          <td><span className="meter"><span style={{ width: `${rate}%` }} /></span> {rate.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <Empty />}
            </section>
          </div>
        </>
      )}
    </>
  );
}
