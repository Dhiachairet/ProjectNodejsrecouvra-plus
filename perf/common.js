// Scénarios communs aux tests de charge et de stress (§6.2)
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const BASE = __ENV.BASE || 'http://localhost:3000/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function setup() {
  const login = (email) => http.post(`${BASE}/auth/login`, JSON.stringify({ email, password: 'Password123!' }), { headers: JSON_HEADERS }).json('token');
  const token = login('manager@recouvra.tn');
  // Factures ouvertes pour le scénario de paiement (1 TND par paiement, solde jamais dépassé)
  const res = http.get(`${BASE}/invoices?status=unpaid&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
  const invoices = res.json('invoices').filter(i => i.amount - i.paidAmount > 500).map(i => i._id);
  return { token, invoices };
}

export function scenario({ token, invoices }) {
  const h = { headers: { Authorization: `Bearer ${token}` } };

  group('liste des factures', () => {
    check(http.get(`${BASE}/invoices?status=unpaid&page=1&limit=20`, { ...h, tags: { name: 'invoices_list' } }), { 'list 200': r => r.status === 200 });
  });
  group('recherche par numéro', () => {
    check(http.get(`${BASE}/invoices?search=FAC-2026-00`, { ...h, tags: { name: 'invoices_search' } }), { 'search 200': r => r.status === 200 });
  });
  group('tableau de bord', () => {
    check(http.get(`${BASE}/stats`, { ...h, tags: { name: 'stats' } }), { 'dashboard 200': r => r.status === 200 });
  });
  // SKIP_LOGIN=1 : variante de diagnostic sans connexion répétée (un vrai utilisateur ne se connecte qu'une fois)
  if (!__ENV.SKIP_LOGIN) group('connexion', () => {
    const r = http.post(`${BASE}/auth/login`, JSON.stringify({ email: 'agent1@recouvra.tn', password: 'Password123!' }), { headers: JSON_HEADERS, tags: { name: 'login' } });
    check(r, { 'login 200': x => x.status === 200 });
  });
  group('paiement', () => {
    const id = invoices[Math.floor(Math.random() * invoices.length)];
    const r = http.post(`${BASE}/invoices/${id}/payments`, JSON.stringify({ amount: 1, paymentMethod: 'cash' }), { headers: { ...h.headers, ...JSON_HEADERS }, tags: { name: 'payment' } });
    check(r, { 'payment 2xx': x => x.status === 200 || x.status === 201 });
  });
  sleep(1);
}
