import { AuditLog } from '../models/AuditLog.js';
import { validateAuditQuery } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';


export async function getAuditLogs(req, res, next) {
  try {
    const { error, value } = validateAuditQuery.validate(req.query);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const { page, limit, user, action, entity, entityId, from, to } = value;

    const filter = {};
    if (user) filter.user = user;
    // Prefix match so "invoice" returns invoice.create, invoice.cancel, ... (pattern is validated as [a-z_.])
    if (action) filter.action = { $regex: `^${action}` };
    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter)
    ]);

    sendJson(res, 200, {
      success: true,
      count: logs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      logs
    });
  } catch (error) {
    next(error);
  }
}
