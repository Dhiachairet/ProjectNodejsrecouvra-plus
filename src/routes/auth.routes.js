import express from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { protect, optionalProtect } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = express.Router();


router.post('/register', optionalProtect, register);
router.post('/login', loginLimiter, login);


router.get('/me', protect, getMe);

export default router;