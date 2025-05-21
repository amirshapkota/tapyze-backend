import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deactivateAdmin,
  getAllCustomers,
  getAllMerchants,
  getAllTransactions
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all routes with authentication
router.use(protect);
// Restrict all routes to admin users
router.use(adminOnly);

// Admin management routes
router.get('/admins', getAllAdmins);
router.get('/admins/:id', getAdminById);
router.patch('/admins/:id', updateAdmin);
router.patch('/admins/:id/deactivate', deactivateAdmin);

// User data access routes
router.get('/customers', getAllCustomers);
router.get('/merchants', getAllMerchants);
router.get('/transactions', getAllTransactions);

export default router;