// Integration tests: clients via the real API + in-memory MongoDB.
// Rule references: BR-06, BR-12.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

describe('POST /api/clients — create (BR-12)', () => {
  it('creates a new client successfully', async () => {
    const { token } = await createUserWithToken('manager');

    const res = await request(app)
      .post('/api/clients')
      .set(authHeader(token))
      .send({
        name: 'Acme Corp',
        email: 'contact@acme.com',
        phone: '+216 20 000 000',
        company: 'Acme'
      });

    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe('Acme Corp');
  });

  it('BR-12: rejects a duplicate email for the same creator (400)', async () => {
    const { token } = await createUserWithToken('manager');
    const body = { name: 'Acme', email: 'dup@acme.com', phone: '+216 20 000 000' };

    await request(app).post('/api/clients').set(authHeader(token)).send(body).expect(201);
    
    const res = await request(app).post('/api/clients').set(authHeader(token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe('DELETE /api/clients/:id (BR-06)', () => {
  it('BR-06: rejects deleting a client with existing invoices (400)', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);
    
    // Create an invoice for this client
    await createInvoice(client, manager);

    const res = await request(app)
      .delete(`/api/clients/${client._id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/existing invoices/i);
  });

  it('deletes a client with no invoices (200)', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);

    const res = await request(app)
      .delete(`/api/clients/${client._id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(await Client.findById(client._id)).toBeNull();
  });
});

describe('GET /api/clients — search', () => {
  it('searches clients by text index', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    await createClient(manager, { name: 'Alpha Beta', company: 'Alpha Inc' });
    await createClient(manager, { name: 'Gamma Delta', company: 'Gamma LLC' });

    const res = await request(app)
      .get('/api/clients?search=Alpha')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.clients[0].name).toBe('Alpha Beta');
  });
});