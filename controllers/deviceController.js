import RfidCard from '../models/RfidCard.js';
import NfcScanner from '../models/NfcScanner.js';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';

// RFID Card Management
export const assignCardToCustomer = async (req, res, next) => {
  try {
    const { cardUid } = req.body;
    const customerId = req.params.customerId || req.user.id;
    
    // Verify user type if admin is assigning to another user
    if (req.params.customerId && req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to assign cards to other customers'
      });
    }
    
    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
      });
    }
    
    // Check if card is already assigned
    const existingCard = await RfidCard.findOne({ cardUid });
    if (existingCard) {
      return res.status(400).json({
        status: 'error',
        message: 'This card is already assigned'
      });
    }
    
    // Check if customer already has an active card
    const customerActiveCard = await RfidCard.findOne({ 
      owner: customerId,
      isActive: true
    });
    
    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    // Create new RFID card record
    const newCard = await RfidCard.create({
      cardUid,
      owner: customerId,
      expiryDate,
      status: 'ACTIVE'
    });
    
    // If customer had another active card, deactivate it
    if (customerActiveCard) {
      customerActiveCard.isActive = false;
      customerActiveCard.status = 'INACTIVE';
      await customerActiveCard.save();
    }
    
    res.status(201).json({
      status: 'success',
      message: 'RFID card assigned successfully',
      data: {
        card: newCard
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerCards = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || req.user.id;
    
    // Verify user permissions
    if (req.params.customerId && req.user.type !== 'Admin' && req.user.id.toString() !== req.params.customerId) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to view other customers\' cards'
      });
    }
    
    const cards = await RfidCard.find({ 
      owner: customerId 
    }).sort({ issuedAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: cards.length,
      data: {
        cards
      }
    });
  } catch (error) {
    next(error);
  }
};

// In deviceController.js
export const deactivateCard = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;
    
    const card = await RfidCard.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Verify ownership or admin status
    const isOwner = card.owner.toString() === userId.toString();
    const isAdmin = userType === 'Admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to deactivate this card'
      });
    }
    
    // Update card status
    card.isActive = false;
    card.status = req.body.reason === 'LOST' ? 'LOST' : 'INACTIVE';
    
    // Track who deactivated the card (if your model has these fields)
    card.deactivatedAt = new Date();
    card.deactivatedBy = userId;
    
    await card.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Card deactivated successfully',
      data: {
        card
      }
    });
  } catch (error) {
    console.error('Error in deactivateCard:', error);
    next(error);
  }
};

// NFC Scanner Management
export const assignScannerToMerchant = async (req, res, next) => {
  try {
    const { deviceId, model, firmwareVersion } = req.body;
    const merchantId = req.params.merchantId || req.user.id;
    
    // Verify user type if admin is assigning to another merchant
    if (req.params.merchantId && req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to assign scanners to other merchants'
      });
    }
    
    // Check if merchant exists
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        status: 'error',
        message: 'Merchant not found'
      });
    }
    
    // Check if scanner is already assigned
    const existingScanner = await NfcScanner.findOne({ deviceId });
    if (existingScanner) {
      return res.status(400).json({
        status: 'error',
        message: 'This scanner is already assigned'
      });
    }
    
    // Create new NFC scanner record
    const newScanner = await NfcScanner.create({
      deviceId,
      owner: merchantId,
      model,
      firmwareVersion,
      lastConnected: new Date(),
      status: 'ONLINE'
    });
    
    res.status(201).json({
      status: 'success',
      message: 'NFC scanner assigned successfully',
      data: {
        scanner: newScanner
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMerchantScanners = async (req, res, next) => {
  try {
    const merchantId = req.params.merchantId || req.user.id;
    
    // Verify user permissions
    if (req.params.merchantId && req.user.type !== 'Admin' && req.user.id.toString() !== req.params.merchantId) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to view other merchants\' scanners'
      });
    }
    
    const scanners = await NfcScanner.find({ 
      owner: merchantId 
    }).sort({ registeredAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: scanners.length,
      data: {
        scanners
      }
    });
  } catch (error) {
    next(error);
  }
};

// In deviceController.js
export const updateScannerStatus = async (req, res, next) => {
  try {
    const { scannerId } = req.params;
    const { status, firmwareVersion } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    const scanner = await NfcScanner.findById(scannerId);
    
    if (!scanner) {
      return res.status(404).json({
        status: 'error',
        message: 'Scanner not found'
      });
    }
    
    // Check if user is the owner or an admin
    const isOwner = scanner.owner.toString() === userId.toString();
    const isAdmin = userType === 'Admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this scanner'
      });
    }
    
    // Validate status if provided
    if (status) {
      const validStatuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'PENDING_ACTIVATION'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      scanner.status = status;
    }
    
    // Update firmware version if provided
    if (firmwareVersion) {
      scanner.firmwareVersion = firmwareVersion;
    }
    
    // Track last connection
    scanner.lastConnected = new Date();
    
    await scanner.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Scanner updated successfully',
      data: {
        scanner
      }
    });
  } catch (error) {
    console.error('Error in updateScannerStatus:', error);
    next(error);
  }
};


// Get all cards in the system (admin only)
export const getAllCards = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.isActive === 'true') {
      filters.isActive = true;
    } else if (req.query.isActive === 'false') {
      filters.isActive = false;
    }
    
    // Get cards with pagination and populate owner
    const cards = await RfidCard.find(filters)
      .populate('owner', 'fullName email phone')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await RfidCard.countDocuments(filters);
    
    res.status(200).json({
      status: 'success',
      results: cards.length,
      data: {
        cards,
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

// Get all scanners in the system (admin only)
export const getAllScanners = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.isActive === 'true') {
      filters.isActive = true;
    } else if (req.query.isActive === 'false') {
      filters.isActive = false;
    }
    
    // Get scanners with pagination and populate owner
    const scanners = await NfcScanner.find(filters)
      .populate('owner', 'businessName ownerName email')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await NfcScanner.countDocuments(filters);
    
    res.status(200).json({
      status: 'success',
      results: scanners.length,
      data: {
        scanners,
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