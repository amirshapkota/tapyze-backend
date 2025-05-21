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

export const deactivateCard = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id; // or req.user._id if that's what your auth middleware sets
    const userType = req.user.type;
    
    console.log(`Deactivation attempt - Card ID: ${cardId}, User ID: ${userId}, User Type: ${userType}`);
    
    const card = await RfidCard.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Convert both IDs to strings for comparison
    const cardOwnerStr = card.owner.toString();
    const userIdStr = userId.toString();
    
    console.log(`Comparing - Card Owner: ${cardOwnerStr}, User ID: ${userIdStr}`);
    
    // Check if user is the owner or an admin
    const isOwner = cardOwnerStr === userIdStr;
    const isAdmin = userType === 'Admin';
    
    console.log(`Authorization - Is Owner: ${isOwner}, Is Admin: ${isAdmin}`);
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to deactivate this card'
      });
    }
    
    // Update card status
    card.isActive = false;
    card.status = req.body.reason === 'LOST' ? 'LOST' : 'INACTIVE';
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

export const updateScannerStatus = async (req, res, next) => {
  try {
    const { scannerId } = req.params;
    const { status, firmwareVersion } = req.body;
    const merchantId = req.user.id;
    
    const scanner = await NfcScanner.findById(scannerId);
    
    if (!scanner) {
      return res.status(404).json({
        status: 'error',
        message: 'Scanner not found'
      });
    }
    
    // Verify ownership
    if (scanner.owner.toString() !== merchantId && req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this scanner'
      });
    }
    
    // Update scanner
    if (status) {
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
    next(error);
  }
};