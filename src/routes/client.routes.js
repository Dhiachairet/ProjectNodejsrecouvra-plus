import express from 'express';
import { 
  getClients, 
  getClient, 
  createClient, 
  updateClient, 
  deleteClient,
  getClientInvoices
} from '../controllers/client.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();

// All routes are protected
router.use(protect);

// Client routes
router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(authorize('admin', 'manager'), deleteClient);

// Get client invoices
router.get('/:id/invoices', getClientInvoices);

export default router;