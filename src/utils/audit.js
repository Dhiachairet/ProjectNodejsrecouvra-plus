import { AuditLog } from '../models/AuditLog.js';

// Records a sensitive action in the audit log. A failed write is reported but never fails the request.
export async function audit(req, action, { entity, entityId, details, actor = req.user } = {}) {
  try {
    await AuditLog.create({
      user: actor?._id,
      userEmail: actor?.email ?? details?.email,
      role: actor?.role,
      action,
      entity,
      entityId,
      details,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  } catch (error) {
    console.error(`Audit log write failed for ${action}:`, error.message);
  }
}
