import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { User } from '../models/User.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { sendJson } from '../utils/send.js';


export async function getStats(req, res, next) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    
    const [
      totalClients,
      totalInvoices,
      invoicesByStatus,
      unpaidSummary,
      monthlyStats,
      topClients,
      collectionStats,
      recentActivities,
      userStats
    ] = await Promise.all([
     
      Client.countDocuments(),
      
      
      Invoice.countDocuments(),
      
      
      Invoice.aggregate([
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }},
        { $sort: { _id: 1 } }
      ]),
      
      
      Invoice.aggregate([
        { $match: { status: { $in: ['unpaid', 'partially_paid', 'overdue'] } } },
        { $group: {
          _id: null,
          totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } },
          count: { $sum: 1 },
          averageAmount: { $avg: { $subtract: ['$amount', '$paidAmount'] } },
          maxAmount: { $max: { $subtract: ['$amount', '$paidAmount'] } }
        }}
      ]),
      
      
      Invoice.aggregate([
        { $match: { createdAt: { $gte: startOfYear } } },
        { $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }},
        { $sort: { '_id': 1 } }
      ]),
      
      
      Invoice.aggregate([
        { $match: { status: { $in: ['unpaid', 'partially_paid', 'overdue'] } } },
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
          'client.name': 1,
          'client.company': 1,
          'client.email': 1,
          totalUnpaid: 1,
          invoiceCount: 1
        }}
      ]),
      
     
      CollectionAction.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      
      Promise.all([
        
        Invoice.aggregate([
          { $unwind: '$payments' },
          { $match: { 'payments.paymentDate': { $gte: startOfMonth } } },
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
        
        
        CollectionAction.find({ createdAt: { $gte: startOfMonth } })
          .populate('client', 'name')
          .populate('invoice', 'invoiceNumber')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
          .then(actions => actions.map(a => ({
            type: 'collection',
            date: a.createdAt,
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
    
    
    const overdueCount = await Invoice.countDocuments({
      status: 'overdue'
    });
    
    
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);
    
    const dueThisWeek = await Invoice.countDocuments({
      dueDate: { $gte: now, $lte: endOfWeek },
      status: { $in: ['unpaid', 'partially_paid'] }
    });
    
    sendJson(res, 200, {
      success: true,
      stats: {
        overview: {
          totalClients,
          totalInvoices,
          overdueCount,
          dueThisWeek,
          unpaidAmount: unpaidSummary[0]?.totalUnpaid || 0,
          unpaidCount: unpaidSummary[0]?.count || 0
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