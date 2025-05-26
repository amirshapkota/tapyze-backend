import express from 'express';
import {
  assignCardToCustomer,
  getCustomerCards,
  deactivateCard,
  verifyCardPin,
  changeCardPin,
  resetCardPin,
  unlockCardPin,
  assignScannerToMerchant,
  getMerchantScanners,
  updateScannerStatus,
  getAllCards,
  getAllScanners,
} from '../controllers/deviceController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// RFID Card routes
router.post('/cards/assign', assignCardToCustomer);
router.get('/cards', getCustomerCards);
router.patch('/cards/:cardId/deactivate', deactivateCard);

// PIN Management routes
router.post('/cards/verify-pin', verifyCardPin);
router.patch('/cards/:cardId/change-pin', changeCardPin);

// Admin routes for card management
router.post('/admin/cards/assign/:customerId', adminOnly, assignCardToCustomer);
router.get('/admin/customers/:customerId/cards', adminOnly, getCustomerCards);
router.patch('/admin/cards/:cardId/reset-pin', adminOnly, resetCardPin);
router.patch('/admin/cards/:cardId/unlock-pin', adminOnly, unlockCardPin);

// NFC Scanner routes
router.post('/scanners/assign', assignScannerToMerchant);
router.get('/scanners', getMerchantScanners);
router.patch('/scanners/:scannerId', updateScannerStatus);

// Admin routes for scanner management
router.post('/admin/scanners/assign/:merchantId', adminOnly, assignScannerToMerchant);
router.get('/admin/merchants/:merchantId/scanners', adminOnly, getMerchantScanners);

// Admin device management routes
router.get('/admin/cards', adminOnly, getAllCards);
router.get('/admin/scanners', adminOnly, getAllScanners);

export default router;