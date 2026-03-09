import { CollectionAction } from '../models/CollectionAction.js';
import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { validateCollectionAction, validateCollectionActionUpdate } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';

// @desc    Get all collection actions
// @route   GET /api/collections
// @access  Private
export async function getCollectionActions(req, res, next) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      actionType,
      client,
      fromDate,
      toDate,
      sortBy = 'actionDate',
      order = 'desc'
    } = req.query;
    
    // Build filter
    let filter = {};
    
    if (status) filter.status = status;
    if (actionType) filter.actionType = actionType;
    if (client) filter.client = client;
    
    // Date range filter
    if (fromDate || toDate) {
      filter.actionDate = {};
      if (fromDate) filter.actionDate.$gte = new Date(fromDate);
      if (toDate) filter.actionDate.$lte = new Date(toDate);
    }
    
    // Restrict agents to their own clients' actions
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
    const actions = await CollectionAction.find(filter)
      .populate('invoice', 'invoiceNumber amount status dueDate')
      .populate('client', 'name company phone')
      .populate('performedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await CollectionAction.countDocuments(filter);
    
    // Get summary statistics
    const summary = await CollectionAction.aggregate([
      { $match: filter },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);
    
    sendJson(res, 200, {
      success: true,
      count: actions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary,
      actions
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get single collection action
// @route   GET /api/collections/:id
// @access  Private
export async function getCollectionAction(req, res, next) {
  try {
    const action = await CollectionAction.findById(req.params.id)
      .populate('invoice')
      .populate('client')
      .populate('performedBy', 'firstName lastName email');
    
    if (!action) {
      return sendError(res, 404, 'Collection action not found');
    }
    
    sendJson(res, 200, {
      success: true,
      action
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Create collection action
// @route   POST /api/collections
// @access  Private
export async function createCollectionAction(req, res, next) {
  try {
    // Validate input
    const { error } = validateCollectionAction.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    // Check if invoice exists
    const invoice = await Invoice.findById(req.body.invoice)
      .populate('client');
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
    // Check if invoice is paid
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot create collection action for paid invoice');
    }
    
    // Check permission for agents
    if (req.user.role === 'agent') {
      const client = await Client.findById(invoice.client);
      if (client.createdBy.toString() !== req.user.id) {
        return sendError(res, 403, 'You can only create actions for your own clients');
      }
    }
    
    // Get client contact info for the action
    const client = await Client.findById(invoice.client);
    
    // Create action
    const action = await CollectionAction.create({
      ...req.body,
      client: invoice.client._id,
      performedBy: req.user.id,
      contactPerson: client.name,
      contactEmail: client.email,
      contactPhone: client.phone
    });
    
    // Populate for response
    await action.populate([
      { path: 'invoice', select: 'invoiceNumber amount' },
      { path: 'client', select: 'name company' },
      { path: 'performedBy', select: 'firstName lastName' }
    ]);
    
    sendJson(res, 201, {
      success: true,
      action
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Update collection action
// @route   PUT /api/collections/:id
// @access  Private
export async function updateCollectionAction(req, res, next) {
  try {
    const { error } = validateCollectionActionUpdate.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    let action = await CollectionAction.findById(req.params.id);
    
    if (!action) {
      return sendError(res, 404, 'Collection action not found');
    }
    
    // Check permission
    if (req.user.role === 'agent' && action.performedBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only update actions you created');
    }
    
    // Update action
    action = await CollectionAction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'invoice', select: 'invoiceNumber amount' },
      { path: 'client', select: 'name' },
      { path: 'performedBy', select: 'firstName lastName' }
    ]);
    
    sendJson(res, 200, {
      success: true,
      action
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Delete collection action
// @route   DELETE /api/collections/:id
// @access  Private/Admin
export async function deleteCollectionAction(req, res, next) {
  try {
    const action = await CollectionAction.findById(req.params.id);
    
    if (!action) {
      return sendError(res, 404, 'Collection action not found');
    }
    
    await action.deleteOne();
    
    sendJson(res, 200, {
      success: true,
      message: 'Collection action deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get actions for a specific invoice
// @route   GET /api/collections/invoice/:invoiceId
// @access  Private
export async function getInvoiceActions(req, res, next) {
  try {
    const actions = await CollectionAction.find({ invoice: req.params.invoiceId })
      .populate('performedBy', 'firstName lastName')
      .sort({ actionDate: -1 });
    
    sendJson(res, 200, {
      success: true,
      count: actions.length,
      actions
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get actions for a specific client
// @route   GET /api/collections/client/:clientId
// @access  Private
export async function getClientActions(req, res, next) {
  try {
    const actions = await CollectionAction.find({ client: req.params.clientId })
      .populate('invoice', 'invoiceNumber amount')
      .populate('performedBy', 'firstName lastName')
      .sort({ actionDate: -1 });
    
    sendJson(res, 200, {
      success: true,
      count: actions.length,
      actions
    });
  } catch (error) {
    next(error);
  }
}