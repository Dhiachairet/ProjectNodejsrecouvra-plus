// Integration tests: payments via the real API + in-memory MongoDB.
// Rule references: BR-02, BR-03 (payment side), BR-07 status recompute.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

async function managerWithInvoice(overrides = {}) {
  const { user: manager, token } = await createUserWithToken('manager');
  const client = await createClient(manager);
  const invoice = await createInvoice(client, manager, { amount: 1000, ...overrides });
  return { manager, token, client, invoice };
}

const pay = (token, id, body) =>
  request(app).post(`/api/invoices/${id}/payments`).set(authHeader(token)).send(body);

describe('POST /api/invoices/:id/payments (BR-02, BR-03, BR-07)', () => {
  it('accepts a partial payment and recomputes status to partially_paid', async () => {
    const { token, invoice } = await managerWithInvoice();

    const res = await pay(token, invoice._id, { amount: 400, paymentMethod: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.invoice.paidAmount).toBe(400);
    expect(res.body.invoice.status).toBe('partially_paid');
    expect(res.body.invoice.remainingAmount).toBe(600);
  });

  it('accepts a payment that exactly fills the invoice → status paid', async () => {
    const { token, invoice } = await managerWithInvoice();

    const res = await pay(token, invoice._id, { amount: 1000, paymentMethod: 'bank_transfer' });

    expect(res.status).toBe(201);
    expect(res.body.invoice.status).toBe('paid');
    expect(res.body.invoice.remainingAmount).toBe(0);
  });

  it('BR-02: rejects an overpayment with 400', async () => {
    const { token, invoice } = await managerWithInvoice();

    const res = await pay(token, invoice._id, { amount: 1001, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceeds remaining balance/i);
  });

  it('BR-02: a second payment that would overpay is rejected', async () => {
    const { token, invoice } = await managerWithInvoice();

    await pay(token, invoice._id, { amount: 800, paymentMethod: 'cash' }).expect(201);

    const res = await pay(token, invoice._id, { amount: 300, paymentMethod: 'cash' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceeds remaining balance/i);
  });

  it('BR-03: rejects a payment on a paid invoice (400)', async () => {
    const { token, invoice } = await managerWithInvoice({ paidAmount: 1000 });
    await invoice.save();

    const res = await pay(token, invoice._id, { amount: 1, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already paid/i);
  });

  it('BR-03: rejects a payment on a cancelled invoice (400)', async () => {
    const { token, invoice } = await managerWithInvoice();
    invoice.status = 'cancelled';
    invoice.cancelledReason = 'mistake';
    await invoice.save();

    const res = await pay(token, invoice._id, { amount: 10, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cancelled/i);
  });

  it('rejects an invalid payment method with 400', async () => {
    const { token, invoice } = await managerWithInvoice();

    const res = await pay(token, invoice._id, { amount: 10, paymentMethod: 'bitcoin' });

    expect(res.status).toBe(400);
  });
});

describe('client totals after payments (BR-07 side effect)', () => {
  it('recomputes Client.totalPaid / totalUnpaid on each payment', async () => {
    const { token, client, invoice } = await managerWithInvoice();

    await pay(token, invoice._id, { amount: 250, paymentMethod: 'cash' }).expect(201);

    const refreshed = await Client.findById(client._id);
    expect(refreshed.totalPaid).toBe(250);
    expect(refreshed.totalUnpaid).toBe(750);
    expect(refreshed.totalInvoices).toBe(1);
  });
});

describe('GET /api/invoices/:id/payments', () => {
  it('returns the payment list with computed totals', async () => {
    const { token, invoice } = await managerWithInvoice();
    await pay(token, invoice._id, { amount: 200, paymentMethod: 'cash' }).expect(201);
    await pay(token, invoice._id, { amount: 300, paymentMethod: 'check' }).expect(201);

    const res = await request(app).get(`/api/invoices/${invoice._id}/payments`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.paidAmount).toBe(500);
    expect(res.body.remainingAmount).toBe(500);
    expect(res.body.payments).toHaveLength(2);
  });
});