import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../useAuth.js';
import { ROLE, date } from '../format.js';
import { useForm } from '../components/useForm.js';
import { ErrorMessage, Loading, PageHeader } from '../components/ui.jsx';

const EMPTY_USER = { firstName: '', lastName: '', email: '', password: '', role: 'agent' };

function UserForm({ onSaved, onCancel }) {
  const { bind, submit, error, busy } = useForm(EMPTY_USER);
  const save = async (values) => {
    await api('/auth/register', { method: 'POST', body: values });
    onSaved();
  };
  return (
    <form className="card form" onSubmit={event => submit(event, save)}>
      <h2>New user</h2>
      <div className="form-grid">
        <label>First name<input {...bind('firstName')} required /></label>
        <label>Last name<input {...bind('lastName')} required /></label>
        <label>Email<input {...bind('email')} type="email" required /></label>
        <label>Password<input {...bind('password')} type="password" minLength={6} required autoComplete="new-password" /></label>
        <label>Role
          <select {...bind('role')}>
            {Object.entries(ROLE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="submit" disabled={busy}>Create</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: me, can } = useAuth();
  const isAdmin = can('admin');
  const { data, error, loading, reload } = useApi('/users');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function run(request) {
    setActionError(null);
    try {
      await request();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const update = (user, body) => run(() => api(`/users/${user._id}`, { method: 'PUT', body }));
  const remove = (user) => window.confirm(`Delete ${user.email}?`) && run(() => api(`/users/${user._id}`, { method: 'DELETE' }));

  return (
    <>
      <PageHeader title="Users">
        {isAdmin && !creating && <button type="button" onClick={() => setCreating(true)}>New user</button>}
      </PageHeader>

      {creating && <UserForm onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}

      <ErrorMessage error={error || actionError} />
      <Loading loading={loading && !data} />

      {data && (
        <section className="card flush">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th>{isAdmin && <th />}</tr>
            </thead>
            <tbody>
              {data.users.map(user => {
                const self = user._id === me._id;
                return (
                  <tr key={user._id}>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>
                      {isAdmin && !self ? (
                        <select aria-label={`Role of ${user.email}`} value={user.role} onChange={e => update(user, { role: e.target.value })}>
                          {Object.entries(ROLE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      ) : ROLE[user.role]}
                    </td>
                    <td>{user.active ? 'Active' : <span className="muted">Deactivated</span>}</td>
                    <td>{date(user.createdAt)}</td>
                    {isAdmin && (
                      <td className="row">
                        {!self && (
                          <>
                            <button type="button" className="ghost small" onClick={() => update(user, { active: !user.active })}>
                              {user.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button type="button" className="ghost danger small" onClick={() => remove(user)}>Delete</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
