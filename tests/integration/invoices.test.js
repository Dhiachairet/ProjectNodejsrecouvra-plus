// Integration tests: invoices via the real API + in-memory MongoDB.
// Rule references: BR-01, BR-03, BR-04, BR-05, BR-07, BR-08, BR-09.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Invoice } from '../../src/models/Invoice.js';
import { CollectionAction } from '../../src/models/CollectionAction.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

const DAY = 24 * 60 * 60 * 1000;
const future = (days = 30) => new Date(Date.now() + days * DAY).toISOString();
const past = (days = 30) => new Date(Date.now() - days * DAY).toISOString();

// A manager (full CRUD except delete) + a client owned by them + a token
async function managerWithClient() {
  const { user: manager, token } = await createUserWithToken('manager');
  const client = await createClient(manager);
  return { manager, token, client };
}

// An admin (can delete invoices) + a client owned by them + a token
async function adminWithClient() {
  const { user: admin, token } = await createUserWithToken('admin');
  const client = await createClient(admin);
  return { admin, token, client };
}

const createInvoiceBody = (client, overrides = {}) => ({
  invoiceNumber: `FAC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  client: client._id.toString(),
  amount: 1000,
  dueDate: future(),
  ...overrides
});

describe('POST /api/invoices — create (BR-01, BR-08, BR-09)', () => {
  it('creates an invoice and returns 201 with the computed status', async () => {
    const { token, client } = await managerWithClient();

    const res = await request(app)
      .post('/api/invoices')
      .set(authHeader(token))
      .send(createInvoiceBody(client));

    expect(res.status).toBe(201);
    expect(res.body.invoice.status).toBe('unpaid');
    expect(res.body.invoice.paidAmount).toBe(0);
  });

  it('BR-01: rejects a duplicate invoice number with 400', async () => {
    const { token, client } = await managerWithClient();
    const number = 'FAC-DUPLICATE-001';

    await request(app).post('/api/invoices').set(authHeader(token))
      .send(createInvoiceBody(client, { invoiceNumber: number }))
      .expect(201);

    const res = await request(app).post('/api/invoices').set(authHeader(token))
      .send(createInvoiceBody(client, { invoiceNumber: number }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists|Duplicate/i);
  });

  it('BR-09: rejects a due date in the past with 400', async () => {
    const { token, client } = await managerWithClient();

    const res = await request(app).post('/api/invoices').set(authHeader(token))
      .send(createInvoiceBody(client, { dueDate: past() }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('BR-08: when items are given, amount is the sum of the lines', async () => {
    const { token, client } = await managerWithClient();
    const items = [
      { description: 'A', quantity: 2, unitPrice: 100, amount: 200 },
      { description: 'B', quantity: 3, unitPrice: 50,  amount: 150 }
    ];

    const res = await request(app).post('/api/invoices').set(authHeader(token))
      .send(createInvoiceBody(client, { amount: 9999, items }));

    expect(res.status).toBe(201);
    expect(res.body.invoice.amount).toBe(350);
  });

  it('BR-07: an invoice due in the past is created as overdue', async () => {
    const { manager, client } = await managerWithClient();

    // Bypass the Joi "future due date" rule to test the status computation itself.
    const invoice = await Invoice.create({
      invoiceNumber: `FAC-OVERDUE-${Date.now()}`,
      client: client._id,
      amount: 500,
      dueDate: past(5),
      createdBy: manager._id
    });

    expect(invoice.status).toBe('overdue');
  });
});

describe('PUT /api/invoices/:id — update (BR-03, BR-04)', () => {
  it('updates the description on an unpaid invoice', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager);

    const res = await request(app).put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ description: 'updated' });

    expect(res.status).toBe(200);
    expect(res.body.invoice.description).toBe('updated');
  });

  it('BR-03: cannot edit a paid invoice (400)', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager, { amount: 100, paidAmount: 100 });
    await invoice.save(); // runs the pre-save hook → status paid

    const res = await request(app).put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ description: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paid/i);
  });

  it('BR-04: cancelling without a reason → 400', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager);

    const res = await request(app).put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ status: 'cancelled' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
  });

  it('BR-04: cancelling with a reason → 200 and status cancelled', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager);

    const res = await request(app).put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ status: 'cancelled', cancelledReason: 'Issued by mistake' });

    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('cancelled');
  });

  it('BR-03: cannot edit a cancelled invoice (400)', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager);

    await request(app).put(`/api/invoices/${invoice._id}`).set(authHeader(token))
      .send({ status: 'cancelled', cancelledReason: 'oops' }).expect(200);

    const res = await request(app).put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ description: 'still not' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cancelled/i);
  });
});

describe('DELETE /api/invoices/:id (BR-05 + role matrix)', () => {
  // Admin-only endpoint (see role matrix). Manager 403 is asserted explicitly below.
  it('BR-05: rejects deleting a paid invoice (400)', async () => {
    const { admin, token, client } = await adminWithClient();
    const invoice = await createInvoice(client, admin, { amount: 100, paidAmount: 100 });
    await invoice.save();

    const res = await request(app).delete(`/api/invoices/${invoice._id}`).set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paid/i);
  });

  it('BR-05: rejects deleting an invoice with collection actions (400)', async () => {
    const { admin, token, client } = await adminWithClient();
    const invoice = await createInvoice(client, admin);

    await CollectionAction.create({
      invoice: invoice._id,
      client: client._id,
      actionType: 'phone_call',
      performedBy: admin._id,
      statusHistory: [{ to: 'planned', changedBy: admin._id }]
    });

    const res = await request(app).delete(`/api/invoices/${invoice._id}`).set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/collection actions/i);
  });

  it('deletes an unpaid invoice with no actions (200)', async () => {
    const { admin, token, client } = await adminWithClient();
    const invoice = await createInvoice(client, admin);

    const res = await request(app).delete(`/api/invoices/${invoice._id}`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(await Invoice.findById(invoice._id)).toBeNull();
  });

  it('role matrix: a manager cannot delete any invoice (403)', async () => {
    const { manager, token, client } = await managerWithClient();
    const invoice = await createInvoice(client, manager);

    const res = await request(app).delete(`/api/invoices/${invoice._id}`).set(authHeader(token));

    expect(res.status).toBe(403);
    expect(await Invoice.findById(invoice._id)).not.toBeNull();
  });

  it('role matrix: an agent cannot delete any invoice (403)', async () => {
    const { user: agent, token } = await createUserWithToken('agent');
    const client = await createClient(agent);
    const invoice = await createInvoice(client, agent);

    const res = await request(app).delete(`/api/invoices/${invoice._id}`).set(authHeader(token));

    expect(res.status).toBe(403);
    expect(await Invoice.findById(invoice._id)).not.toBeNull();
  });
});

describe('GET /api/invoices — search, filter, pagination', () => {
  it('filters by status and by client', async () => {
    const { manager, token, client } = await managerWithClient();
    await createInvoice(client, manager, { invoiceNumber: 'FAC-A' });
    const paid = await createInvoice(client, manager, { invoiceNumber: 'FAC-B', amount: 1000, paidAmount: 1000 });
    await paid.save(); // run the hook so status becomes paid

    const unpaid = await request(app).get('/api/invoices?status=unpaid').set(authHeader(token));

    expect(unpaid.status).toBe(200);
    expect(unpaid.body.invoices.every(i => i.status === 'unpaid')).toBe(true);
  });

  it('searches by invoice number prefix (case-insensitive)', async () => {
    const { manager, token, client } = await managerWithClient();
    await createInvoice(client, manager, { invoiceNumber: 'FAC-SEARCH-1' });
    await createInvoice(client, manager, { invoiceNumber: 'OTHER-1' });

    const res = await request(app).get('/api/invoices?search=fac-search').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.invoices[0].invoiceNumber).toBe('FAC-SEARCH-1');
  });

  it('paginates with page/limit', async () => {
    const { manager, token, client } = await managerWithClient();
    for (let i = 0; i < 5; i++) await createInvoice(client, manager);

    const res = await request(app).get('/api/invoices?page=2&limit=2').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.invoices).toHaveLength(2);
  });
});