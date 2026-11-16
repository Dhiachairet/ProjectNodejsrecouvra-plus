import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../api.js';
import { INVOICE_STATUS, date, money } from '../format.js';
import InvoiceForm from '../components/InvoiceForm.jsx';
import { Empty, ErrorMessage, InvoiceStatus, Loading, PageHeader, Pagination } from '../components/ui.jsx';

const NO_FILTERS = { page: 1, search: '', status: '', fromDate: '', toDate: '' };

export default function Invoices() {
  const navigate = useNavigate();
  const [query, setQuery] = useState(NO_FILTERS);
  const [creating, setCreating] = useState(false);
  const { data, error, loading } = useApi('/invoices', { ...query, limit: 20 });

  const setFilter = (name) => (event) => setQuery(q => ({ ...q, [name]: event.target.value, page: 1 }));

  return (
    <>
      <PageHeader title="Invoices">
        {!creating && <button type="button" onClick={() => setCreating(true)}>New invoice</button>}
      </PageHeader>

      {creating && <InvoiceForm onCancel={() => setCreating(false)} onSaved={invoice => navigate(`/invoices/${invoice._id}`)} />}

      <form className="filters" role="search" onSubmit={event => event.preventDefault()}>
        <label>Number<input type="search" value={query.search} onChange={setFilter('search')} placeholder="FAC-2026-…" /></label>
        <label>Status
          <select value={query.status} onChange={setFilter('status')}>
            <option value="">All</option>
            {Object.entries(INVOICE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Created from<input type="date" value={query.fromDate} onChange={setFilter('fromDate')} /></label>
        <label>to<input type="date" value={query.toDate} onChange={setFilter('toDate')} /></label>
        <button type="button" className="ghost" onClick={() => setQuery(NO_FILTERS)}>Reset</button>
      </form>

      <ErrorMessage error={error} />
      <Loading loading={loading && !data} />

      {data && (
        <>
          <p className="muted small">
            Total {money(data.summary.totalAmount)} · paid {money(data.summary.totalPaid)} · outstanding {money(data.summary.totalUnpaid)}
          </p>
          <section className="card flush">
            {data.invoices.length ? (
              <table>
                <thead>
                  <tr><th>Number</th><th>Client</th><th>Issued</th><th>Due date</th><th className="num">Amount</th><th className="num">Paid</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.invoices.map(invoice => (
                    <tr key={invoice._id}>
                      <td><Link to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td>
                      <td>{invoice.client ? <Link to={`/clients/${invoice.client._id}`}>{invoice.client.name}</Link> : '—'}</td>
                      <td>{date(invoice.issueDate)}</td>
                      <td>{date(invoice.dueDate)}</td>
                      <td className="num">{money(invoice.amount)}</td>
                      <td className="num">{money(invoice.paidAmount)}</td>
                      <td><InvoiceStatus status={invoice.status} /></td>
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
