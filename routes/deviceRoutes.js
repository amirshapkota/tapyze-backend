import express from 'express';
import {
  assignCardToCustomer,
  getCustomerCards,
  deactivateCard,
  assignScannerToMerchant,
  getMerchantScanners,
  updateScannerStatus,
  getAllCards,
  getAllScanners,
} from '../controllers/deviceController.js';
import { protect, adminOnly  } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// RFID Card routes
router.post('/cards/assign', assignCardToCustomer);
router.get('/cards', getCustomerCards);
router.patch('/cards/:cardId/deactivate', deactivateCard);

// Admin routes for card management
router.post('/admin/cards/assign/:customerId', assignCardToCustomer);
router.get('/admin/customers/:customerId/cards', getCustomerCards);

// NFC Scanner routes
router.post('/scanners/assign', assignScannerToMerchant);
router.get('/scanners', getMerchantScanners);
router.patch('/scanners/:scannerId', updateScannerStatus);

// Admin routes for scanner management
router.post('/admin/scanners/assign/:merchantId', assignScannerToMerchant);
router.get('/admin/merchants/:merchantId/scanners', getMerchantScanners);

// Admin device management routes 
router.get('/admin/cards', protect, adminOnly, getAllCards);
router.get('/admin/scanners', protect, adminOnly, getAllScanners);

export default router;