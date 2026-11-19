import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';
import { CollectionAction } from '../models/CollectionAction.js';
import { User } from '../models/User.js';
import { validateClient, validateClientUpdate, validateAssignAgents } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';
import { pagination } from '../utils/pagination.js';
import { clientScope, canAccessClient } from '../utils/access.js';
import { audit } from '../utils/audit.js';

const AGENT_FIELDS = 'firstName lastName email';


export async function getClients(req, res, next) {
  try {
    const { search, agent, sortBy = 'name', order = 'asc' } = req.query;
    
    
    let query = clientScope(req.user);
    
    
    if (search) {
      query.$text = { $search: search };
    }
    
    
    if (agent && req.user.role !== 'agent') {
      query.assignedAgents = agent;
    }
    
    
    const { page, limit, skip } = pagination(req.query);
    
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    
    const clients = await Client.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedAgents', AGENT_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
   
    const total = await Client.countDocuments(query);
    
    sendJson(res, 200, {
      success: true,
      count: clients.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      clients
    });
  } catch (error) {
    next(error);
  }
}


export async function getClient(req, res, next) {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedAgents', AGENT_FIELDS);
    
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

    await audit(req, 'client.create', { entity: 'Client', entityId: client._id, details: { name: client.name } });
    
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
    const { error } = validateClientUpdate.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    let client = await Client.findById(req.params.id);
    
    if (!client) {
      return sendError(res, 404, 'Client not found');
    }
    
    
    if (!canAccessClient(req.user, client)) {
      return sendError(res, 403, 'You can only update your own clients');
    }
    
    
    client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
      .populate('assignedAgents', AGENT_FIELDS);

    await audit(req, 'client.update', { entity: 'Client', entityId: client._id, details: { fields: Object.keys(req.body) } });
    
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

    await audit(req, 'client.delete', { entity: 'Client', entityId: client._id, details: { name: client.name } });
    
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


export async function assignAgents(req, res, next) {
  try {
    const { error, value } = validateAssignAgents.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const client = await Client.findById(req.params.id);

    if (!client) {
      return sendError(res, 404, 'Client not found');
    }


    const agentCount = await User.countDocuments({ _id: { $in: value.agents }, role: 'agent', active: true });
    if (agentCount !== value.agents.length) {
      return sendError(res, 400, 'Only active users with the agent role can be assigned to a client');
    }

    const before = client.assignedAgents.map(String);
    client.assignedAgents = value.agents;
    await client.save();
    await client.populate('assignedAgents', AGENT_FIELDS);

    await audit(req, 'client.assign_agents', {
      entity: 'Client',
      entityId: client._id,
      details: { before, after: value.agents }
    });

    sendJson(res, 200, {
      success: true,
      client
    });
  } catch (error) {
    next(error);
  }
}
