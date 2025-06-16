import express from 'express';
import {
  customerSignup,
  customerLogin,
  merchantSignup,
  merchantLogin,
  adminLogin,
  setupFirstAdmin,
  createAdmin,
  // New password management routes
  customerForgotPassword,
  customerResetPassword,
  merchantForgotPassword,
  merchantResetPassword,
  customerChangePassword,
  merchantChangePassword,
  // New profile management routes
  customerEditProfile,
  merchantEditProfile,
  getCustomerProfile,
  getMerchantProfile
} from '../controllers/authController.js';
import { protect, customerOnly, merchantOnly, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer routes
router.post('/customer/signup', customerSignup);
router.post('/customer/login', customerLogin);
router.post('/customer/forgot-password', customerForgotPassword);
router.post('/customer/reset-password', customerResetPassword); // Changed from PATCH to POST and removed :token

// Protected customer routes
router.patch('/customer/change-password', protect, customerOnly, customerChangePassword);
router.get('/customer/profile', protect, customerOnly, getCustomerProfile);
router.patch('/customer/profile', protect, customerOnly, customerEditProfile);

// Merchant routes
router.post('/merchant/signup', merchantSignup);
router.post('/merchant/login', merchantLogin);
router.post('/merchant/forgot-password', merchantForgotPassword);
router.post('/merchant/reset-password', merchantResetPassword); // Changed from PATCH to POST and removed :token

// Protected merchant routes
router.patch('/merchant/change-password', protect, merchantOnly, merchantChangePassword);
router.get('/merchant/profile', protect, merchantOnly, getMerchantProfile);
router.patch('/merchant/profile', protect, merchantOnly, merchantEditProfile);

// Admin routes
router.post('/admin/setup', setupFirstAdmin); // For creating the first admin
router.post('/admin/login', adminLogin);

// Create additional admin (admin-only)
router.post('/admin/create', protect, adminOnly, createAdmin);

export default router;