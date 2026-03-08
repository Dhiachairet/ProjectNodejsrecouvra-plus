import express from 'express';
import { 
  getInvoices, 
  getInvoice, 
  createInvoice, 
  updateInvoice, 
  deleteInvoice,
  addPayment,
  getInvoicePayments
} from '../controllers/invoice.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();

// All routes are protected
router.use(protect);

// Invoice routes
router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(authorize('admin'), deleteInvoice);

// Payment routes
router.post('/:id/payments', addPayment);
router.get('/:id/payments', getInvoicePayments);

export default router;