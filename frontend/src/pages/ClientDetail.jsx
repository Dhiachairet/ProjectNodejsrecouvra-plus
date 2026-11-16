import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ACTION_TYPE, date, fullName, money } from '../format.js';
import AgentAssignment from '../components/AgentAssignment.jsx';
import ClientForm from '../components/ClientForm.jsx';
import InvoiceForm from '../components/InvoiceForm.jsx';
import { ActionStatus, Empty, ErrorMessage, InvoiceStatus, Kpi, Loading, PageHeader } from '../components/ui.jsx';

export default function ClientDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/clients/${id}`);
  const [mode, setMode] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!data) return <><ErrorMessage error={error} /><Loading loading={loading} /></>;
  const { client, stats, recentInvoices, recentActions } = data;

  async function remove() {
    if (!window.confirm(`Delete client ${client.name}?`)) return;
    try {
      await api(`/clients/${client._id}`, { method: 'DELETE' });
      navigate('/clients');
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      <PageHeader title={client.name}>
        <button type="button" className="ghost" onClick={() => setMode('edit')}>Edit</button>
        <button type="button" onClick={() => setMode('invoice')}>New invoice</button>
        {can('admin', 'manager') && <button type="button" className="ghost danger" onClick={remove}>Delete</button>}
      </PageHeader>
      <ErrorMessage error={actionError} />

      {mode === 'edit' && <ClientForm client={client} onCancel={() => setMode(null)} onSaved={() => { setMode(null); reload(); }} />}
      {mode === 'invoice' && <InvoiceForm clientId={client._id} onCancel={() => setMode(null)} onSaved={invoice => navigate(`/invoices/${invoice._id}`)} />}

      <div className="kpis">
        <Kpi label="Invoices" value={stats.totalInvoices} />
        <Kpi label="Paid" value={money(stats.totalPaid)} />
        <Kpi label="Outstanding" value={money(stats.totalUnpaid)} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Contact details</h2>
          <dl className="details">
            <dt>Company</dt><dd>{client.company || '—'}</dd>
            <dt>Email</dt><dd>{client.email}</dd>
            <dt>Phone</dt><dd>{client.phone}</dd>
            <dt>Address</dt><dd>{client.fullAddress || '—'}</dd>
            <dt>Created by</dt><dd>{fullName(client.createdBy)} on {date(client.createdAt)}</dd>
            {client.notes && <><dt>Notes</dt><dd>{client.notes}</dd></>}
          </dl>
        </section>

        <section className="card">
          <h2>Assigned agents</h2>
          <AgentAssignment key={client._id} client={client} onSaved={reload} />
        </section>

        <section className="card flush span-2">
          <h2>Recent invoices</h2>
          {recentInvoices.length ? (
            <table>
              <thead><tr><th>Number</th><th>Due date</th><th className="num">Amount</th><th className="num">Paid</th><th>Status</th></tr></thead>
              <tbody>
                {recentInvoices.map(invoice => (
                  <tr key={invoice._id}>
                    <td><Link to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td>
                    <td>{date(invoice.dueDate)}</td>
                    <td className="num">{money(invoice.amount)}</td>
                    <td className="num">{money(invoice.paidAmount)}</td>
                    <td><InvoiceStatus status={invoice.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No invoices.</Empty>}
        </section>

        <section className="card flush span-2">
          <h2>Latest collection actions</h2>
          {recentActions.length ? (
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Invoice</th><th>Agent</th><th>Status</th></tr></thead>
              <tbody>
                {recentActions.map(action => (
                  <tr key={action._id}>
                    <td>{date(action.actionDate)}</td>
                    <td>{ACTION_TYPE[action.actionType]}</td>
                    <td>{action.invoice && <Link to={`/invoices/${action.invoice._id}`}>{action.invoice.invoiceNumber}</Link>}</td>
                    <td>{fullName(action.performedBy)}</td>
                    <td><ActionStatus status={action.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No actions.</Empty>}
        </section>
      </div>
    </>
  );
}
