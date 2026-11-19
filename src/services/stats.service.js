import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { User } from '../models/User.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { clientIdsForAgent, toObjectId } from '../utils/access.js';

// Dashboard statistics: one small query per figure, combined by computeStats().
// The controller only validates the request and sends the result.

const OPEN_STATUSES = ['unpaid', 'partially_paid', 'overdue'];
const DAY = 24 * 60 * 60 * 1000;

const endOfDay = (date) => new Date(new Date(date).setHours(23, 59, 59, 999));


// ---- Scope: which clients and which period the figures cover ----

// Agents are always restricted to their own portfolio, whatever they ask for.
async function resolveClients(user, query) {
  const agent = user.role === 'agent' ? user._id.toString() : query.agent;
  let clientIds = agent ? await clientIdsForAgent(agent) : null;

  if (query.client) {
    const requested = toObjectId(query.client);
    clientIds = !clientIds || clientIds.some(id => id.equals(requested)) ? [requested] : [];
  }
  return { agent, clientIds };
}

// Inclusive range from the start of `from` to the end of `to`, or null without dates.
function dateRange(query) {
  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = endOfDay(query.to);
  return Object.keys(range).length > 0 ? range : null;
}

function echoFilters(query, agent) {
  return { from: query.from ?? null, to: query.to ?? null, agent: agent ?? null, client: query.client ?? null };
}

// Translates the dashboard filters (from, to, agent, client) into $match stages.
export async function buildScope(user, query) {
  const { agent, clientIds } = await resolveClients(user, query);
  const range = dateRange(query);
  const byClient = clientIds ? { client: { $in: clientIds } } : {};

  return {
    filters: echoFilters(query, agent),
    hasRange: range !== null,
    byClient,
    clientMatch: clientIds ? { _id: { $in: clientIds } } : {},
    invoiceMatch: { ...byClient, ...(range && { issueDate: range }) },
    actionMatch: { ...byClient, ...(range && { actionDate: range }) },
    paymentMatch: range ? { 'payments.paymentDate': range } : {}
  };
}


// ---- One query per dashboard figure ----

function countClients({ clientMatch }) {
  return Client.countDocuments(clientMatch);
}

async function sumInvoices({ invoiceMatch }) {
  const [totals] = await Invoice.aggregate([
    { $match: { ...invoiceMatch, status: { $ne: 'cancelled' } } },
    { $group: {
      _id: null,
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalPaid: { $sum: '$paidAmount' }
    }}
  ]);
  return { count: totals?.count || 0, totalAmount: totals?.totalAmount || 0, totalPaid: totals?.totalPaid || 0 };
}

async function groupInvoicesByStatus({ invoiceMatch }) {
  const rows = await Invoice.aggregate([
    { $match: invoiceMatch },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalPaid: { $sum: '$paidAmount' }
    }},
    { $sort: { _id: 1 } }
  ]);
  return Object.fromEntries(rows.map(row => [row._id, { count: row.count, totalAmount: row.totalAmount, totalPaid: row.totalPaid }]));
}

// Without a date filter, the last 12 months (current month included)
async function groupInvoicesByMonth({ hasRange, invoiceMatch, byClient }, now) {
  const lastTwelveMonths = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const match = hasRange ? invoiceMatch : { ...byClient, issueDate: { $gte: lastTwelveMonths } };

  const rows = await Invoice.aggregate([
    { $match: { ...match, status: { $ne: 'cancelled' } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$issueDate' } },
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalPaid: { $sum: '$paidAmount' }
    }},
    { $sort: { _id: 1 } }
  ]);
  return rows.map(row => ({ month: row._id, count: row.count, totalAmount: row.totalAmount, totalPaid: row.totalPaid }));
}

function findTopDebtors({ invoiceMatch }) {
  return Invoice.aggregate([
    { $match: { ...invoiceMatch, status: { $in: OPEN_STATUSES } } },
    { $group: {
      _id: '$client',
      totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } },
      invoiceCount: { $sum: 1 }
    }},
    { $sort: { totalUnpaid: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
    { $unwind: '$client' },
    { $project: {
      'client._id': 1,
      'client.name': 1,
      'client.company': 1,
      'client.email': 1,
      totalUnpaid: 1,
      invoiceCount: 1
    }}
  ]);
}

async function groupActionsByStatus({ actionMatch }) {
  const rows = await CollectionAction.aggregate([
    { $match: actionMatch },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  return Object.fromEntries(rows.map(row => [row._id, row.count]));
}

function sumCollectedByAgent({ byClient, paymentMatch }) {
  return Invoice.aggregate([
    { $match: byClient },
    { $unwind: '$payments' },
    { $match: paymentMatch },
    { $group: {
      _id: '$payments.receivedBy',
      collected: { $sum: '$payments.amount' },
      payments: { $sum: 1 }
    }},
    { $sort: { collected: -1 } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: {
      collected: 1,
      payments: 1,
      firstName: '$user.firstName',
      lastName: '$user.lastName',
      role: '$user.role'
    }}
  ]);
}

function countOverdueInvoices({ invoiceMatch }, now) {
  return Invoice.countDocuments({ ...invoiceMatch, status: { $in: OPEN_STATUSES }, dueDate: { $lt: now } });
}

function countInvoicesDueThisWeek({ invoiceMatch }, now) {
  const inSevenDays = new Date(now.getTime() + 7 * DAY);
  return Invoice.countDocuments({
    ...invoiceMatch,
    status: { $in: ['unpaid', 'partially_paid'] },
    dueDate: { $gte: now, $lte: inSevenDays }
  });
}

function countPlannedActions({ actionMatch }) {
  return CollectionAction.countDocuments({ ...actionMatch, status: 'planned' });
}

function findRecentPayments({ byClient, paymentMatch }) {
  return Invoice.aggregate([
    { $match: byClient },
    { $unwind: '$payments' },
    { $match: paymentMatch },
    { $sort: { 'payments.paymentDate': -1 } },
    { $limit: 5 },
    { $lookup: { from: 'clients', localField: 'client', foreignField: '_id', as: 'client' } },
    { $unwind: '$client' },
    { $project: {
      type: { $literal: 'payment' },
      date: '$payments.paymentDate',
      amount: '$payments.amount',
      clientName: '$client.name',
      invoiceNumber: '$invoiceNumber',
      method: '$payments.paymentMethod'
    }}
  ]);
}

async function findRecentActions({ actionMatch }) {
  const actions = await CollectionAction.find(actionMatch)
    .populate('client', 'name')
    .populate('invoice', 'invoiceNumber')
    .sort({ actionDate: -1 })
    .limit(5)
    .lean();
  return actions.map(action => ({
    type: 'collection',
    date: action.actionDate,
    actionType: action.actionType,
    clientName: action.client?.name,
    invoiceNumber: action.invoice?.invoiceNumber,
    status: action.status
  }));
}

// The 10 latest payments and collection actions, newest first
async function findRecentActivities(scope) {
  const [payments, actions] = await Promise.all([findRecentPayments(scope), findRecentActions(scope)]);
  return [...payments, ...actions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
}

async function groupUsersByRole() {
  const rows = await User.aggregate([
    { $group: {
      _id: '$role',
      count: { $sum: 1 },
      active: { $sum: { $cond: ['$active', 1, 0] } }
    }}
  ]);
  return Object.fromEntries(rows.map(row => [row._id, { total: row.count, active: row.active }]));
}


// ---- Assembly ----

function buildOverview({ totalClients, totals, collectedByAgent, overdueCount, dueThisWeek, plannedActions }) {
  const { count, totalAmount, totalPaid } = totals;
  return {
    totalClients,
    totalInvoices: count,
    totalAmount,
    totalPaid,
    unpaidAmount: totalAmount - totalPaid,
    recoveryRate: totalAmount ? Math.round((totalPaid / totalAmount) * 1000) / 10 : 0,
    collectedInPeriod: collectedByAgent.reduce((sum, row) => sum + row.collected, 0),
    overdueCount,
    dueThisWeek,
    plannedActions
  };
}

export async function computeStats(scope, now) {
  const [
    totalClients, totals, invoicesByStatus, monthlyStats, topClients, collectionStats,
    collectedByAgent, overdueCount, dueThisWeek, plannedActions, recentActivities, userStats
  ] = await Promise.all([
    countClients(scope),
    sumInvoices(scope),
    groupInvoicesByStatus(scope),
    groupInvoicesByMonth(scope, now),
    findTopDebtors(scope),
    groupActionsByStatus(scope),
    sumCollectedByAgent(scope),
    countOverdueInvoices(scope, now),
    countInvoicesDueThisWeek(scope, now),
    countPlannedActions(scope),
    findRecentActivities(scope),
    groupUsersByRole()
  ]);

  return {
    overview: buildOverview({ totalClients, totals, collectedByAgent, overdueCount, dueThisWeek, plannedActions }),
    invoicesByStatus,
    monthlyStats,
    topClients,
    collectionStats,
    collectedByAgent,
    recentActivities,
    userStats
  };
}

// Quick figures for widgets: global, not filtered by portfolio
export async function computeSummary(now) {
  const startOfDay = new Date(new Date(now).setHours(0, 0, 0, 0));

  const [totalUnpaid, todayPayments, pendingActions, activeAgents] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: { $in: OPEN_STATUSES } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
    ]).then(rows => rows[0]?.total || 0),

    Invoice.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.paymentDate': { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]).then(rows => rows[0]?.total || 0),

    CollectionAction.countDocuments({ status: 'planned' }),

    User.countDocuments({ role: 'agent', active: true })
  ]);

  return { totalUnpaid, todayPayments, pendingActions, activeAgents };
}
