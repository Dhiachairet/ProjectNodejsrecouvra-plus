// Security audit 3.3 (B): role matrix of docs/BUSINESS_RULES.md checked against the real endpoints.
// Agent A owns the portfolio under test, agent B owns another one, the manager and the admin see everything.
import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { Invoice } from '../../src/models/Invoice.js';
import { CollectionAction } from '../../src/models/CollectionAction.js';
import { User } from '../../src/models/User.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUser } from '../helpers/auth.js';
import { createClient, createInvoice, createCollectionAction } from '../helpers/factories.js';
import { createScenario } from '../helpers/portfolios.js';

useTestDB();

const DENIED = [403, 404];
const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

let s;
let tokens;

beforeEach(async () => {
  s = await createScenario();
  tokens = { agent: s.a.token, manager: s.manager.token, admin: s.admin.token };
});

const send = (method, url, token, body) => {
  const req = request(app)[method](url).set(authHeader(token));
  return body === undefined ? req : req.send(body);
};

const newInvoiceBody = (client) => {
  sequence += 1;
  return { invoiceNumber: `SEC-${sequence}`, client: String(client._id), amount: 500, dueDate: new Date(Date.now() + 30 * DAY) };
};

describe('Viewing data', () => {
  const reads = [
    ['client', (p) => `/api/clients/${p.client.id}`],
    ['client invoices', (p) => `/api/clients/${p.client.id}/invoices`],
    ['invoice', (p) => `/api/invoices/${p.invoice.id}`],
    ['invoice payments', (p) => `/api/invoices/${p.invoice.id}/payments`],
    ['collection action', (p) => `/api/collections/${p.action.id}`],
    ['actions of an invoice', (p) => `/api/collections/invoice/${p.invoice.id}`],
    ['actions of a client', (p) => `/api/collections/client/${p.client.id}`]
  ];

  describe.each(['agent', 'manager', 'admin'])('%s reading their own / the visible portfolio', (role) => {
    it.each(reads)('can read the %s', async (label, url) => {
      const res = await send('get', url(s.a), tokens[role]);

      expect(res.status).toBe(200);
    });
  });

  describe('another agent\'s portfolio', () => {
    it.each(reads)('is refused to an agent: %s', async (label, url) => {
      const res = await send('get', url(s.b), tokens.agent);

      expect(DENIED).toContain(res.status);
    });

    it.each(['manager', 'admin'])('is readable by the %s', async (role) => {
      for (const [, url] of reads) {
        const res = await send('get', url(s.b), tokens[role]);
        expect(res.status).toBe(200);
      }
    });
  });

  it('lists only the agent\'s own clients, but every client for a manager and an admin', async () => {
    const agentList = await send('get', '/api/clients', tokens.agent);
    const managerList = await send('get', '/api/clients', tokens.manager);
    const adminList = await send('get', '/api/clients', tokens.admin);

    expect(agentList.body.clients.map(c => c._id)).toEqual([s.a.client.id]);
    expect(managerList.body.total).toBe(2);
    expect(adminList.body.total).toBe(2);
  });
});

describe('Creating and modifying clients, invoices, payments and actions', () => {
  describe.each(['agent', 'manager', 'admin'])('%s', (role) => {
    it('creates a client', async () => {
      const res = await send('post', '/api/clients', tokens[role], { name: 'New client', email: `new-${role}@example.com`, phone: '+216 20 111 222' });

      expect(res.status).toBe(201);
    });

    it('updates a client', async () => {
      const res = await send('put', `/api/clients/${s.a.client.id}`, tokens[role], { notes: 'updated' });

      expect(res.status).toBe(200);
    });

    it('creates an invoice', async () => {
      const res = await send('post', '/api/invoices', tokens[role], newInvoiceBody(s.a.client));

      expect(res.status).toBe(201);
    });

    it('updates an invoice', async () => {
      const res = await send('put', `/api/invoices/${s.a.invoice.id}`, tokens[role], { description: 'updated' });

      expect(res.status).toBe(200);
    });

    it('records a payment', async () => {
      const res = await send('post', `/api/invoices/${s.a.invoice.id}/payments`, tokens[role], { amount: 100, paymentMethod: 'cash' });

      expect(res.status).toBe(201);
    });

    it('creates a collection action', async () => {
      const res = await send('post', '/api/collections', tokens[role], { invoice: s.a.invoice.id, actionType: 'email' });

      expect(res.status).toBe(201);
    });
  });

  it('lets the manager and the admin update an action created by an agent', async () => {
    for (const role of ['manager', 'admin']) {
      const res = await send('put', `/api/collections/${s.a.action.id}`, tokens[role], { notes: `by ${role}` });
      expect(res.status).toBe(200);
    }
  });

  it('lets an agent update their own action', async () => {
    const res = await send('put', `/api/collections/${s.a.action.id}`, tokens.agent, { notes: 'mine' });

    expect(res.status).toBe(200);
  });

  it('does not let an agent update an action created by someone else', async () => {
    const res = await send('put', `/api/collections/${s.b.action.id}`, tokens.agent, { notes: 'hijacked' });

    expect(DENIED).toContain(res.status);
    expect((await CollectionAction.findById(s.b.action._id)).notes).toBeUndefined();
  });
});

describe('Assigning an agent to a client', () => {
  it('is refused to an agent, even on their own client', async () => {
    const res = await send('put', `/api/clients/${s.a.client.id}/agents`, tokens.agent, { agents: [s.a.agent.id] });

    expect(res.status).toBe(403);
    expect((await Client.findById(s.a.client._id)).assignedAgents).toHaveLength(0);
  });

  it.each(['manager', 'admin'])('is allowed to the %s', async (role) => {
    const res = await send('put', `/api/clients/${s.a.client.id}/agents`, tokens[role], { agents: [s.b.agent.id] });

    expect(res.status).toBe(200);
    expect((await Client.findById(s.a.client._id)).assignedAgents.map(String)).toEqual([s.b.agent.id]);
  });
});

describe('Cancelling a collection action', () => {
  it('is refused to an agent, even on their own action', async () => {
    const res = await send('patch', `/api/collections/${s.a.action.id}/status`, tokens.agent, { status: 'cancelled' });

    expect(res.status).toBe(403);
    expect((await CollectionAction.findById(s.a.action._id)).status).toBe('planned');
  });

  it.each(['manager', 'admin'])('is allowed to the %s', async (role) => {
    const res = await send('patch', `/api/collections/${s.a.action.id}/status`, tokens[role], { status: 'cancelled' });

    expect(res.status).toBe(200);
    expect((await CollectionAction.findById(s.a.action._id)).status).toBe('cancelled');
  });
});

describe('Deleting data', () => {
  describe('a client', () => {
    it('is refused to an agent', async () => {
      const client = await createClient(s.a.agent);

      const res = await send('delete', `/api/clients/${client.id}`, tokens.agent);

      expect(res.status).toBe(403);
      expect(await Client.findById(client._id)).not.toBeNull();
    });

    it.each(['manager', 'admin'])('is allowed to the %s', async (role) => {
      const client = await createClient(s.a.agent);

      const res = await send('delete', `/api/clients/${client.id}`, tokens[role]);

      expect(res.status).toBe(200);
      expect(await Client.findById(client._id)).toBeNull();
    });
  });

  describe('an invoice', () => {
    it.each(['agent', 'manager'])('is refused to the %s', async (role) => {
      const invoice = await createInvoice(s.a.client, s.a.agent);

      const res = await send('delete', `/api/invoices/${invoice.id}`, tokens[role]);

      expect(res.status).toBe(403);
      expect(await Invoice.findById(invoice._id)).not.toBeNull();
    });

    it('is allowed to the admin', async () => {
      const invoice = await createInvoice(s.a.client, s.a.agent);

      const res = await send('delete', `/api/invoices/${invoice.id}`, tokens.admin);

      expect(res.status).toBe(200);
      expect(await Invoice.findById(invoice._id)).toBeNull();
    });
  });

  describe('a collection action', () => {
    it.each(['agent', 'manager'])('is refused to the %s', async (role) => {
      const action = await createCollectionAction(s.a.invoice, s.a.agent);

      const res = await send('delete', `/api/collections/${action.id}`, tokens[role]);

      expect(res.status).toBe(403);
      expect(await CollectionAction.findById(action._id)).not.toBeNull();
    });

    it('is allowed to the admin', async () => {
      const action = await createCollectionAction(s.a.invoice, s.a.agent);

      const res = await send('delete', `/api/collections/${action.id}`, tokens.admin);

      expect(res.status).toBe(200);
      expect(await CollectionAction.findById(action._id)).toBeNull();
    });
  });
});

describe('User management', () => {
  describe('listing and reading users', () => {
    it('is refused to an agent', async () => {
      const list = await send('get', '/api/users', tokens.agent);
      const one = await send('get', `/api/users/${s.b.agent.id}`, tokens.agent);

      expect(list.status).toBe(403);
      expect(one.status).toBe(403);
    });

    it.each(['manager', 'admin'])('is allowed to the %s', async (role) => {
      const list = await send('get', '/api/users', tokens[role]);
      const one = await send('get', `/api/users/${s.b.agent.id}`, tokens[role]);

      expect(list.status).toBe(200);
      expect(list.body.users).toHaveLength(4);
      expect(one.status).toBe(200);
    });

    it('never exposes password hashes', async () => {
      const res = await send('get', '/api/users', tokens.admin);

      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    });
  });

  describe.each(['agent', 'manager'])('editing or deleting a user as %s', (role) => {
    it('is refused', async () => {
      const target = await createUser('agent');

      const update = await send('put', `/api/users/${target.id}`, tokens[role], { role: 'admin' });
      const remove = await send('delete', `/api/users/${target.id}`, tokens[role]);

      expect(update.status).toBe(403);
      expect(remove.status).toBe(403);
      expect((await User.findById(target._id)).role).toBe('agent');
    });

    it('cannot promote their own account', async () => {
      const own = role === 'agent' ? s.a.agent : s.manager.user;

      const res = await send('put', `/api/users/${own.id}`, tokens[role], { role: 'admin' });

      expect(res.status).toBe(403);
      expect((await User.findById(own._id)).role).toBe(role);
    });
  });

  it('lets the admin edit and delete a user', async () => {
    const target = await createUser('agent');

    const update = await send('put', `/api/users/${target.id}`, tokens.admin, { role: 'manager' });
    const remove = await send('delete', `/api/users/${target.id}`, tokens.admin);

    expect(update.status).toBe(200);
    expect(update.body.user.role).toBe('manager');
    expect(remove.status).toBe(200);
    expect(await User.findById(target._id)).toBeNull();
  });
});

describe('Audit log', () => {
  it.each(['agent', 'manager'])('is refused to the %s', async (role) => {
    const res = await send('get', '/api/audit', tokens[role]);

    expect(res.status).toBe(403);
  });

  it('is readable by the admin', async () => {
    const res = await send('get', '/api/audit', tokens.admin);

    expect(res.status).toBe(200);
  });

  it('has no endpoint to change it', async () => {
    for (const method of ['post', 'put', 'delete']) {
      const res = await send(method, '/api/audit', tokens.admin, {});
      expect(res.status).toBe(404);
    }
  });
});
