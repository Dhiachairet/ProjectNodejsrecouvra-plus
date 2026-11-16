import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'recouvra_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Calls the REST API. Throws an Error carrying the server message on any non-2xx response.
export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  }

  const token = getToken();
  const response = await fetch(url, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body && JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `Erreur ${response.status}`);
  }
  return data;
}

// Loads `path` and reloads whenever the path or the query changes. Pass a null path to skip the call.
export function useApi(path, query) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [version, setVersion] = useState(0);
  const key = path && `${path}?${JSON.stringify(query ?? {})}`;

  useEffect(() => {
    if (!path) return;
    let active = true;
    setState(previous => ({ ...previous, loading: true }));
    api(path, { query })
      .then(data => active && setState({ data, error: null, loading: false }))
      .catch(error => active && setState({ data: null, error: error.message, loading: false }));
    return () => { active = false; };
    // `key` captures path + query by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { ...state, reload };
}
