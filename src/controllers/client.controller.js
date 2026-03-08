import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { validateClient } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
export async function getClients(req, res, next) {
  try {
    const { page = 1, limit = 10, search, sortBy = 'name', order = 'asc' } = req.query;
    
    // Build query
    let query = {};
    
    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }
    
    // Filter by createdBy if not admin (optional - depends on requirements)
    if (req.user.role === 'agent') {
      query.createdBy = req.user.id;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    // Execute query
    const clients = await Client.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await Client.countDocuments(query);
    
    sendJson(res, 200, {
      success: true,
      count: clients.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      clients
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
export async function getClient(req, res, next) {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    // Get client's invoices
    const invoices = await Invoice.find({ client: client._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get recent collection actions
    const recentActions = await CollectionAction.find({ client: client._id })
      .populate('performedBy', 'firstName lastName')
      .populate('invoice', 'invoiceNumber')
      .sort({ actionDate: -1 })
      .limit(5);
    
    sendJson(res, 200, {
      success: true,
      client,
      stats: {
        totalInvoices: client.totalInvoices,
        totalPaid: client.totalPaid,
        totalUnpaid: client.totalUnpaid,
        outstandingBalance: client.outstandingBalance
      },
      recentInvoices: invoices,
      recentActions
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Create client
// @route   POST /api/clients
// @access  Private
export async function createClient(req, res, next) {
  try {
    // Validate input
    const { error } = validateClient.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    // Check if client with same email already exists for this user/company
    const existingClient = await Client.findOne({ 
      email: req.body.email,
      createdBy: req.user.id
    });
    
    if (existingClient) {
      return sendError(res, 400, 'A client with this email already exists');
    }
    
    // Create client
    const client = await Client.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    sendJson(res, 201, {
      success: true,
      client
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
export async function updateClient(req, res, next) {
  try {
    let client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    // Check permission (agents can only update their own clients)
    if (req.user.role === 'agent' && client.createdBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only update clients you created');
    }
    
    // Update client
    client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');
    
    sendJson(res, 200, {
      success: true,
      client
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private/Manager/Admin
export async function deleteClient(req, res, next) {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    // Check if client has invoices
    const invoiceCount = await Invoice.countDocuments({ client: client._id });
    if (invoiceCount > 0) {
      return sendError(res, 400, 'Cannot delete client with existing invoices');
    }
    
    await client.deleteOne();
    
    sendJson(res, 200, {
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get client invoices
// @route   GET /api/clients/:id/invoices
// @access  Private
export async function getClientInvoices(req, res, next) {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    const invoices = await Invoice.find({ client: client._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    sendJson(res, 200, {
      success: true,
      count: invoices.length,
      invoices
    });
  } catch (error) {
    next(error);
  }
}