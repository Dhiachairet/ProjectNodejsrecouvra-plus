import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { validateClient } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';


export async function getClients(req, res, next) {
  try {
    const { page = 1, limit = 10, search, sortBy = 'name', order = 'asc' } = req.query;
    
    
    let query = {};
    
    
    if (search) {
      query.$text = { $search: search };
    }
    
    
    if (req.user.role === 'agent') {
      query.createdBy = req.user.id;
    }
    
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    
    const clients = await Client.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
   
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


export async function getClient(req, res, next) {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    
    const invoices = await Invoice.find({ client: client._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    
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


export async function createClient(req, res, next) {
  try {
    
    const { error } = validateClient.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
   
    const existingClient = await Client.findOne({ 
      email: req.body.email,
      createdBy: req.user.id
    });
    
    if (existingClient) {
      return sendError(res, 400, 'A client with this email already exists');
    }
    
    
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


export async function updateClient(req, res, next) {
  try {
    let client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    
    if (req.user.role === 'agent' && client.createdBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only update clients you created');
    }
    
    
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


export async function deleteClient(req, res, next) {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
  
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