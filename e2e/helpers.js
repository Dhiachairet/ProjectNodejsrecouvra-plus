import { expect } from '@playwright/test';

export const PASSWORD = 'Password123!';
export const USERS = {
  admin: 'admin@recouvra.tn',
  manager: 'manager@recouvra.tn',
  agent1: 'agent1@recouvra.tn',
  agent2: 'agent2@recouvra.tn'
};

// Unique suffix so the 4 browser projects can run in parallel on the same database
export const uid = (testInfo) =>
  `${testInfo.project.name}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5)}`;

// yyyy-mm-dd, `days` from today (negative = past)
export function isoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// yyyy-mm-ddThh:mm for <input type="datetime-local">
export function localDateTime(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

// Sign in through the real login form
export async function login(page, email, password = PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

// JWT for direct API calls (test data setup and server-side checks)
export async function apiToken(request, email, password = PASSWORD) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).token;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export async function createClient(request, token, name) {
  const res = await request.post('/api/clients', {
    headers: auth(token),
    data: { name, email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@e2e.tn`, phone: '71000000', company: 'E2E SARL' }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).client;
}

export async function createInvoice(request, token, clientId, number, amount = 1000) {
  const res = await request.post('/api/invoices', {
    headers: auth(token),
    data: { invoiceNumber: number, client: clientId, amount, dueDate: isoDate(30) }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).invoice;
}
