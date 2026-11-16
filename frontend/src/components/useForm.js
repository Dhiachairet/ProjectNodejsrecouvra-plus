import { useState } from 'react';

// Minimal form state: bind(name) wires an input, submit(event, action) runs the action and captures its error.
export function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (event) => setValues(current => ({ ...current, [name]: event.target.value }))
  });

  async function submit(event, action) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return { values, setValues, bind, submit, error, busy };
}
