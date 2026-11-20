// Security audit 3.3 (C): an agent must neither read nor modify the portfolio of another agent (BR-14).
// Agent A attacks the data of agent B with A's own valid token. 404 is accepted: it hides that the resource exists.
import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { Invoice } from '../../src/models/Invoice.js';
import { CollectionAction } from '../../src/models/CollectionAction.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader } from '../helpers/auth.js';
import { createScenario } from '../helpers/portfolios.js';

useTestDB();

const DENIED = [403, 404];
const DAY = 24 * 60 * 60 * 1000;

let a;
let b;

beforeEach(async () => {
  ({ a, b } = await createScenario());
});

// Requests sent by agent A
const asA = (method, url, body) => {
  const req = request(app)[method](url).set(authHeader(a.token));
  return body === undefined ? req : req.send(body);
};

describe('Agent A against the portfolio of agent B', () => {
  describe('reading', () => {
    it.each([
      ['the client', () => `/api/clients/${b.client.id}`],
      ['the invoices of the client', () => `/api/clients/${b.client.id}/invoices`],
      ['the invoice', () => `/api/invoices/${b.invoice.id}`],
      ['the payments of the invoice', () => `/api/invoices/${b.invoice.id}/payments`],
      ['the collection action', () => `/api/collections/${b.action.id}`],
      ['the actions of the invoice', () => `/api/collections/invoice/${b.invoice.id}`],
      ['the actions of the client', () => `/api/collections/client/${b.client.id}`]
    ])('is refused for %s', async (label, url) => {
      const res = await asA('get', url());

      expect(DENIED).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain(b.client.name);
      expect(JSON.stringify(res.body)).not.toContain(b.invoice.invoiceNumber);
    });
  });

  describe('lists', () => {
    it('do not contain the data of B', async () => {
      const clients = await asA('get', '/api/clients');
      const invoices = await asA('get', '/api/invoices');
      const actions = await asA('get', '/api/collections');

      expect(clients.body.clients.map(c => c._id)).toEqual([a.client.id]);
      expect(invoices.body.invoices.map(i => i._id)).toEqual([a.invoice.id]);
      expect(actions.body.actions.map(x => x._id)).toEqual([a.action.id]);
    });

    it('stay empty when A filters on the client of B', async () => {
      const invoices = await asA('get', `/api/invoices?client=${b.client.id}`);
      const actions = await asA('get', `/api/collections?client=${b.client.id}`);

      expect(invoices.body.total).toBe(0);
      expect(actions.body.total).toBe(0);
    });

    it('stay empty when A searches the invoice number of B', async () => {
      const res = await asA('get', `/api/invoices?search=${encodeURIComponent(b.invoice.invoiceNumber)}`);

      expect(res.body.total).toBe(0);
    });

    it('do not let A filter clients by the agent B', async () => {
      const res = await asA('get', `/api/clients?agent=${b.agent.id}`);

      expect(res.body.clients.map(c => c._id)).toEqual([a.client.id]);
    });
  });

  describe('modifying', () => {
    it('is refused for the client', async () => {
      const res = await asA('put', `/api/clients/${b.client.id}`, { notes: 'hijacked', phone: '+216 99 999 999' });

      expect(DENIED).toContain(res.status);
      const stored = await Client.findById(b.client._id);
      expect(stored.notes).toBeUndefined();
      expect(stored.phone).toBe(b.client.phone);
    });

    it('is refused for the invoice', async () => {
      const res = await asA('put', `/api/invoices/${b.invoice.id}`, { description: 'hijacked' });

      expect(DENIED).toContain(res.status);
      expect((await Invoice.findById(b.invoice._id)).description).toBeUndefined();
    });

    it('is refused when cancelling the invoice', async () => {
      const res = await asA('put', `/api/invoices/${b.invoice.id}`, { status: 'cancelled', cancelledReason: 'attack' });

      expect(DENIED).toContain(res.status);
      expect((await Invoice.findById(b.invoice._id)).status).not.toBe('cancelled');
    });

    it('is refused when recording a payment', async () => {
      const res = await asA('post', `/api/invoices/${b.invoice.id}/payments`, { amount: 1000, paymentMethod: 'cash' });

      expect(DENIED).toContain(res.status);
      const stored = await Invoice.findById(b.invoice._id);
      expect(stored.payments).toHaveLength(0);
      expect(stored.paidAmount).toBe(0);
      expect(stored.status).not.toBe('paid');
    });

    it('is refused for the collection action', async () => {
      const res = await asA('put', `/api/collections/${b.action.id}`, { notes: 'hijacked' });

      expect(DENIED).toContain(res.status);
      expect((await CollectionAction.findById(b.action._id)).notes).toBeUndefined();
    });

    it('is refused when changing the status of the action', async () => {
      const res = await asA('patch', `/api/collections/${b.action.id}/status`, { status: 'completed', result: 'attack' });

      expect(DENIED).toContain(res.status);
      expect((await CollectionAction.findById(b.action._id)).status).toBe('planned');
    });

    it('is refused when assigning agents to the client', async () => {
      const res = await asA('put', `/api/clients/${b.client.id}/agents`, { agents: [a.agent.id] });

      expect(DENIED).toContain(res.status);
      expect((await Client.findById(b.client._id)).assignedAgents).toHaveLength(0);
    });

    it('is refused when deleting the client, the invoice and the action', async () => {
      const results = [
        await asA('delete', `/api/clients/${b.client.id}`),
        await asA('delete', `/api/invoices/${b.invoice.id}`),
        await asA('delete', `/api/collections/${b.action.id}`)
      ];

      results.forEach(res => expect(DENIED).toContain(res.status));
      expect(await Client.countDocuments({ _id: b.client._id })).toBe(1);
      expect(await Invoice.countDocuments({ _id: b.invoice._id })).toBe(1);
      expect(await CollectionAction.countDocuments({ _id: b.action._id })).toBe(1);
    });
  });

  describe('creating data inside the portfolio of B', () => {
    it('refuses an invoice for the client of B', async () => {
      const res = await asA('post', '/api/invoices', {
        invoiceNumber: 'INTRUDER-1',
        client: b.client.id,
        amount: 100,
        dueDate: new Date(Date.now() + 30 * DAY)
      });

      expect(DENIED).toContain(res.status);
      expect(await Invoice.countDocuments({ invoiceNumber: 'INTRUDER-1' })).toBe(0);
    });

    it('refuses an action on the invoice of B', async () => {
      const before = await CollectionAction.countDocuments({ invoice: b.invoice._id });

      const res = await asA('post', '/api/collections', { invoice: b.invoice.id, actionType: 'email' });

      expect(DENIED).toContain(res.status);
      expect(await CollectionAction.countDocuments({ invoice: b.invoice._id })).toBe(before);
    });
  });

  describe('legitimate sharing', () => {
    it('lets A work on the client of B once a manager has assigned A to it', async () => {
      await Client.updateOne({ _id: b.client._id }, { assignedAgents: [a.agent._id] });

      const read = await asA('get', `/api/clients/${b.client.id}`);
      const invoice = await asA('get', `/api/invoices/${b.invoice.id}`);
      const payment = await asA('post', `/api/invoices/${b.invoice.id}/payments`, { amount: 100, paymentMethod: 'cash' });

      expect(read.status).toBe(200);
      expect(invoice.status).toBe(200);
      expect(payment.status).toBe(201);
    });

    it('lets A keep full access to their own portfolio', async () => {
      const client = await asA('get', `/api/clients/${a.client.id}`);
      const payment = await asA('post', `/api/invoices/${a.invoice.id}/payments`, { amount: 100, paymentMethod: 'cash' });

      expect(client.status).toBe(200);
      expect(payment.status).toBe(201);
    });
  });
});
