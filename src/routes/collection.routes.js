import express from 'express';
import { 
  getCollectionActions, 
  getCollectionAction, 
  createCollectionAction, 
  updateCollectionAction, 
  changeActionStatus,
  deleteCollectionAction,
  getInvoiceActions,
  getClientActions
} from '../controllers/collection.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();


router.use(protect);


router.route('/')
  .get(getCollectionActions)
  .post(createCollectionAction);

router.route('/:id')
  .get(getCollectionAction)
  .put(updateCollectionAction)
  .delete(authorize('admin'), deleteCollectionAction);


router.patch('/:id/status', changeActionStatus);

router.get('/invoice/:invoiceId', getInvoiceActions);
router.get('/client/:clientId', getClientActions);

export default router;