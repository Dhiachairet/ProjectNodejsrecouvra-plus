import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { useAuth } from '../useAuth.js';
import { ACTION_STATUS, ACTION_TYPE, dateTime, fullName } from '../format.js';
import TransitionControl from '../components/TransitionControl.jsx';
import { ActionStatus, Empty, ErrorMessage, Loading, PageHeader, Pagination } from '../components/ui.jsx';

const NO_FILTERS = { page: 1, status: '', actionType: '', fromDate: '', toDate: '' };

function History({ steps }) {
  if (!steps?.length) return <span className="muted">—</span>;
  return (
    <details>
      <summary className="small">{steps.length} step(s)</summary>
      <ol className="history">
        {steps.map((step, index) => (
          <li key={index}>
            {dateTime(step.changedAt)}: {step.from ? `${ACTION_STATUS[step.from]} → ` : ''}{ACTION_STATUS[step.to]}
            {step.note && <span className="muted"> ({step.note})</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function Actions() {
  const { can } = useAuth();
  const [query, setQuery] = useState(NO_FILTERS);
  const [deleteError, setDeleteError] = useState(null);
  const { data, error, loading, reload } = useApi('/collections', { ...query, limit: 20 });

  const setFilter = (name) => (event) => setQuery(q => ({ ...q, [name]: event.target.value, page: 1 }));

  async function remove(action) {
    if (!window.confirm('Delete this collection action?')) return;
    try {
      await api(`/collections/${action._id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Collection actions" />
      <p className="muted small">
        Workflow: Planned → Completed / Failed / Cancelled. A failed action can be rescheduled.
        Completing or failing an action requires a result; only a manager or an admin can cancel.
      </p>

      <form className="filters" onSubmit={event => event.preventDefault()}>
        <label>Status
          <select value={query.status} onChange={setFilter('status')}>
            <option value="">All</option>
            {Object.entries(ACTION_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Type
          <select value={query.actionType} onChange={setFilter('actionType')}>
            <option value="">All</option>
            {Object.entries(ACTION_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={query.fromDate} onChange={setFilter('fromDate')} /></label>
        <label>To<input type="date" value={query.toDate} onChange={setFilter('toDate')} /></label>
        <button type="button" className="ghost" onClick={() => setQuery(NO_FILTERS)}>Reset</button>
      </form>

      <ErrorMessage error={error || deleteError} />
      <Loading loading={loading && !data} />

      {data && (
        <>
          <section className="card flush">
            {data.actions.length ? (
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Client / invoice</th><th>Agent</th><th>Status</th><th>History</th><th>Workflow</th>{can('admin') && <th />}</tr>
                </thead>
                <tbody>
                  {data.actions.map(action => (
                    <tr key={action._id}>
                      <td>{dateTime(action.actionDate)}</td>
                      <td>{ACTION_TYPE[action.actionType]}</td>
                      <td>
                        {action.client && <Link to={`/clients/${action.client._id}`}>{action.client.name}</Link>}
                        <div className="small">{action.invoice && <Link to={`/invoices/${action.invoice._id}`}>{action.invoice.invoiceNumber}</Link>}</div>
                      </td>
                      <td>{fullName(action.performedBy)}</td>
                      <td><ActionStatus status={action.status} /></td>
                      <td><History steps={action.statusHistory} /></td>
                      <td><TransitionControl action={action} onChanged={reload} /></td>
                      {can('admin') && <td><button type="button" className="ghost danger small" onClick={() => remove(action)}>Delete</button></td>}
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
