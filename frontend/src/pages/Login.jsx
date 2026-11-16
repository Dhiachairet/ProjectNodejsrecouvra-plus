import { useAuth } from '../auth.jsx';
import { useForm } from '../components/useForm.js';
import { ErrorMessage } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const { bind, submit, error, busy } = useForm({ email: '', password: '' });

  return (
    <main className="login">
      <form className="card form" onSubmit={event => submit(event, ({ email, password }) => login(email, password))}>
        <div className="brand">Recouvra<span>+</span></div>
        <h1>Sign in</h1>
        <label>Email<input {...bind('email')} type="email" autoComplete="username" required autoFocus /></label>
        <label>Password<input {...bind('password')} type="password" autoComplete="current-password" required /></label>
        <ErrorMessage error={error} />
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {import.meta.env.DEV && (
          <p className="muted small">
            Demo accounts (npm run seed): admin@ / manager@ / agent1@recouvra.tn, password Password123!
          </p>
        )}
      </form>
    </main>
  );
}
