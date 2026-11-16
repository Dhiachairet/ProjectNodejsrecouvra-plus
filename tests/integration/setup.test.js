// Checks the shared test setup itself, and shows how to write an API test. Copy this file to start a new one.
import { describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUser, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

describe('Shared test setup', () => {
  it('serves the health endpoint', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('logs a created user in and returns their profile', async () => {
    const { user, token } = await createUserWithToken('manager');

    const res = await request(app).get('/api/auth/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe('manager');
  });

  it('rejects a wrong password', async () => {
    const user = await createUser('agent');

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('starts every test with an empty database', async () => {
    expect(await mongoose.connection.collection('users').countDocuments()).toBe(0);
  });

  it('builds test data with the factories', async () => {
    const { user: agent, token } = await createUserWithToken('agent');
    const client = await createClient(agent);
    await createInvoice(client, agent, { amount: 250 });

    const res = await request(app).get('/api/invoices').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect((await Client.findById(client._id)).totalUnpaid).toBe(250);
  });

  it('supports MongoDB transactions', async () => {
    const owner = await createUser('agent');
    const clientData = (name) => ({ name, email: `${name}@example.com`, phone: '+216 20 000 000', createdBy: owner._id });

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Client.create([clientData('committed')], { session });
      await session.commitTransaction();

      session.startTransaction();
      await Client.create([clientData('rolledback')], { session });
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    expect(await Client.countDocuments({ name: 'committed' })).toBe(1);
    expect(await Client.countDocuments({ name: 'rolledback' })).toBe(0);
  });
});
