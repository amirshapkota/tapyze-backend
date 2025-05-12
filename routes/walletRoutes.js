import express from 'express';
import {
  getWalletBalance,
  topUpWallet,
  transferFunds,
  getTransactionHistory
} from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all wallet routes
router.use(protect);

// Wallet routes
router.get('/balance', getWalletBalance);
router.post('/topup', topUpWallet);
router.post('/transfer', transferFunds);
router.get('/transactions', getTransactionHistory);

export default router;