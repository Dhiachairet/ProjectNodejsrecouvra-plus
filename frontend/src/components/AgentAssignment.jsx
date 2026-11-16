import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fullName } from '../format.js';
import { ErrorMessage } from './ui.jsx';

const MAX_AGENTS = 3;

// N-N relation client <-> agents. Managers and admins edit it, agents only see it.
export default function AgentAssignment({ client, onSaved }) {
  const { can } = useAuth();
  const editable = can('admin', 'manager');
  const agents = useApi(editable ? '/users' : null, { role: 'agent', active: 'true' });
  const [selected, setSelected] = useState(client.assignedAgents.map(agent => agent._id));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  if (!editable) {
    return client.assignedAgents.length
      ? <ul className="plain">{client.assignedAgents.map(agent => <li key={agent._id}>{fullName(agent)}</li>)}</ul>
      : <p className="muted">No agent assigned.</p>;
  }

  const toggle = (id) => {
    setSaved(false);
    setSelected(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]));
  };

  async function save() {
    setError(null);
    try {
      const data = await api(`/clients/${client._id}/agents`, { method: 'PUT', body: { agents: selected } });
      setSaved(true);
      onSaved(data.client);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <fieldset className="checks">
        <legend className="muted small">Up to {MAX_AGENTS} agents</legend>
        {agents.data?.users.map(agent => (
          <label key={agent._id}>
            <input type="checkbox" checked={selected.includes(agent._id)} onChange={() => toggle(agent._id)} />
            {fullName(agent)}
          </label>
        ))}
      </fieldset>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="button" className="small" onClick={save}>Save assignment</button>
        {saved && <span className="muted small" role="status">Assignment saved</span>}
      </div>
    </div>
  );
}
