import express from 'express';
import {
  processRfidPayment,
  verifyRfidCard,
  getCardTransactionHistory,
  refundCardPayment,
  checkCardBalance
} from '../controllers/paymentController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// RFID Payment routes (updated with PIN support)
router.post('/rfid/process', processRfidPayment);
router.get('/rfid/verify/:cardUid', verifyRfidCard);
router.post('/rfid/verify/:cardUid', verifyRfidCard); // POST version for PIN verification

// Additional card payment routes
router.post('/card/balance', checkCardBalance);
router.get('/card/:cardUid/history', getCardTransactionHistory);

// Refund routes (admin/merchant)
router.post('/transactions/:transactionId/refund', refundCardPayment);

export default router;