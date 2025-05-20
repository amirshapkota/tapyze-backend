import express from 'express';
import {
  customerSignup,
  customerLogin,
  merchantSignup,
  merchantLogin
} from '../controllers/authController.js';

const router = express.Router();

// Customer routes
router.post('/customer/signup', customerSignup);
router.post('/customer/login', customerLogin);

// Merchant routes
router.post('/merchant/signup', merchantSignup);
router.post('/merchant/login', merchantLogin);

// Admin routes
router.post('/admin/login', adminLogin);

export default router;