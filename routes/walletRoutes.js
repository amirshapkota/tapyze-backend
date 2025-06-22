import express from 'express';
import {
  getWalletBalance,
  topUpWallet,
  transferFunds,
  getTransactionHistory,
  findUserByPhone
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

// User lookup route
router.get('/lookup/:phone', findUserByPhone);

export default router;