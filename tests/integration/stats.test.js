// Characterization tests for the dashboard statistics (GET /api/stats and GET /api/stats/summary).
// They pin down what the current controller returns, so a refactor of it can be proven to change nothing.
// Every expected number comes from the small dataset in seedDataset() and was computed by hand.
import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUser, createUserWithToken } from '../helpers/auth.js';
import { createClient, createCollectionAction, createInvoice } from '../helpers/factories.js';

useTestDB();

const DAY = 24 * 60 * 60 * 1000;
const SEED_TIMEOUT = 60000;

const id = (doc) => doc._id.toString();
const iso = (date) => date.toISOString();
const shift = (date, ms) => new Date(date.getTime() + ms);

// Local noon on `day` of the month `monthsAgo` months before `ref`. The controller builds its 12-month
// window in local time, and mid-month noon falls in the same month in UTC too, whatever the timezone.
const inMonth = (ref, monthsAgo, day) => new Date(ref.getFullYear(), ref.getMonth() - monthsAgo, day, 12);

// Same key as the controller's $dateToString '%Y-%m', which MongoDB computes in UTC
const monthKey = (date) => date.toISOString().slice(0, 7);

// YYYY-MM-DD, the format the dashboard's <input type="date"> sends
const dateParam = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')
].join('-');

const payment = (amount, paymentDate, receivedBy, paymentMethod) => ({
  amount,
  paymentDate,
  receivedBy: receivedBy._id,
  paymentMethod
});

const fetchStats = (token, query = {}) => request(app).get('/api/stats').query(query).set(authHeader(token));
const fetchSummary = (token, query = {}) => request(app).get('/api/stats/summary').query(query).set(authHeader(token));

// The controller reads the clock again for every request. Seeding a few seconds before local midnight
// could move "today" (and on the last day of a month, "this month") before the request, so wait it out.
async function waitIfMidnightIsClose() {
  const now = new Date();
  const untilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
  if (untilMidnight < 20000) {
    await new Promise(resolve => setTimeout(resolve, untilMidnight + 100));
  }
}

// Portfolios: agent A = Alpha (created), Beta (assigned), Delta (assigned)
//             agent B = Gamma (created), Zeta (created), Delta (assigned)
//             Epsilon is in no agent's portfolio
async function seedDataset() {
  await waitIfMidnightIsClose();
  const ref = new Date();
  const at = (monthsAgo, day) => inMonth(ref, monthsAgo, day);
  const inDays = (days) => shift(ref, days * DAY);

  const [admin, manager, agentA, agentB] = await Promise.all([
    createUserWithToken('admin', { firstName: 'Ada', lastName: 'Adams' }),
    createUserWithToken('manager', { firstName: 'Mona', lastName: 'Mansour' }),
    createUserWithToken('agent', { firstName: 'Amine', lastName: 'Ayari' }),
    createUserWithToken('agent', { firstName: 'Bilel', lastName: 'Bouzid' }),
    createUser('agent', { firstName: 'Ines', lastName: 'Idle', active: false })
  ]);

  const [alpha, beta, gamma, delta, epsilon, zeta] = await Promise.all([
    createClient(agentA.user, { name: 'Alpha Trading', company: 'Alpha SARL', email: 'contact@alpha.tn' }),
    createClient(manager.user, {
      name: 'Beta Foods', company: 'Beta SA', email: 'contact@beta.tn', assignedAgents: [agentA.user._id]
    }),
    createClient(agentB.user, { name: 'Gamma Tech', company: 'Gamma SUARL', email: 'contact@gamma.tn' }),
    createClient(manager.user, {
      name: 'Delta Build', company: 'Delta SA', email: 'contact@delta.tn', assignedAgents: [agentA.user._id, agentB.user._id]
    }),
    createClient(manager.user, { name: 'Epsilon Retail', company: 'Epsilon SARL', email: 'contact@epsilon.tn' }),
    createClient(agentB.user, { name: 'Zeta Services', company: 'Zeta SA', email: 'contact@zeta.tn' })
  ]);

  const invoice = (client, invoiceNumber, fields) => createInvoice(client, manager.user, { invoiceNumber, ...fields });

  // The model derives the status on save from paidAmount and dueDate; the result is noted at the end of each line
  const [inv1, inv2, inv3, inv4, inv5, inv6, inv7, inv8, inv9, inv10, inv11] = await Promise.all([
    invoice(alpha, 'INV-001', { amount: 1000, issueDate: at(1, 10), dueDate: inDays(30) }), // unpaid
    invoice(alpha, 'INV-002', {
      amount: 2000, paidAmount: 500, issueDate: at(2, 10), dueDate: inDays(-10),
      payments: [payment(500, at(1, 20), agentA.user, 'bank_transfer')]
    }), // partially_paid, past due
    invoice(beta, 'INV-003', {
      amount: 1500, paidAmount: 1500, issueDate: at(3, 10), dueDate: inDays(-20),
      payments: [payment(900, at(3, 20), agentA.user, 'cash'), payment(600, at(2, 18), manager.user, 'check')]
    }), // paid
    invoice(beta, 'INV-004', { amount: 800, issueDate: at(0, 15), dueDate: inDays(3) }), // unpaid, due this week
    invoice(gamma, 'INV-005', { amount: 3000, issueDate: at(5, 10), dueDate: inDays(-15) }), // overdue
    invoice(gamma, 'INV-006', {
      amount: 1200, paidAmount: 200, issueDate: at(1, 12), dueDate: inDays(5),
      payments: [payment(200, at(1, 25), agentB.user, 'credit_card')]
    }), // partially_paid, due this week
    invoice(delta, 'INV-007', {
      amount: 650, paidAmount: 650, issueDate: at(2, 12), dueDate: inDays(10),
      payments: [payment(650, at(2, 22), agentB.user, 'bank_transfer')]
    }), // paid
    invoice(delta, 'INV-008', { amount: 900, status: 'cancelled', issueDate: at(2, 14), dueDate: inDays(-5) }), // cancelled
    invoice(delta, 'INV-009', { amount: 700, issueDate: at(11, 15), dueDate: inDays(20) }), // unpaid
    invoice(epsilon, 'INV-010', { amount: 400, issueDate: at(12, 15), dueDate: inDays(-30) }), // overdue
    invoice(zeta, 'INV-011', {
      amount: 2500, paidAmount: 1000, issueDate: at(3, 12), dueDate: inDays(60),
      payments: [payment(1000, ref, agentB.user, 'cash')]
    }) // partially_paid, paid in part today
  ]);

  const action = (inv, performer, actionType, status, actionDate) =>
    createCollectionAction(inv, performer, { actionType, status, actionDate });

  await Promise.all([
    action(inv2, agentA.user, 'phone_call', 'completed', at(1, 21)),
    action(inv5, agentB.user, 'email', 'failed', at(1, 8)),
    action(inv5, agentB.user, 'reminder_letter', 'planned', at(1, 26)),
    action(inv9, agentA.user, 'meeting', 'planned', at(2, 5)),
    action(inv10, manager.user, 'legal_notice', 'cancelled', at(3, 6)),
    action(inv1, agentA.user, 'visit', 'planned', at(1, 15)),
    action(inv11, agentB.user, 'email', 'completed', at(2, 25))
  ]);

  return {
    ref,
    at,
    inDays,
    users: { admin, manager, agentA, agentB },
    clients: { alpha, beta, gamma, delta, epsilon, zeta },
    invoices: { inv1, inv2, inv3, inv4, inv5, inv6, inv7, inv8, inv9, inv10, inv11 }
  };
}

const topClient = (client, totalUnpaid, invoiceCount) => ({
  _id: id(client),
  totalUnpaid,
  invoiceCount,
  client: { _id: id(client), name: client.name, company: client.company, email: client.email }
});

const collector = (user, collected, payments) => ({
  _id: id(user),
  collected,
  payments,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role
});

// Payment rows carry the invoice _id because the aggregation never removes it
const paymentActivity = (invoice, date, amount, clientName, method) => ({
  _id: id(invoice),
  type: 'payment',
  date: iso(date),
  amount,
  clientName,
  invoiceNumber: invoice.invoiceNumber,
  method
});

const actionActivity = (date, actionType, clientName, invoiceNumber, status) => ({
  type: 'collection',
  date: iso(date),
  actionType,
  clientName,
  invoiceNumber,
  status
});

const NO_FILTERS = { from: null, to: null, agent: null, client: null };

// userStats is never filtered: always the whole user base (the inactive agent counts in total only)
const USER_STATS = {
  admin: { total: 1, active: 1 },
  manager: { total: 1, active: 1 },
  agent: { total: 3, active: 2 }
};

const emptyStats = (userStats) => ({
  overview: {
    totalClients: 0,
    totalInvoices: 0,
    totalAmount: 0,
    totalPaid: 0,
    unpaidAmount: 0,
    recoveryRate: 0,
    collectedInPeriod: 0,
    overdueCount: 0,
    dueThisWeek: 0,
    plannedActions: 0
  },
  invoicesByStatus: {},
  monthlyStats: [],
  topClients: [],
  collectionStats: {},
  collectedByAgent: [],
  recentActivities: [],
  userStats
});

describe('GET /api/stats', () => {
  let d;

  beforeEach(async () => {
    d = await seedDataset();
  }, SEED_TIMEOUT);

  describe('without filters', () => {
    it('returns the whole dashboard for a manager', async () => {
      const { ref, at } = d;
      const { manager, agentA, agentB } = d.users;
      const { alpha, beta, gamma, delta, zeta } = d.clients;
      const { inv2, inv3, inv6, inv7, inv11 } = d.invoices;

      const res = await fetchStats(manager.token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        filters: NO_FILTERS,
        stats: {
          overview: {
            totalClients: 6,
            totalInvoices: 10,
            totalAmount: 13750,
            totalPaid: 3850,
            unpaidAmount: 9900,
            recoveryRate: 28,
            collectedInPeriod: 3850,
            overdueCount: 3,
            dueThisWeek: 2,
            plannedActions: 3
          },
          invoicesByStatus: {
            cancelled: { count: 1, totalAmount: 900, totalPaid: 0 },
            overdue: { count: 2, totalAmount: 3400, totalPaid: 0 },
            paid: { count: 2, totalAmount: 2150, totalPaid: 2150 },
            partially_paid: { count: 3, totalAmount: 5700, totalPaid: 1700 },
            unpaid: { count: 3, totalAmount: 2500, totalPaid: 0 }
          },
          // Oldest month first. The window starts 11 months back, so INV-010 (12 months back) is left out,
          // and so is the cancelled INV-008
          monthlyStats: [
            { month: monthKey(at(11, 15)), count: 1, totalAmount: 700, totalPaid: 0 },
            { month: monthKey(at(5, 15)), count: 1, totalAmount: 3000, totalPaid: 0 },
            { month: monthKey(at(3, 15)), count: 2, totalAmount: 4000, totalPaid: 2500 },
            { month: monthKey(at(2, 15)), count: 2, totalAmount: 2650, totalPaid: 1150 },
            { month: monthKey(at(1, 15)), count: 2, totalAmount: 2200, totalPaid: 200 },
            { month: monthKey(at(0, 15)), count: 1, totalAmount: 800, totalPaid: 0 }
          ],
          // Largest outstanding amount first, at most 5: Epsilon (400) is the sixth
          topClients: [
            topClient(gamma, 4000, 2),
            topClient(alpha, 2500, 2),
            topClient(zeta, 1500, 1),
            topClient(beta, 800, 1),
            topClient(delta, 700, 1)
          ],
          collectionStats: { planned: 3, completed: 2, failed: 1, cancelled: 1 },
          collectedByAgent: [
            collector(agentB.user, 1850, 3),
            collector(agentA.user, 1400, 2),
            collector(manager.user, 600, 1)
          ],
          // Newest first. Only the 5 latest payments and the 5 latest actions are merged,
          // so INV-003's cash payment and the meeting and legal notice actions drop out
          recentActivities: [
            paymentActivity(inv11, ref, 1000, 'Zeta Services', 'cash'),
            actionActivity(at(1, 26), 'reminder_letter', 'Gamma Tech', 'INV-005', 'planned'),
            paymentActivity(inv6, at(1, 25), 200, 'Gamma Tech', 'credit_card'),
            actionActivity(at(1, 21), 'phone_call', 'Alpha Trading', 'INV-002', 'completed'),
            paymentActivity(inv2, at(1, 20), 500, 'Alpha Trading', 'bank_transfer'),
            actionActivity(at(1, 15), 'visit', 'Alpha Trading', 'INV-001', 'planned'),
            actionActivity(at(1, 8), 'email', 'Gamma Tech', 'INV-005', 'failed'),
            actionActivity(at(2, 25), 'email', 'Zeta Services', 'INV-011', 'completed'),
            paymentActivity(inv7, at(2, 22), 650, 'Delta Build', 'bank_transfer'),
            paymentActivity(inv3, at(2, 18), 600, 'Beta Foods', 'check')
          ],
          userStats: USER_STATS
        }
      });
    });

    it('lists the top clients and the collectors by name, in order', async () => {
      const res = await fetchStats(d.users.manager.token);

      expect(res.body.stats.topClients.map(row => row.client.name))
        .toEqual(['Gamma Tech', 'Alpha Trading', 'Zeta Services', 'Beta Foods', 'Delta Build']);
      expect(res.body.stats.collectedByAgent.map(row => `${row.firstName} ${row.lastName} (${row.role})`))
        .toEqual(['Bilel Bouzid (agent)', 'Amine Ayari (agent)', 'Mona Mansour (manager)']);
    });

    it('gives an admin exactly the same dashboard as a manager', async () => {
      const managerView = await fetchStats(d.users.manager.token);
      const adminView = await fetchStats(d.users.admin.token);

      expect(adminView.status).toBe(200);
      expect(adminView.body).toEqual(managerView.body);
    });
  });

  describe('date range', () => {
    it('filters invoices by issue date, payments by payment date and actions by action date', async () => {
      const { at } = d;
      const { manager, agentA, agentB } = d.users;
      const { alpha, gamma } = d.clients;
      const { inv2, inv3, inv6, inv7 } = d.invoices;
      // First day of the month 2 months back to the last day of last month (day 0 of this month)
      const from = dateParam(at(2, 1));
      const to = dateParam(at(0, 0));

      const res = await fetchStats(manager.token, { from, to });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        // Echoed after Joi converted them to dates, not as sent
        filters: { from: `${from}T00:00:00.000Z`, to: `${to}T00:00:00.000Z`, agent: null, client: null },
        stats: {
          overview: {
            // The range does not apply to clients
            totalClients: 6,
            totalInvoices: 4,
            totalAmount: 4850,
            totalPaid: 1350,
            unpaidAmount: 3500,
            recoveryRate: 27.8,
            // Payments dated in the range, whatever the invoice issue date (INV-003's cheque counts)
            collectedInPeriod: 1950,
            overdueCount: 1,
            dueThisWeek: 1,
            plannedActions: 3
          },
          invoicesByStatus: {
            cancelled: { count: 1, totalAmount: 900, totalPaid: 0 },
            paid: { count: 1, totalAmount: 650, totalPaid: 650 },
            partially_paid: { count: 2, totalAmount: 3200, totalPaid: 700 },
            unpaid: { count: 1, totalAmount: 1000, totalPaid: 0 }
          },
          monthlyStats: [
            { month: monthKey(at(2, 15)), count: 2, totalAmount: 2650, totalPaid: 1150 },
            { month: monthKey(at(1, 15)), count: 2, totalAmount: 2200, totalPaid: 200 }
          ],
          topClients: [topClient(alpha, 2500, 2), topClient(gamma, 1000, 1)],
          collectionStats: { completed: 2, failed: 1, planned: 3 },
          collectedByAgent: [
            collector(agentB.user, 850, 2),
            collector(manager.user, 600, 1),
            collector(agentA.user, 500, 1)
          ],
          // 4 payments and the 5 latest of the 6 actions in the range (the meeting drops out)
          recentActivities: [
            actionActivity(at(1, 26), 'reminder_letter', 'Gamma Tech', 'INV-005', 'planned'),
            paymentActivity(inv6, at(1, 25), 200, 'Gamma Tech', 'credit_card'),
            actionActivity(at(1, 21), 'phone_call', 'Alpha Trading', 'INV-002', 'completed'),
            paymentActivity(inv2, at(1, 20), 500, 'Alpha Trading', 'bank_transfer'),
            actionActivity(at(1, 15), 'visit', 'Alpha Trading', 'INV-001', 'planned'),
            actionActivity(at(1, 8), 'email', 'Gamma Tech', 'INV-005', 'failed'),
            actionActivity(at(2, 25), 'email', 'Zeta Services', 'INV-011', 'completed'),
            paymentActivity(inv7, at(2, 22), 650, 'Delta Build', 'bank_transfer'),
            paymentActivity(inv3, at(2, 18), 600, 'Beta Foods', 'check')
          ],
          userStats: USER_STATS
        }
      });
    });

    it('drops the 12-month window of monthlyStats when only an end date is given', async () => {
      const { at } = d;
      // Last day of the month 4 months back
      const to = dateParam(at(3, 0));

      const res = await fetchStats(d.users.manager.token, { to });

      expect(res.status).toBe(200);
      expect(res.body.filters).toEqual({ from: null, to: `${to}T00:00:00.000Z`, agent: null, client: null });
      expect(res.body.stats.overview).toEqual({
        totalClients: 6,
        totalInvoices: 3,
        totalAmount: 4100,
        totalPaid: 0,
        unpaidAmount: 4100,
        recoveryRate: 0,
        collectedInPeriod: 0,
        overdueCount: 2,
        dueThisWeek: 0,
        plannedActions: 0
      });
      // INV-010, 12 months back, is outside the default window but inside this range
      expect(res.body.stats.monthlyStats).toEqual([
        { month: monthKey(at(12, 15)), count: 1, totalAmount: 400, totalPaid: 0 },
        { month: monthKey(at(11, 15)), count: 1, totalAmount: 700, totalPaid: 0 },
        { month: monthKey(at(5, 15)), count: 1, totalAmount: 3000, totalPaid: 0 }
      ]);
      expect(res.body.stats.recentActivities).toEqual([]);
    });

    it('includes both ends: from its UTC midnight, to until 23:59:59.999 server local time', async () => {
      const { manager, agentA } = d.users;
      // The month 7 months back holds no seeded data, so only the records below can match
      const from = dateParam(d.at(7, 10));
      const to = dateParam(d.at(7, 20));
      // Same bounds as the controller computes them
      const start = new Date(from);
      const end = new Date(new Date(to).setHours(23, 59, 59, 999));
      const justBefore = shift(start, -1);
      const justAfter = shift(end, 1);

      const edgeInvoice = (invoiceNumber, amount, issueDate, fields = {}) => createInvoice(d.clients.epsilon, manager.user, {
        invoiceNumber, amount, issueDate, dueDate: d.inDays(60), ...fields
      });
      const [, paidInvoice] = await Promise.all([
        edgeInvoice('EDGE-1', 101, justBefore),
        edgeInvoice('EDGE-2', 202, start, {
          paidAmount: 15,
          payments: [justBefore, start, end, justAfter].map((date, i) => payment(2 ** i, date, agentA.user, 'cash'))
        }),
        edgeInvoice('EDGE-3', 303, end),
        edgeInvoice('EDGE-4', 404, justAfter)
      ]);
      await Promise.all([justBefore, start, end, justAfter]
        .map(actionDate => createCollectionAction(paidInvoice, agentA.user, { actionDate })));

      const res = await fetchStats(manager.token, { from, to });

      expect(res.status).toBe(200);
      expect(res.body.stats.overview).toEqual({
        totalClients: 6,
        totalInvoices: 2,
        totalAmount: 505,
        totalPaid: 15,
        unpaidAmount: 490,
        recoveryRate: 3,
        collectedInPeriod: 6,
        overdueCount: 0,
        dueThisWeek: 0,
        plannedActions: 2
      });
      expect(res.body.stats.collectedByAgent).toEqual([collector(agentA.user, 6, 2)]);
      // A payment and an action share each timestamp, so only the dates are compared, not their order
      expect(res.body.stats.recentActivities.map(row => row.date).sort())
        .toEqual([iso(start), iso(start), iso(end), iso(end)]);
    });
  });

  describe('agent and client filters', () => {
    it('limits every figure to the agent portfolio when a manager filters by agent', async () => {
      const { at } = d;
      const { manager, agentA, agentB } = d.users;
      const { alpha, beta, delta } = d.clients;
      const { inv2, inv3, inv7 } = d.invoices;

      const res = await fetchStats(manager.token, { agent: id(agentA.user) });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        filters: { from: null, to: null, agent: id(agentA.user), client: null },
        stats: {
          overview: {
            totalClients: 3,
            totalInvoices: 6,
            totalAmount: 6650,
            totalPaid: 2650,
            unpaidAmount: 4000,
            recoveryRate: 39.8,
            collectedInPeriod: 2650,
            overdueCount: 1,
            dueThisWeek: 1,
            plannedActions: 2
          },
          invoicesByStatus: {
            cancelled: { count: 1, totalAmount: 900, totalPaid: 0 },
            paid: { count: 2, totalAmount: 2150, totalPaid: 2150 },
            partially_paid: { count: 1, totalAmount: 2000, totalPaid: 500 },
            unpaid: { count: 3, totalAmount: 2500, totalPaid: 0 }
          },
          monthlyStats: [
            { month: monthKey(at(11, 15)), count: 1, totalAmount: 700, totalPaid: 0 },
            { month: monthKey(at(3, 15)), count: 1, totalAmount: 1500, totalPaid: 1500 },
            { month: monthKey(at(2, 15)), count: 2, totalAmount: 2650, totalPaid: 1150 },
            { month: monthKey(at(1, 15)), count: 1, totalAmount: 1000, totalPaid: 0 },
            { month: monthKey(at(0, 15)), count: 1, totalAmount: 800, totalPaid: 0 }
          ],
          topClients: [topClient(alpha, 2500, 2), topClient(beta, 800, 1), topClient(delta, 700, 1)],
          collectionStats: { completed: 1, planned: 2 },
          // Grouped by who received the money, so agent B and the manager appear in agent A's portfolio
          collectedByAgent: [
            collector(agentA.user, 1400, 2),
            collector(agentB.user, 650, 1),
            collector(manager.user, 600, 1)
          ],
          recentActivities: [
            actionActivity(at(1, 21), 'phone_call', 'Alpha Trading', 'INV-002', 'completed'),
            paymentActivity(inv2, at(1, 20), 500, 'Alpha Trading', 'bank_transfer'),
            actionActivity(at(1, 15), 'visit', 'Alpha Trading', 'INV-001', 'planned'),
            paymentActivity(inv7, at(2, 22), 650, 'Delta Build', 'bank_transfer'),
            paymentActivity(inv3, at(2, 18), 600, 'Beta Foods', 'check'),
            actionActivity(at(2, 5), 'meeting', 'Delta Build', 'INV-009', 'planned'),
            paymentActivity(inv3, at(3, 20), 900, 'Beta Foods', 'cash')
          ],
          userStats: USER_STATS
        }
      });
    });

    it('always restricts an agent to their own portfolio, even when passing another agent id', async () => {
      const { manager, agentA, agentB } = d.users;

      const managerView = await fetchStats(manager.token, { agent: id(agentA.user) });
      const ownView = await fetchStats(agentA.token);
      const askingForB = await fetchStats(agentA.token, { agent: id(agentB.user) });

      expect(ownView.status).toBe(200);
      expect(askingForB.status).toBe(200);
      expect(ownView.body).toEqual(managerView.body);
      expect(askingForB.body).toEqual(managerView.body);
    });

    it('gives agent B their own figures when they ask for agent A', async () => {
      const { agentA, agentB } = d.users;
      const { gamma, delta, zeta } = d.clients;

      const res = await fetchStats(agentB.token, { agent: id(agentA.user) });

      expect(res.status).toBe(200);
      expect(res.body.filters).toEqual({ from: null, to: null, agent: id(agentB.user), client: null });
      expect(res.body.stats.overview).toEqual({
        totalClients: 3,
        totalInvoices: 5,
        totalAmount: 8050,
        totalPaid: 1850,
        unpaidAmount: 6200,
        recoveryRate: 23,
        collectedInPeriod: 1850,
        overdueCount: 1,
        dueThisWeek: 1,
        plannedActions: 2
      });
      expect(res.body.stats.topClients).toEqual([
        topClient(gamma, 4000, 2),
        topClient(zeta, 1500, 1),
        topClient(delta, 700, 1)
      ]);
      expect(res.body.stats.collectionStats).toEqual({ completed: 1, failed: 1, planned: 2 });
      expect(res.body.stats.collectedByAgent).toEqual([collector(agentB.user, 1850, 3)]);
    });

    it('lets an admin see any agent portfolio exactly as that agent sees it', async () => {
      const { admin, agentB } = d.users;

      const adminView = await fetchStats(admin.token, { agent: id(agentB.user) });
      const agentView = await fetchStats(agentB.token);

      expect(adminView.status).toBe(200);
      expect(adminView.body).toEqual(agentView.body);
    });

    it('limits every figure to one client with the client filter', async () => {
      const { at } = d;
      const { manager, agentB } = d.users;
      const { gamma } = d.clients;
      const { inv6 } = d.invoices;

      const res = await fetchStats(manager.token, { client: id(gamma) });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        filters: { from: null, to: null, agent: null, client: id(gamma) },
        stats: {
          overview: {
            totalClients: 1,
            totalInvoices: 2,
            totalAmount: 4200,
            totalPaid: 200,
            unpaidAmount: 4000,
            recoveryRate: 4.8,
            collectedInPeriod: 200,
            overdueCount: 1,
            dueThisWeek: 1,
            plannedActions: 1
          },
          invoicesByStatus: {
            overdue: { count: 1, totalAmount: 3000, totalPaid: 0 },
            partially_paid: { count: 1, totalAmount: 1200, totalPaid: 200 }
          },
          monthlyStats: [
            { month: monthKey(at(5, 15)), count: 1, totalAmount: 3000, totalPaid: 0 },
            { month: monthKey(at(1, 15)), count: 1, totalAmount: 1200, totalPaid: 200 }
          ],
          topClients: [topClient(gamma, 4000, 2)],
          collectionStats: { failed: 1, planned: 1 },
          collectedByAgent: [collector(agentB.user, 200, 1)],
          recentActivities: [
            actionActivity(at(1, 26), 'reminder_letter', 'Gamma Tech', 'INV-005', 'planned'),
            paymentActivity(inv6, at(1, 25), 200, 'Gamma Tech', 'credit_card'),
            actionActivity(at(1, 8), 'email', 'Gamma Tech', 'INV-005', 'failed')
          ],
          userStats: USER_STATS
        }
      });
    });

    it('combines agent and client when the client is in the agent portfolio', async () => {
      const { manager, agentA, agentB } = d.users;
      const { delta } = d.clients;

      const res = await fetchStats(manager.token, { agent: id(agentA.user), client: id(delta) });

      expect(res.status).toBe(200);
      expect(res.body.filters).toEqual({ from: null, to: null, agent: id(agentA.user), client: id(delta) });
      expect(res.body.stats.overview).toEqual({
        totalClients: 1,
        totalInvoices: 2,
        totalAmount: 1350,
        totalPaid: 650,
        unpaidAmount: 700,
        recoveryRate: 48.1,
        collectedInPeriod: 650,
        // INV-008 is past due but cancelled
        overdueCount: 0,
        dueThisWeek: 0,
        plannedActions: 1
      });
      expect(res.body.stats.invoicesByStatus).toEqual({
        cancelled: { count: 1, totalAmount: 900, totalPaid: 0 },
        paid: { count: 1, totalAmount: 650, totalPaid: 650 },
        unpaid: { count: 1, totalAmount: 700, totalPaid: 0 }
      });
      expect(res.body.stats.topClients).toEqual([topClient(delta, 700, 1)]);
      expect(res.body.stats.collectedByAgent).toEqual([collector(agentB.user, 650, 1)]);
    });

    it('returns empty statistics when the client is outside the agent portfolio', async () => {
      const { manager, agentA } = d.users;
      const { gamma } = d.clients;

      const res = await fetchStats(manager.token, { agent: id(agentA.user), client: id(gamma) });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        filters: { from: null, to: null, agent: id(agentA.user), client: id(gamma) },
        stats: emptyStats(USER_STATS)
      });
    });

    it('lets an agent filter by client only inside their own portfolio', async () => {
      const { manager, agentA } = d.users;
      const { beta, gamma } = d.clients;

      const outside = await fetchStats(agentA.token, { client: id(gamma) });
      const inside = await fetchStats(agentA.token, { client: id(beta) });

      expect(outside.status).toBe(200);
      expect(outside.body).toEqual({
        success: true,
        filters: { from: null, to: null, agent: id(agentA.user), client: id(gamma) },
        stats: emptyStats(USER_STATS)
      });

      expect(inside.status).toBe(200);
      expect(inside.body.filters).toEqual({ from: null, to: null, agent: id(agentA.user), client: id(beta) });
      expect(inside.body.stats.overview).toEqual({
        totalClients: 1,
        totalInvoices: 2,
        totalAmount: 2300,
        totalPaid: 1500,
        unpaidAmount: 800,
        recoveryRate: 65.2,
        collectedInPeriod: 1500,
        overdueCount: 0,
        dueThisWeek: 1,
        plannedActions: 0
      });
      expect(inside.body.stats.collectionStats).toEqual({});
      expect(inside.body.stats.collectedByAgent).toEqual([collector(agentA.user, 900, 1), collector(manager.user, 600, 1)]);
    });
  });

  describe('recent activities', () => {
    it('merges only the 5 latest payments with the 5 latest actions, newest first', async () => {
      const { at } = d;
      const { manager, agentA } = d.users;
      // A client of its own, in a month with no seeded data: 7 payments, then 2 later actions
      const eta = await createClient(manager.user, { name: 'Eta Logistics', company: 'Eta SA', email: 'contact@eta.tn' });
      const days = [1, 2, 3, 4, 5, 6, 7];
      const inv = await createInvoice(eta, manager.user, {
        invoiceNumber: 'ETA-001',
        amount: 10000,
        paidAmount: 2800,
        issueDate: at(6, 1),
        dueDate: d.inDays(60),
        payments: days.map(day => payment(day * 100, at(6, day), agentA.user, 'bank_transfer'))
      });
      await Promise.all([
        createCollectionAction(inv, agentA.user, { actionType: 'email', actionDate: at(6, 20) }),
        createCollectionAction(inv, agentA.user, { actionType: 'visit', actionDate: at(6, 22) })
      ]);

      const res = await fetchStats(manager.token, { client: id(eta) });

      expect(res.status).toBe(200);
      expect(res.body.stats.recentActivities).toEqual([
        actionActivity(at(6, 22), 'visit', 'Eta Logistics', 'ETA-001', 'planned'),
        actionActivity(at(6, 20), 'email', 'Eta Logistics', 'ETA-001', 'planned'),
        paymentActivity(inv, at(6, 7), 700, 'Eta Logistics', 'bank_transfer'),
        paymentActivity(inv, at(6, 6), 600, 'Eta Logistics', 'bank_transfer'),
        paymentActivity(inv, at(6, 5), 500, 'Eta Logistics', 'bank_transfer'),
        paymentActivity(inv, at(6, 4), 400, 'Eta Logistics', 'bank_transfer'),
        paymentActivity(inv, at(6, 3), 300, 'Eta Logistics', 'bank_transfer')
      ]);
      // Every payment still counts in the totals
      expect(res.body.stats.overview.collectedInPeriod).toBe(2800);
    });
  });
});

describe('GET /api/stats/summary', () => {
  let d;

  beforeEach(async () => {
    d = await seedDataset();
  }, SEED_TIMEOUT);

  it('returns the global summary', async () => {
    const res = await fetchSummary(d.users.manager.token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      summary: { totalUnpaid: 9900, todayPayments: 1000, pendingActions: 3, activeAgents: 2 }
    });
  });

  it('is not restricted to the agent portfolio', async () => {
    const res = await fetchSummary(d.users.agentA.token);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ totalUnpaid: 9900, todayPayments: 1000, pendingActions: 3, activeAgents: 2 });
  });

  it('ignores the dashboard filters', async () => {
    const res = await fetchSummary(d.users.manager.token, { client: id(d.clients.gamma), from: '2000-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ totalUnpaid: 9900, todayPayments: 1000, pendingActions: 3, activeAgents: 2 });
  });

  it('counts only the payments received since local midnight today', async () => {
    const { manager, agentA } = d.users;
    const startOfToday = new Date(new Date(d.ref).setHours(0, 0, 0, 0));
    await createInvoice(d.clients.epsilon, manager.user, {
      invoiceNumber: 'EDGE-TODAY',
      amount: 50,
      paidAmount: 10,
      dueDate: d.inDays(60),
      payments: [payment(7, shift(startOfToday, -1), agentA.user, 'cash'), payment(3, startOfToday, agentA.user, 'cash')]
    });

    const res = await fetchSummary(manager.token);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ totalUnpaid: 9940, todayPayments: 1003, pendingActions: 3, activeAgents: 2 });
  });
});

describe('Stats on an empty database', () => {
  it('returns zeros and empty lists on the dashboard', async () => {
    const { token } = await createUserWithToken('manager');

    const res = await fetchStats(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      filters: NO_FILTERS,
      stats: emptyStats({ manager: { total: 1, active: 1 } })
    });
  });

  it('returns zeros in the summary', async () => {
    const { token } = await createUserWithToken('manager');

    const res = await fetchSummary(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      summary: { totalUnpaid: 0, todayPayments: 0, pendingActions: 0, activeAgents: 0 }
    });
  });
});

describe('Stats validation and authentication', () => {
  it.each([
    ['a malformed agent id', { agent: '12345' }, 'Invalid identifier'],
    ['a client id that is not hexadecimal', { client: 'z'.repeat(24) }, 'Invalid identifier'],
    ['an end date before the start date', { from: '2026-03-10', to: '2026-03-01' }, 'End date must be after start date'],
    ['a date that cannot be parsed', { from: 'yesterday' }, '"from" must be a valid date'],
    ['an unknown filter', { status: 'paid' }, '"status" is not allowed']
  ])('rejects %s with 400', async (_label, query, message) => {
    const { token } = await createUserWithToken('manager');

    const res = await fetchStats(token, query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
  });

  it('validates the agent id even for an agent, whose own id replaces it anyway', async () => {
    const { token } = await createUserWithToken('agent');

    const res = await fetchStats(token, { agent: 'not-an-id' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid identifier' });
  });

  it.each(['/api/stats', '/api/stats/summary'])('rejects %s without a token with 401', async (url) => {
    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Not authorized, no token' });
  });

  it.each(['/api/stats', '/api/stats/summary'])('rejects %s with an invalid token with 401', async (url) => {
    const res = await request(app).get(url).set(authHeader('not.a.jwt'));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Invalid token' });
  });
});
