import { api, useApi } from '../api.js';
import { useForm } from './useForm.js';
import { ErrorMessage } from './ui.jsx';

// Creates an invoice. When `clientId` is given the client is fixed, otherwise a client must be picked.
export default function InvoiceForm({ clientId, onSaved, onCancel }) {
  const clients = useApi(clientId ? null : '/clients', { limit: 500, sortBy: 'name' });
  const { bind, submit, error, busy } = useForm({
    invoiceNumber: '',
    client: clientId ?? '',
    amount: '',
    dueDate: '',
    description: ''
  });

  const save = async (values) => {
    const data = await api('/invoices', {
      method: 'POST',
      body: { ...values, amount: Number(values.amount) }
    });
    onSaved(data.invoice);
  };

  return (
    <form className="card form" onSubmit={event => submit(event, save)}>
      <h2>New invoice</h2>
      <div className="form-grid">
        <label>Number<input {...bind('invoiceNumber')} placeholder="FAC-2026-00123" required /></label>
        {!clientId && (
          <label>Client
            <select {...bind('client')} required>
              <option value="">Select…</option>
              {clients.data?.clients.map(client => (
                <option key={client._id} value={client._id}>{client.name} — {client.company}</option>
              ))}
            </select>
          </label>
        )}
        <label>Amount<input {...bind('amount')} type="number" min="0.01" step="0.01" required /></label>
        <label>Due date<input {...bind('dueDate')} type="date" required /></label>
        <label className="span-2">Description<input {...bind('description')} /></label>
      </div>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="submit" disabled={busy}>Create</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
