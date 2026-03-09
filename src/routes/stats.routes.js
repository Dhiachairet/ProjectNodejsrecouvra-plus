import express from 'express';
import { getStats, getSummaryStats } from '../controllers/stats.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();


router.use(protect);


router.get('/', getStats);

router.get('/summary', getSummaryStats);

export default router;