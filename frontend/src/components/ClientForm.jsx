import { api } from '../api.js';
import { useForm } from './useForm.js';
import { ErrorMessage } from './ui.jsx';

export default function ClientForm({ client, onSaved, onCancel }) {
  const { bind, submit, error, busy } = useForm({
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    company: client?.company ?? '',
    city: client?.address?.city ?? '',
    notes: client?.notes ?? ''
  });

  const save = async ({ city, ...fields }) => {
    const body = { ...fields, address: { ...client?.address, city } };
    const data = client
      ? await api(`/clients/${client._id}`, { method: 'PUT', body })
      : await api('/clients', { method: 'POST', body });
    onSaved(data.client);
  };

  return (
    <form className="card form" onSubmit={event => submit(event, save)}>
      <h2>{client ? 'Edit client' : 'New client'}</h2>
      <div className="form-grid">
        <label>Name<input {...bind('name')} required minLength={2} /></label>
        <label>Email<input {...bind('email')} type="email" required /></label>
        <label>Phone<input {...bind('phone')} required minLength={8} /></label>
        <label>Company<input {...bind('company')} /></label>
        <label>City<input {...bind('city')} /></label>
        <label className="span-2">Notes<textarea {...bind('notes')} rows={2} /></label>
      </div>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="submit" disabled={busy}>Save</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
