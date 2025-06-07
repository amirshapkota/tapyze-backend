import Admin from '../models/Admin.js';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import RfidCard from '../models/RfidCard.js';
import NfcScanner from '../models/NfcScanner.js';

// Get all admins (admin-only)
export const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: admins.length,
      data: {
        admins
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get admin by ID (admin-only)
export const getAdminById = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        admin
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update admin (admin-only)
export const updateAdmin = async (req, res, next) => {
  try {
    const { fullName, email, role } = req.body;
    
    // Don't allow password updates through this route
    if (req.body.password) {
      return res.status(400).json({
        status: 'error',
        message: 'This route is not for password updates. Please use /updatePassword.'
      });
    }
    
    // Check permissions - only SUPER_ADMINs can update role to SUPER_ADMIN
    if (role === 'SUPER_ADMIN') {
      const currentAdmin = await Admin.findById(req.user.id);
      if (currentAdmin.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          status: 'error',
          message: 'Only SUPER_ADMINs can grant SUPER_ADMIN privileges'
        });
      }
    }
    
    // Find and update admin
    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.params.id,
      { fullName, email, role },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedAdmin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        admin: updatedAdmin
      }
    });
  } catch (error) {
    next(error);
  }
};

// Deactivate admin (admin-only) - We don't delete for audit trail
export const deactivateAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    
    // Check permissions - only SUPER_ADMINs can deactivate other SUPER_ADMINs
    const currentAdmin = await Admin.findById(req.user.id);
    if (admin.role === 'SUPER_ADMIN' && currentAdmin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        status: 'error',
        message: 'Only SUPER_ADMINs can deactivate SUPER_ADMINs'
      });
    }
    
    // Prevent self-deactivation
    if (admin._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot deactivate your own account'
      });
    }
    
    // Add isActive field to Admin model if you haven't already
    admin.isActive = false;
    await admin.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Admin account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get all customers (admin-only)
export const getAllCustomers = async (req, res, next) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get customers
    const customers = await Customer.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Customer.countDocuments();
    
    // Populate wallet and RFID card data for each customer
    const customersWithDetails = await Promise.all(
      customers.map(async (customer) => {
        // Get wallet data
        const wallet = await Wallet.findOne({
          owner: customer._id,
          ownerType: 'Customer'
        });
        
        // Get RFID cards
        const rfidCards = await RfidCard.find({
          owner: customer._id
        }).select('cardUid status isActive');
        
        return {
          ...customer.toObject(),
          wallet: wallet ? {
            balance: wallet.balance,
            currency: wallet.currency
          } : null,
          rfidCards: rfidCards || []
        };
      })
    );
    
    res.status(200).json({
      status: 'success',
      results: customersWithDetails.length,
      data: {
        customers: customersWithDetails,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all merchants (admin-only)
export const getAllMerchants = async (req, res, next) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get merchants
    const merchants = await Merchant.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Merchant.countDocuments();
    
    // Populate wallet and NFC scanner data for each merchant
    const merchantsWithDetails = await Promise.all(
      merchants.map(async (merchant) => {
        // Get wallet data
        const wallet = await Wallet.findOne({
          owner: merchant._id,
          ownerType: 'Merchant'
        });
        
        // Get NFC scanners
        const nfcScanners = await NfcScanner.find({
          owner: merchant._id
        }).select('deviceId status isActive model');
        
        return {
          ...merchant.toObject(),
          wallet: wallet ? {
            balance: wallet.balance,
            currency: wallet.currency
          } : null,
          nfcScanners: nfcScanners || []
        };
      })
    );
    
    res.status(200).json({
      status: 'success',
      results: merchantsWithDetails.length,
      data: {
        merchants: merchantsWithDetails,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all transactions (admin-only)
export const getAllTransactions = async (req, res, next) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Optional date filters
    const dateFilter = {};
    if (req.query.startDate) {
      dateFilter.createdAt = { $gte: new Date(req.query.startDate) };
    }
    if (req.query.endDate) {
      if (dateFilter.createdAt) {
        dateFilter.createdAt.$lte = new Date(req.query.endDate);
      } else {
        dateFilter.createdAt = { $lte: new Date(req.query.endDate) };
      }
    }
    
    // Get transactions with pagination
    const transactions = await Transaction.find(dateFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'wallet',
        select: 'owner ownerType'
      });
    
    // Get total count for pagination info
    const total = await Transaction.countDocuments(dateFilter);
    
    res.status(200).json({
      status: 'success',
      results: transactions.length,
      data: {
        transactions,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (error) {
    next(error);
  }
};