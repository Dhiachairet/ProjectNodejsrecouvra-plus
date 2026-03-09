import express from 'express';
import { 
  getCollectionActions, 
  getCollectionAction, 
  createCollectionAction, 
  updateCollectionAction, 
  deleteCollectionAction,
  getInvoiceActions,
  getClientActions
} from '../controllers/collection.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();

// All routes are protected
router.use(protect);

// Collection routes
router.route('/')
  .get(getCollectionActions)
  .post(createCollectionAction);

router.route('/:id')
  .get(getCollectionAction)
  .put(updateCollectionAction)
  .delete(authorize('admin'), deleteCollectionAction);

// Specialized routes
router.get('/invoice/:invoiceId', getInvoiceActions);
router.get('/client/:clientId', getClientActions);

export default router;