import { CollectionAction } from '../models/CollectionAction.js';
import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { validateCollectionAction, validateCollectionActionUpdate, validateStatusTransition } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';
import { pagination } from '../utils/pagination.js';
import { canAccessClient, clientFilterFor } from '../utils/access.js';
import { audit } from '../utils/audit.js';
import { checkTransition } from '../workflows/collectionAction.workflow.js';

const ACTION_POPULATE = [
  { path: 'invoice', select: 'invoiceNumber amount' },
  { path: 'client', select: 'name' },
  { path: 'performedBy', select: 'firstName lastName' }
];


export async function getCollectionActions(req, res, next) {
  try {
    const { 
      status, 
      actionType,
      client,
      fromDate,
      toDate,
      sortBy = 'actionDate',
      order = 'desc'
    } = req.query;
    
    
    let filter = {};
    
    if (status) filter.status = status;
    if (actionType) filter.actionType = actionType;

    const clientFilter = await clientFilterFor(req.user, client);
    if (clientFilter) filter.client = clientFilter;
    
    
    if (fromDate || toDate) {
      filter.actionDate = {};
      if (fromDate) filter.actionDate.$gte = new Date(fromDate);
      if (toDate) filter.actionDate.$lte = new Date(toDate);
    }
    

    
    const { page, limit, skip } = pagination(req.query);
    
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    
    const actions = await CollectionAction.find(filter)
      .populate('invoice', 'invoiceNumber amount status dueDate')
      .populate('client', 'name company phone')
      .populate('performedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    
    const total = await CollectionAction.countDocuments(filter);
    
    
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
      page,
      pages: Math.ceil(total / limit),
      summary,
      actions
    });
  } catch (error) {
    next(error);
  }
}


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


export async function createCollectionAction(req, res, next) {
  try {
    
    const { error } = validateCollectionAction.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    
    const invoice = await Invoice.findById(req.body.invoice)
      .populate('client');
    
    if (!invoice) {
      return sendError(res, 404, 'Invoice not found');
    }
    
   
    if (invoice.status === 'paid') {
      return sendError(res, 400, 'Cannot create collection action for paid invoice');
    }
    
    
    const client = await Client.findById(invoice.client);
    if (!canAccessClient(req.user, client)) {
      return sendError(res, 403, 'You can only create actions for your own clients');
    }
    
    
    const action = await CollectionAction.create({
      ...req.body,
      client: invoice.client._id,
      performedBy: req.user.id,
      contactPerson: client.name,
      contactEmail: client.email,
      contactPhone: client.phone,
      statusHistory: [{ to: 'planned', changedBy: req.user._id, note: 'Action created' }]
    });

    await audit(req, 'action.create', {
      entity: 'CollectionAction',
      entityId: action._id,
      details: { actionType: action.actionType, invoice: invoice.invoiceNumber }
    });
    
    
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
    
   
    if (req.user.role === 'agent' && action.performedBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only update actions you created');
    }
    
    
    action = await CollectionAction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate(ACTION_POPULATE);

    await audit(req, 'action.update', {
      entity: 'CollectionAction',
      entityId: action._id,
      details: { fields: Object.keys(req.body) }
    });
    
    sendJson(res, 200, {
      success: true,
      action
    });
  } catch (error) {
    next(error);
  }
}


export async function changeActionStatus(req, res, next) {
  try {
    const { error, value } = validateStatusTransition.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const action = await CollectionAction.findById(req.params.id);

    if (!action) {
      return sendError(res, 404, 'Collection action not found');
    }

    if (req.user.role === 'agent' && action.performedBy.toString() !== req.user.id) {
      return sendError(res, 403, 'You can only change the status of actions you created');
    }

    const from = action.status;
    const refusal = checkTransition({
      from,
      to: value.status,
      role: req.user.role,
      result: value.result,
      actionDate: value.actionDate
    });
    if (refusal) {
      return sendError(res, refusal.status, refusal.message);
    }

    const changes = { status: value.status };
    if (value.result) changes.result = value.result;
    if (value.status === 'planned') changes.actionDate = value.actionDate;

    // Conditional on the current status so two concurrent transitions cannot both succeed.
    const updated = await CollectionAction.findOneAndUpdate(
      { _id: action._id, status: from },
      {
        $set: changes,
        $push: { statusHistory: { from, to: value.status, changedBy: req.user._id, note: value.result } }
      },
      { new: true, runValidators: true }
    ).populate(ACTION_POPULATE);

    if (!updated) {
      return sendError(res, 409, 'The action status was changed by someone else, reload and try again');
    }

    await audit(req, 'action.status_change', {
      entity: 'CollectionAction',
      entityId: action._id,
      details: { from, to: value.status }
    });

    sendJson(res, 200, {
      success: true,
      action: updated
    });
  } catch (error) {
    next(error);
  }
}


export async function deleteCollectionAction(req, res, next) {
  try {
    const action = await CollectionAction.findById(req.params.id);
    
    if (!action) {
      return sendError(res, 404, 'Collection action not found');
    }
    
    await action.deleteOne();

    await audit(req, 'action.delete', {
      entity: 'CollectionAction',
      entityId: action._id,
      details: { actionType: action.actionType, status: action.status }
    });
    
    sendJson(res, 200, {
      success: true,
      message: 'Collection action deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}


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