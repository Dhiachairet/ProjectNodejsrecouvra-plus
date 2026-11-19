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
// While a new request runs, the previous data stays available and `loading` is true.
export function useApi(path, query) {
  const [version, setVersion] = useState(0);
  // The query object is a new reference on every render, so requests are keyed by its serialized value
  const queryKey = JSON.stringify(query ?? {});
  const requestKey = path ? `${path}?${queryKey}#${version}` : null;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    api(path, { query: JSON.parse(queryKey) })
      .then(data => active && setResult({ key: requestKey, data, error: null }))
      .catch(error => active && setResult({ key: requestKey, data: null, error: error.message }));
    return () => { active = false; };
  }, [path, queryKey, requestKey]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  // Derived from the last finished request, so starting a request needs no extra state update (and render)
  const loading = requestKey !== null && result.key !== requestKey;
  return { data: result.data, error: result.error, loading, reload };
}
