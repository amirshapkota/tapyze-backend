import express from 'express';
import {
  processRfidPayment,
  verifyRfidCard
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Payment routes
router.post('/rfid/process', processRfidPayment);
router.get('/rfid/verify/:cardUid', verifyRfidCard);

export default router;