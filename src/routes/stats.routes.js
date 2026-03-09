import express from 'express';
import { getStats, getSummaryStats } from '../controllers/stats.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All stats routes are protected
router.use(protect);

// Main stats endpoint
router.get('/', getStats);

// Quick summary for dashboard widgets
router.get('/summary', getSummaryStats);

export default router;