import express from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();


router.use(protect, authorize('admin'));

// Read-only: the audit trail has no create/update/delete endpoint.
router.get('/', getAuditLogs);

export default router;
