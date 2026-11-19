// DEF-01 (§6.2 performance, §6.6 security): the page size must be capped,
// otherwise ?limit=100000 returns the whole collection in one response.
// Boundary values (Cours 1 p7): 100 accepted, 101 capped, 0 and negative fall back to the default.
import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { Invoice } from '../../src/models/Invoice.js';
import { CollectionAction } from '../../src/models/CollectionAction.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient } from '../helpers/factories.js';

useTestDB();

const COUNT = 101;
const DAY = 24 * 60 * 60 * 1000;

let token;

beforeEach(async () => {
  const admin = await createUserWithToken('admin');
  token = admin.token;
  const owner = admin.user;

  const clients = await Client.insertMany(Array.from({ length: COUNT }, (_, i) => ({
    name: `Client ${i}`, email: `c${i}@example.com`, phone: '+216 20 000 000', createdBy: owner._id
  })));
  const client = await createClient(owner);
  const invoices = await Invoice.insertMany(Array.from({ length: COUNT }, (_, i) => ({
    invoiceNumber: `LIM-${String(i).padStart(4, '0')}`, client: client._id, amount: 100,
    dueDate: new Date(Date.now() + 30 * DAY), createdBy: owner._id
  })));
  await CollectionAction.insertMany(invoices.map(invoice => ({
    invoice: invoice._id, client: client._id, actionType: 'phone_call', performedBy: owner._id
  })));
  expect(clients).toHaveLength(COUNT);
});

const lists = [
  ['/api/invoices', 'invoices'],
  ['/api/clients', 'clients'],
  ['/api/collections', 'actions']
];

describe.each(lists)('DEF-01 page size of %s', (path, key) => {
  const get = (query) => request(app).get(`${path}?${query}`).set(authHeader(token));

  it('CT-P-LIM-01 limit=100 (boundary, valid) returns 100 items', async () => {
    const res = await get('limit=100');
    expect(res.status).toBe(200);
    expect(res.body[key]).toHaveLength(100);
  });

  it('CT-E-LIM-01 limit=101 (just above) is capped at 100', async () => {
    const res = await get('limit=101');
    expect(res.status).toBe(200);
    expect(res.body[key]).toHaveLength(100);
    expect(res.body.pages).toBe(2);
  });

  it('CT-E-LIM-02 limit=100000 is capped at 100', async () => {
    const res = await get('limit=100000');
    expect(res.status).toBe(200);
    expect(res.body[key]).toHaveLength(100);
  });

  it('CT-E-LIM-03 limit=0 and negative limits fall back to the default page size', async () => {
    for (const limit of ['0', '-5', 'abc']) {
      const res = await get(`limit=${limit}`);
      expect(res.status).toBe(200);
      expect(res.body[key]).toHaveLength(10);
    }
  });

  it('CT-E-LIM-04 page=0 or a negative page is treated as page 1 (no server error)', async () => {
    for (const page of ['0', '-1']) {
      const res = await get(`page=${page}`);
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
    }
  });
});
