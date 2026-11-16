import express from 'express';
import { 
  getClients, 
  getClient, 
  createClient, 
  updateClient, 
  deleteClient,
  getClientInvoices,
  assignAgents
} from '../controllers/client.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();


router.use(protect);


router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(authorize('admin', 'manager'), deleteClient);


router.get('/:id/invoices', getClientInvoices);
router.put('/:id/agents', authorize('admin', 'manager'), assignAgents);

export default router;