import RfidCard from '../models/RfidCard.js';
import NfcScanner from '../models/NfcScanner.js';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';

// RFID Card Management with PIN
export const assignCardToCustomer = async (req, res, next) => {
  try {
    const { cardUid, pin } = req.body;
    const customerId = req.params.customerId || req.user.id;
    
    // Validate PIN
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN must be 4-6 digits'
      });
    }
    
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
    
    // Create new RFID card record with PIN
    const newCard = await RfidCard.create({
      cardUid,
      owner: customerId,
      pin,
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
      message: 'RFID card assigned successfully with PIN',
      data: {
        card: newCard
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify PIN for transactions
export const verifyCardPin = async (req, res, next) => {
  try {
    const { cardUid, pin } = req.body;
    
    if (!cardUid || !pin) {
      return res.status(400).json({
        status: 'error',
        message: 'Card UID and PIN are required'
      });
    }
    
    // Find card and include PIN for verification
    const card = await RfidCard.findOne({ cardUid }).select('+pin');
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    if (!card.isActive) {
      return res.status(400).json({
        status: 'error',
        message: 'Card is not active'
      });
    }
    
    if (card.status === 'EXPIRED' || card.expiryDate < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'Card has expired'
      });
    }
    
    try {
      const isValidPin = await card.verifyPin(pin);
      
      if (!isValidPin) {
        const remainingAttempts = 3 - card.pinAttempts;
        return res.status(400).json({
          status: 'error',
          message: 'Invalid PIN',
          data: {
            remainingAttempts: Math.max(0, remainingAttempts),
            isLocked: card.isPinLocked()
          }
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'PIN verified successfully',
        data: {
          cardId: card._id,
          owner: card.owner,
          verified: true
        }
      });
    } catch (pinError) {
      return res.status(400).json({
        status: 'error',
        message: pinError.message
      });
    }
  } catch (error) {
    next(error);
  }
};

// Change card PIN
export const changeCardPin = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;
    
    if (!currentPin || !newPin) {
      return res.status(400).json({
        status: 'error',
        message: 'Current PIN and new PIN are required'
      });
    }
    
    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({
        status: 'error',
        message: 'New PIN must be 4-6 digits'
      });
    }
    
    if (currentPin === newPin) {
      return res.status(400).json({
        status: 'error',
        message: 'New PIN must be different from current PIN'
      });
    }
    
    // Find card with PIN
    const card = await RfidCard.findById(cardId).select('+pin');
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Verify ownership
    if (card.owner.toString() !== userId.toString() && req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to change this card\'s PIN'
      });
    }
    
    // Verify current PIN
    try {
      const isValidCurrentPin = await card.verifyPin(currentPin);
      if (!isValidCurrentPin) {
        return res.status(400).json({
          status: 'error',
          message: 'Current PIN is incorrect'
        });
      }
    } catch (pinError) {
      return res.status(400).json({
        status: 'error',
        message: pinError.message
      });
    }
    
    // Update PIN
    card.pin = newPin;
    card.requiresPinChange = false;
    await card.save();
    
    res.status(200).json({
      status: 'success',
      message: 'PIN changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Reset card PIN
export const resetCardPin = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { newPin } = req.body;
    
    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({
        status: 'error',
        message: 'New PIN must be 4-6 digits'
      });
    }
    
    const card = await RfidCard.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Reset PIN and unlock card
    card.pin = newPin;
    card.unlockPin();
    card.requiresPinChange = true; // Force user to change PIN on next use
    await card.save();
    
    res.status(200).json({
      status: 'success',
      message: 'PIN reset successfully. User must change PIN on next use.'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Unlock card PIN
export const unlockCardPin = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    
    const card = await RfidCard.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    card.unlockPin();
    await card.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Card PIN unlocked successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get customer cards (existing function - no changes needed)
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

// Deactivate card (existing function - no changes needed)
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
    
    // Track who deactivated the card
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

// NFC Scanner Management (existing functions - no changes needed)
export const assignScannerToMerchant = async (req, res, next) => {
  try {
    const { deviceId, model, firmwareVersion } = req.body;
    const merchantId = req.params.merchantId || req.user.id;
    
    if (req.params.merchantId && req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to assign scanners to other merchants'
      });
    }
    
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        status: 'error',
        message: 'Merchant not found'
      });
    }
    
    const existingScanner = await NfcScanner.findOne({ deviceId });
    if (existingScanner) {
      return res.status(400).json({
        status: 'error',
        message: 'This scanner is already assigned'
      });
    }
    
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
    
    const isOwner = scanner.owner.toString() === userId.toString();
    const isAdmin = userType === 'Admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this scanner'
      });
    }
    
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
    
    if (firmwareVersion) {
      scanner.firmwareVersion = firmwareVersion;
    }
    
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

export const getAllCards = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.isActive === 'true') {
      filters.isActive = true;
    } else if (req.query.isActive === 'false') {
      filters.isActive = false;
    }
    
    const cards = await RfidCard.find(filters)
      .populate('owner', 'fullName email phone')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(limit);
    
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

export const getAllScanners = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.isActive === 'true') {
      filters.isActive = true;
    } else if (req.query.isActive === 'false') {
      filters.isActive = false;
    }
    
    const scanners = await NfcScanner.find(filters)
      .populate('owner', 'businessName ownerName email')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit);
    
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