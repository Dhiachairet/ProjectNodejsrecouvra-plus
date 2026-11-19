import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { AuthContext } from './useAuth.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(data => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  const can = (...roles) => Boolean(user) && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
