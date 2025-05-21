import express from 'express';
import {
  customerSignup,
  customerLogin,
  merchantSignup,
  merchantLogin,
  adminLogin,
  setupFirstAdmin,
  createAdmin,
} from '../controllers/authController.js';

import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer routes
router.post('/customer/signup', customerSignup);
router.post('/customer/login', customerLogin);

// Merchant routes
router.post('/merchant/signup', merchantSignup);
router.post('/merchant/login', merchantLogin);

// Admin routes
router.post('/admin/setup', setupFirstAdmin); // For creating the first admin
router.post('/admin/login', adminLogin);
// Create additional admin (admin-only)
router.post('/admin/create', protect, adminOnly, createAdmin);

export default router;