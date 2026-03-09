import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { validateInvoice, validatePayment, validateInvoiceUpdate } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
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
    
    // Build filter
    let filter = {};
    
    if (status) filter.status = status;
    if (client) filter.client = client;
    
    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }
    
    // Restrict agents to their own clients' invoices
    if (req.user.role === 'agent') {
      const clients = await Client.find({ createdBy: req.user.id }).select('_id');
      filter.client = { $in: clients.map(c => c._id) };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    // Execute query
    const invoices = await Invoice.find(filter)
      .populate('client', 'name email company phone')
      .populate('createdBy', 'firstName lastName')
      .populate('payments.receivedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await Invoice.countDocuments(filter);
    
    // Calculate summary statistics
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

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
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
    
    // Check permission for agents
    if (req.user.role === 'agent') {
      const client = await Client.findById(invoice.client);
      if (client.createdBy.toString() !== req.user.id) {
        return sendError(res, 403, 'You can only view invoices from your clients');
      }
    }
    
    // Get collection actions for this invoice
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

// @desc    Create invoice
// @route   POST /api/invoices
// @access  Private
export async function createInvoice(req, res, next) {
  try {
    // Validate input
    const { error } = validateInvoice.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    // Check if client exists
    const client = await Client.findById(req.body.client);
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    // Check permission for agents
    if (req.user.role === 'agent' && client.createdBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only create invoices for your own clients');
    }
    
    // Check if invoice number already exists
    const existingInvoice = await Invoice.findOne({ invoiceNumber: req.body.invoiceNumber });
    if (existingInvoice) {
      return sendError(res, 400, 'Invoice number already exists');
    }
    
    // Calculate item amounts if provided
    let totalAmount = req.body.amount;
    if (req.body.items && req.body.items.length > 0) {
      totalAmount = req.body.items.reduce((sum, item) => sum + item.amount, 0);
      // Override amount with calculated total
      req.body.amount = totalAmount;
    }
    
    // Create invoice
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

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
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
    
    // Check if invoice can be modified
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot modify a paid invoice');
    }
    
    if (invoice.status === 'cancelled') {
      return sendError(res, 400, 'Cannot modify a cancelled invoice');
    }
    
    // Handle cancellation
    if (req.body.status === 'cancelled') {
      req.body.cancelledAt = new Date();
      req.body.cancelledBy = req.user.id;
    }
    
    // Update invoice
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

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private/Admin
export async function deleteInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    // Don't allow deleting paid invoices
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot delete paid invoice');
    }
    
    // Check if there are collection actions
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

// @desc    Add payment to invoice
// @route   POST /api/invoices/:id/payments
// @access  Private
export async function addPayment(req, res, next) {
  try {
    // Validate payment
    const { error } = validatePayment.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    // Check if invoice is already paid or cancelled
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Invoice is already paid');
    }
    
    if (invoice.status === 'cancelled') {
      return sendError(res, 400, 'Cannot add payment to cancelled invoice');
    }
    
    // Check if payment amount is valid
    const remainingAmount = invoice.remainingAmount;
    if (req.body.amount > remainingAmount) {
      return sendError(res, 400, `Payment amount (${req.body.amount}) exceeds remaining balance of ${remainingAmount}`);
    }
    
    // Add payment
    invoice.payments.push({
      ...req.body,
      receivedBy: req.user.id,
      paymentDate: req.body.paymentDate || new Date()
    });
    
    invoice.paidAmount += req.body.amount;
    
    // Status will be auto-updated by pre-save middleware
    await invoice.save();
    
    // Populate for response
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

// @desc    Get invoice payments
// @route   GET /api/invoices/:id/payments
// @access  Private
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