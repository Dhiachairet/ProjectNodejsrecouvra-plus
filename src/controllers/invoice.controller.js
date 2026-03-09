import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { validateInvoice, validatePayment, validateInvoiceUpdate } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';


export async function getInvoices(req, res, next) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      client, 
      fromDate, 
      toDate,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;
    
    
    let filter = {};
    
    if (status) filter.status = status;
    if (client) filter.client = client;
    
  
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }
    
  
    if (req.user.role === 'agent') {
      const clients = await Client.find({ createdBy: req.user.id }).select('_id');
      filter.client = { $in: clients.map(c => c._id) };
    }
    
   
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
   
    const invoices = await Invoice.find(filter)
      .populate('client', 'name email company phone')
      .populate('createdBy', 'firstName lastName')
      .populate('payments.receivedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    
    const total = await Invoice.countDocuments(filter);
    
    
    const summary = await Invoice.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$paidAmount' },
        totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } },
        count: { $sum: 1 }
      }}
    ]);
    
    sendJson(res, 200, {
      success: true,
      count: invoices.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary: summary[0] || { totalAmount: 0, totalPaid: 0, totalUnpaid: 0, count: 0 },
      invoices
    });
  } catch (error) {
    next(error);
  }
}


export async function getInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'name email company phone address')
      .populate('createdBy', 'firstName lastName email')
      .populate('payments.receivedBy', 'firstName lastName')
      .populate('cancelledBy', 'firstName lastName');
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    
    if (req.user.role === 'agent') {
      const client = await Client.findById(invoice.client);
      if (client.createdBy.toString() !== req.user.id) {
        return sendError(res, 403, 'You can only view invoices from your clients');
      }
    }
    
    
    const collectionActions = await CollectionAction.find({ invoice: invoice._id })
      .populate('performedBy', 'firstName lastName')
      .sort({ actionDate: -1 });
    
    sendJson(res, 200, {
      success: true,
      invoice,
      collectionActions,
      stats: {
        remainingAmount: invoice.remainingAmount,
        paymentPercentage: invoice.paymentPercentage,
        isOverdue: invoice.isOverdue
      }
    });
  } catch (error) {
    next(error);
  }
}


export async function createInvoice(req, res, next) {
  try {
  
    const { error } = validateInvoice.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const client = await Client.findById(req.body.client);
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
   
    if (req.user.role === 'agent' && client.createdBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only create invoices for your own clients');
    }
    
    
    const existingInvoice = await Invoice.findOne({ invoiceNumber: req.body.invoiceNumber });
    if (existingInvoice) {
      return sendError(res, 400, 'Invoice number already exists');
    }
    
    
    let totalAmount = req.body.amount;
    if (req.body.items && req.body.items.length > 0) {
      totalAmount = req.body.items.reduce((sum, item) => sum + item.amount, 0);
      
      req.body.amount = totalAmount;
    }
    
    
    const invoice = await Invoice.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    sendJson(res, 201, {
      success: true,
      invoice
    });
  } catch (error) {
    next(error);
  }
}


export async function updateInvoice(req, res, next) {
  try {
    const { error } = validateInvoiceUpdate.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    let invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot modify a paid invoice');
    }
    
    if (invoice.status === 'cancelled') {
      return sendError(res, 400, 'Cannot modify a cancelled invoice');
    }
    
    
    if (req.body.status === 'cancelled') {
      req.body.cancelledAt = new Date();
      req.body.cancelledBy = req.user.id;
    }
    
    
    invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('client', 'name email');
    
    sendJson(res, 200, {
      success: true,
      invoice
    });
  } catch (error) {
    next(error);
  }
}


export async function deleteInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot delete paid invoice');
    }
    
    
    const actionCount = await CollectionAction.countDocuments({ invoice: invoice._id });
    if (actionCount > 0) {
      return sendError(res, 400, 'Cannot delete invoice with collection actions');
    }
    
    await invoice.deleteOne();
    
    sendJson(res, 200, {
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}


export async function addPayment(req, res, next) {
  try {
    
    const { error } = validatePayment.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
  
    
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Invoice is already paid');
    }
    
    if (invoice.status === 'cancelled') {
      return sendError(res, 400, 'Cannot add payment to cancelled invoice');
    }
    
    
    const remainingAmount = invoice.remainingAmount;
    if (req.body.amount > remainingAmount) {
      return sendError(res, 400, `Payment amount (${req.body.amount}) exceeds remaining balance of ${remainingAmount}`);
    }
    
    
    invoice.payments.push({
      ...req.body,
      receivedBy: req.user.id,
      paymentDate: req.body.paymentDate || new Date()
    });
    
    invoice.paidAmount += req.body.amount;
    
    
    await invoice.save();
    
    
    await invoice.populate([
      { path: 'payments.receivedBy', select: 'firstName lastName' },
      { path: 'client', select: 'name email' }
    ]);
    
    sendJson(res, 201, {
      success: true,
      message: 'Payment added successfully',
      invoice,
      payment: invoice.payments[invoice.payments.length - 1]
    });
  } catch (error) {
    next(error);
  }
}


export async function getInvoicePayments(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .select('payments invoiceNumber client amount paidAmount')
      .populate('payments.receivedBy', 'firstName lastName');
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    sendJson(res, 200, {
      success: true,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.amount,
      paidAmount: invoice.paidAmount,
      remainingAmount: invoice.remainingAmount,
      payments: invoice.payments
    });
  } catch (error) {
    next(error);
  }
}