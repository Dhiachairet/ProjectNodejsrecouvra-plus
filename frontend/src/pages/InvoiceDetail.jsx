import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { useAuth } from '../useAuth.js';
import { ACTION_TYPE, PAYMENT_METHOD, date, dateTime, fullName, money, toDateInput } from '../format.js';
import TransitionControl from '../components/TransitionControl.jsx';
import { useForm } from '../components/useForm.js';
import { ActionStatus, Empty, ErrorMessage, InvoiceStatus, Kpi, Loading, PageHeader } from '../components/ui.jsx';

function PaymentForm({ invoice, onSaved }) {
  const { bind, submit, error, busy, setValues } = useForm({ amount: '', paymentMethod: 'bank_transfer', reference: '' });
  const save = async (values) => {
    await api(`/invoices/${invoice._id}/payments`, { method: 'POST', body: { ...values, amount: Number(values.amount) } });
    setValues({ amount: '', paymentMethod: 'bank_transfer', reference: '' });
    onSaved();
  };
  return (
    <form className="form" onSubmit={event => submit(event, save)}>
      <div className="form-grid three">
        <label>Amount<input {...bind('amount')} type="number" min="0.01" step="0.01" max={invoice.remainingAmount} required /></label>
        <label>Method
          <select {...bind('paymentMethod')}>
            {Object.entries(PAYMENT_METHOD).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Reference<input {...bind('reference')} /></label>
      </div>
      <ErrorMessage error={error} />
      <button type="submit" className="small" disabled={busy}>Record payment</button>
    </form>
  );
}

function ActionForm({ invoice, onSaved }) {
  const { bind, submit, error, busy, setValues } = useForm({ actionType: 'phone_call', actionDate: '', notes: '' });
  const save = async (values) => {
    await api('/collections', {
      method: 'POST',
      body: { invoice: invoice._id, ...values, actionDate: values.actionDate ? new Date(values.actionDate).toISOString() : undefined }
    });
    setValues({ actionType: 'phone_call', actionDate: '', notes: '' });
    onSaved();
  };
  return (
    <form className="form" onSubmit={event => submit(event, save)}>
      <div className="form-grid three">
        <label>Type
          <select {...bind('actionType')}>
            {Object.entries(ACTION_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Planned date<input {...bind('actionDate')} type="datetime-local" /></label>
        <label>Notes<input {...bind('notes')} /></label>
      </div>
      <ErrorMessage error={error} />
      <button type="submit" className="small" disabled={busy}>Plan action</button>
    </form>
  );
}

function EditForm({ invoice, onDone }) {
  const { bind, submit, error, busy } = useForm({ description: invoice.description ?? '', dueDate: toDateInput(invoice.dueDate) });
  const save = async (values) => {
    await api(`/invoices/${invoice._id}`, { method: 'PUT', body: values });
    onDone(true);
  };
  return (
    <form className="card form" onSubmit={event => submit(event, save)}>
      <h2>Edit invoice</h2>
      <div className="form-grid">
        <label>Due date<input {...bind('dueDate')} type="date" required /></label>
        <label>Description<input {...bind('description')} required /></label>
      </div>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="submit" disabled={busy}>Save</button>
        <button type="button" className="ghost" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}

function CancelForm({ invoice, onDone }) {
  const { bind, submit, error, busy } = useForm({ cancelledReason: '' });
  const save = async ({ cancelledReason }) => {
    await api(`/invoices/${invoice._id}`, { method: 'PUT', body: { status: 'cancelled', cancelledReason } });
    onDone(true);
  };
  return (
    <form className="card form" onSubmit={event => submit(event, save)}>
      <h2>Cancel invoice</h2>
      <label>Cancellation reason<input {...bind('cancelledReason')} required /></label>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="submit" className="danger" disabled={busy}>Confirm cancellation</button>
        <button type="button" className="ghost" onClick={() => onDone(false)}>Back</button>
      </div>
    </form>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/invoices/${id}`);
  const [mode, setMode] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!data) return <><ErrorMessage error={error} /><Loading loading={loading} /></>;
  const { invoice, collectionActions } = data;
  const open = !['paid', 'cancelled'].includes(invoice.status);
  const closeForm = (changed) => { setMode(null); if (changed) reload(); };

  async function remove() {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
    try {
      await api(`/invoices/${invoice._id}`, { method: 'DELETE' });
      navigate('/invoices');
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      <PageHeader title={`Invoice ${invoice.invoiceNumber}`}>
        <InvoiceStatus status={invoice.status} />
        {open && <button type="button" className="ghost" onClick={() => setMode('edit')}>Edit</button>}
        {open && <button type="button" className="ghost danger" onClick={() => setMode('cancel')}>Cancel invoice</button>}
        {can('admin') && <button type="button" className="ghost danger" onClick={remove}>Delete</button>}
      </PageHeader>
      <ErrorMessage error={actionError} />

      {mode === 'edit' && <EditForm invoice={invoice} onDone={closeForm} />}
      {mode === 'cancel' && <CancelForm invoice={invoice} onDone={closeForm} />}

      <div className="kpis">
        <Kpi label="Amount" value={money(invoice.amount)} />
        <Kpi label="Paid" value={money(invoice.paidAmount)} hint={`${invoice.paymentPercentage.toFixed(0)}%`} />
        <Kpi label="Outstanding" value={money(invoice.remainingAmount)} />
        <Kpi label="Due date" value={date(invoice.dueDate)} hint={invoice.isOverdue ? 'Past due' : undefined} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Details</h2>
          <dl className="details">
            <dt>Client</dt><dd><Link to={`/clients/${invoice.client._id}`}>{invoice.client.name}</Link></dd>
            <dt>Issued</dt><dd>{date(invoice.issueDate)}</dd>
            <dt>Description</dt><dd>{invoice.description || '—'}</dd>
            <dt>Created by</dt><dd>{fullName(invoice.createdBy)}</dd>
            {invoice.status === 'cancelled' && (
              <><dt>Cancelled</dt><dd>{date(invoice.cancelledAt)} by {fullName(invoice.cancelledBy)}: {invoice.cancelledReason}</dd></>
            )}
          </dl>
        </section>

        <section className="card">
          <h2>Payments</h2>
          {invoice.payments.length ? (
            <table>
              <thead><tr><th>Date</th><th>Method</th><th>Received by</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {invoice.payments.map(payment => (
                  <tr key={payment._id}>
                    <td>{date(payment.paymentDate)}</td>
                    <td>{PAYMENT_METHOD[payment.paymentMethod]}</td>
                    <td>{fullName(payment.receivedBy)}</td>
                    <td className="num">{money(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No payments.</Empty>}
          {open && <PaymentForm invoice={invoice} onSaved={reload} />}
        </section>

        <section className="card span-2">
          <h2>Collection actions</h2>
          {collectionActions.length ? (
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Agent</th><th>Result</th><th>Status</th><th>Workflow</th></tr></thead>
              <tbody>
                {collectionActions.map(action => (
                  <tr key={action._id}>
                    <td>{dateTime(action.actionDate)}</td>
                    <td>{ACTION_TYPE[action.actionType]}</td>
                    <td>{fullName(action.performedBy)}</td>
                    <td>{action.result || <span className="muted">—</span>}</td>
                    <td><ActionStatus status={action.status} /></td>
                    <td><TransitionControl action={action} onChanged={reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No collection actions.</Empty>}
          {open && <ActionForm invoice={invoice} onSaved={reload} />}
        </section>
      </div>
    </>
  );
}
