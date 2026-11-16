import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { User } from '../models/User.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { sendJson, sendError } from '../utils/send.js';
import { validateStatsQuery } from '../utils/validation.js';
import { clientIdsForAgent, toObjectId } from '../utils/access.js';

const OPEN_STATUSES = ['unpaid', 'partially_paid', 'overdue'];
const DAY = 24 * 60 * 60 * 1000;

const endOfDay = (date) => new Date(new Date(date).setHours(23, 59, 59, 999));


// Translates the dashboard filters (from, to, agent, client) into $match stages.
// Agents are always restricted to their own portfolio, whatever they ask for.
async function buildScope(user, query) {
  const agent = user.role === 'agent' ? user._id.toString() : query.agent;

  let clientIds = null;
  if (agent) {
    clientIds = await clientIdsForAgent(agent);
  }
  if (query.client) {
    const requested = toObjectId(query.client);
    clientIds = !clientIds || clientIds.some(id => id.equals(requested)) ? [requested] : [];
  }

  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = endOfDay(query.to);
  const hasRange = Object.keys(range).length > 0;

  const byClient = clientIds ? { client: { $in: clientIds } } : {};

  return {
    filters: { from: query.from ?? null, to: query.to ?? null, agent: agent ?? null, client: query.client ?? null },
    hasRange,
    byClient,
    clientMatch: clientIds ? { _id: { $in: clientIds } } : {},
    invoiceMatch: { ...byClient, ...(hasRange && { issueDate: range }) },
    actionMatch: { ...byClient, ...(hasRange && { actionDate: range }) },
    paymentMatch: hasRange ? { 'payments.paymentDate': range } : {}
  };
}


export async function getStats(req, res, next) {
  try {
    const { error, value } = validateStatsQuery.validate(req.query);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const scope = await buildScope(req.user, value);
    const { byClient, clientMatch, invoiceMatch, actionMatch, paymentMatch } = scope;

    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * DAY);
    const lastTwelveMonths = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyMatch = scope.hasRange ? invoiceMatch : { ...byClient, issueDate: { $gte: lastTwelveMonths } };

    const [
      totalClients,
      totals,
      invoicesByStatus,
      monthlyStats,
      topClients,
      collectionStats,
      collectedByAgent,
      overdueCount,
      dueThisWeek,
      plannedActions,
      recentActivities,
      userStats
    ] = await Promise.all([
      Client.countDocuments(clientMatch),

      Invoice.aggregate([
        { $match: { ...invoiceMatch, status: { $ne: 'cancelled' } } },
        { $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }}
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }},
        { $sort: { _id: 1 } }
      ]),

      Invoice.aggregate([
        { $match: { ...monthlyMatch, status: { $ne: 'cancelled' } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$issueDate' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }},
        { $sort: { _id: 1 } }
      ]),

      Invoice.aggregate([
        { $match: { ...invoiceMatch, status: { $in: OPEN_STATUSES } } },
        { $group: {
          _id: '$client',
          totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } },
          invoiceCount: { $sum: 1 }
        }},
        { $sort: { totalUnpaid: -1 } },
        { $limit: 5 },
        { $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }},
        { $unwind: '$client' },
        { $project: {
          'client._id': 1,
          'client.name': 1,
          'client.company': 1,
          'client.email': 1,
          totalUnpaid: 1,
          invoiceCount: 1
        }}
      ]),

      CollectionAction.aggregate([
        { $match: actionMatch },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),

      Invoice.aggregate([
        { $match: byClient },
        { $unwind: '$payments' },
        { $match: paymentMatch },
        { $group: {
          _id: '$payments.receivedBy',
          collected: { $sum: '$payments.amount' },
          payments: { $sum: 1 }
        }},
        { $sort: { collected: -1 } },
        { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }},
        { $unwind: '$user' },
        { $project: {
          collected: 1,
          payments: 1,
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          role: '$user.role'
        }}
      ]),

      Invoice.countDocuments({ ...invoiceMatch, status: { $in: OPEN_STATUSES }, dueDate: { $lt: now } }),

      Invoice.countDocuments({
        ...invoiceMatch,
        status: { $in: ['unpaid', 'partially_paid'] },
        dueDate: { $gte: now, $lte: inSevenDays }
      }),

      CollectionAction.countDocuments({ ...actionMatch, status: 'planned' }),

      Promise.all([
        Invoice.aggregate([
          { $match: byClient },
          { $unwind: '$payments' },
          { $match: paymentMatch },
          { $sort: { 'payments.paymentDate': -1 } },
          { $limit: 5 },
          { $lookup: {
            from: 'clients',
            localField: 'client',
            foreignField: '_id',
            as: 'client'
          }},
          { $unwind: '$client' },
          { $project: {
            type: { $literal: 'payment' },
            date: '$payments.paymentDate',
            amount: '$payments.amount',
            clientName: '$client.name',
            invoiceNumber: '$invoiceNumber',
            method: '$payments.paymentMethod'
          }}
        ]),

        CollectionAction.find(actionMatch)
          .populate('client', 'name')
          .populate('invoice', 'invoiceNumber')
          .sort({ actionDate: -1 })
          .limit(5)
          .lean()
          .then(actions => actions.map(a => ({
            type: 'collection',
            date: a.actionDate,
            actionType: a.actionType,
            clientName: a.client?.name,
            invoiceNumber: a.invoice?.invoiceNumber,
            status: a.status
          })))
      ]).then(([payments, actions]) =>
        [...payments, ...actions]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10)
      ),

      User.aggregate([
        { $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$active', 1, 0] } }
        }}
      ])
    ]);

    const totalAmount = totals[0]?.totalAmount || 0;
    const totalPaid = totals[0]?.totalPaid || 0;

    sendJson(res, 200, {
      success: true,
      filters: scope.filters,
      stats: {
        overview: {
          totalClients,
          totalInvoices: totals[0]?.count || 0,
          totalAmount,
          totalPaid,
          unpaidAmount: totalAmount - totalPaid,
          recoveryRate: totalAmount ? Math.round((totalPaid / totalAmount) * 1000) / 10 : 0,
          collectedInPeriod: collectedByAgent.reduce((sum, row) => sum + row.collected, 0),
          overdueCount,
          dueThisWeek,
          plannedActions
        },
        invoicesByStatus: invoicesByStatus.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount,
            totalPaid: item.totalPaid
          };
          return acc;
        }, {}),
        monthlyStats: monthlyStats.map(m => ({
          month: m._id,
          count: m.count,
          totalAmount: m.totalAmount,
          totalPaid: m.totalPaid
        })),
        topClients,
        collectionStats: collectionStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        collectedByAgent,
        recentActivities,
        userStats: userStats.reduce((acc, item) => {
          acc[item._id] = {
            total: item.count,
            active: item.active
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
}


export async function getSummaryStats(req, res, next) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalUnpaid,
      todayPayments,
      pendingActions,
      activeAgents
    ] = await Promise.all([

      Invoice.aggregate([
        { $match: { status: { $in: ['unpaid', 'partially_paid', 'overdue'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
      ]).then(r => r[0]?.total || 0),

      Invoice.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.paymentDate': { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } }
      ]).then(r => r[0]?.total || 0),


      CollectionAction.countDocuments({ status: 'planned' }),


      User.countDocuments({ role: 'agent', active: true })
    ]);

    sendJson(res, 200, {
      success: true,
      summary: {
        totalUnpaid,
        todayPayments,
        pendingActions,
        activeAgents
      }
    });
  } catch (error) {
    next(error);
  }
}
