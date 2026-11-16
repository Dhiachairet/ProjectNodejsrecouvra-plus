import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { TRANSITION_LABEL } from '../format.js';

// Which extra input each target status asks for (mirrors the server-side workflow rules)
const REQUIRES = { completed: 'result', failed: 'result', planned: 'date' };

// Buttons for the workflow transitions the server allows from the action's current status.
export default function TransitionControl({ action, onChanged }) {
  const { user, can } = useAuth();
  const [target, setTarget] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  const performerId = action.performedBy?._id ?? action.performedBy;
  const isOwner = can('admin', 'manager') || performerId === user._id;
  const options = (action.allowedTransitions ?? []).filter(status => status !== 'cancelled' || can('admin', 'manager'));

  if (!isOwner || options.length === 0) return <span className="muted">—</span>;

  async function apply(status) {
    setError(null);
    const body = { status };
    if (REQUIRES[status] === 'result') body.result = value;
    if (REQUIRES[status] === 'date') body.actionDate = new Date(value).toISOString();
    try {
      await api(`/collections/${action._id}/status`, { method: 'PATCH', body });
      setTarget(null);
      setValue('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (target) {
    return (
      <form className="inline" onSubmit={event => { event.preventDefault(); apply(target); }}>
        {REQUIRES[target] === 'result'
          ? <input aria-label="Action result" placeholder="Result…" value={value} onChange={e => setValue(e.target.value)} required />
          : <input aria-label="New date" type="datetime-local" value={value} onChange={e => setValue(e.target.value)} required />}
        <button type="submit" className="small">{TRANSITION_LABEL[target]}</button>
        <button type="button" className="ghost small" onClick={() => { setTarget(null); setError(null); }}>Back</button>
        {error && <span className="error small" role="alert">{error}</span>}
      </form>
    );
  }

  return (
    <div className="inline">
      {options.map(status => (
        <button
          key={status}
          type="button"
          className={`small ${status === 'cancelled' ? 'ghost danger' : 'ghost'}`}
          onClick={() => (REQUIRES[status] ? setTarget(status) : apply(status))}
        >
          {TRANSITION_LABEL[status]}
        </button>
      ))}
      {error && <span className="error small" role="alert">{error}</span>}
    </div>
  );
}
