import express from 'express';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser 
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
const router = express.Router();

// All user routes are protected
router.use(protect);

// Routes accessible by admin and manager
router.route('/')
  .get(authorize('admin', 'manager'), getUsers);

router.route('/:id')
  .get(authorize('admin', 'manager'), getUser)
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser);

export default router;