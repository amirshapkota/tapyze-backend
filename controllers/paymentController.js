import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import RfidCard from '../models/RfidCard.js';
import NfcScanner from '../models/NfcScanner.js';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import mongoose from 'mongoose';

// RFID payment processing with PIN verification and retry mechanism
export const processRfidPayment = async (req, res, next) => {
  let session = null;
  
  try {
    const { cardUid, pin, amount, description } = req.body;
    const merchantId = req.user.id;
    
    // Validate required fields
    if (!cardUid || !pin || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Card UID, PIN, and amount are required'
      });
    }
    
    // Verify amount
    if (amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid amount'
      });
    }
    
    // Step 1: Handle PIN verification OUTSIDE of transaction
    let card = await RfidCard.findOne({
      cardUid,
      isActive: true
    }).select('+pin');
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Invalid or inactive RFID card'
      });
    }
    
    // Check card status
    if (card.status === 'PIN_LOCKED') {
      return res.status(400).json({
        status: 'error',
        message: 'Card is locked due to multiple failed PIN attempts',
        data: {
          isLocked: true,
          unlockTime: card.pinLockedUntil
        }
      });
    }
    
    if (card.status !== 'ACTIVE') {
      return res.status(400).json({
        status: 'error',
        message: `Card is ${card.status.toLowerCase()}`
      });
    }
    
    // Check if card is expired
    if (card.expiryDate < new Date()) {
      card.isActive = false;
      card.status = 'EXPIRED';
      await card.save();
      
      return res.status(400).json({
        status: 'error',
        message: 'RFID card has expired'
      });
    }
    
    // Verify PIN (outside transaction)
    try {
      const isValidPin = await card.verifyPin(pin);
      
      // Save PIN verification result immediately
      await card.save();
      
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
      
    } catch (pinError) {
      // Save the card even if there's an error
      try {
        await card.save();
      } catch (saveError) {
        console.error('Error saving card after PIN error:', saveError);
      }
      
      return res.status(400).json({
        status: 'error',
        message: pinError.message
      });
    }
    
    // Check if PIN change is required
    if (card.requiresPinChange) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN change required before making transactions',
        requiresPinChange: true
      });
    }
    
    // Step 2: Start transaction for payment processing with retry mechanism
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      session = await mongoose.startSession();
      
      try {
        await session.startTransaction();
        
        // Find the merchant wallet
        const merchantWallet = await Wallet.findOne({
          owner: merchantId,
          ownerType: 'Merchant'
        }).session(session);
        
        if (!merchantWallet) {
          throw new Error('Merchant wallet not found');
        }
        
        // Refetch card with session
        const cardInTransaction = await RfidCard.findOne({
          cardUid,
          isActive: true
        }).session(session);
        
        if (!cardInTransaction) {
          throw new Error('Card not found in transaction');
        }
        
        // Find the customer wallet
        const customerWallet = await Wallet.findOne({
          owner: cardInTransaction.owner,
          ownerType: 'Customer'
        }).session(session);
        
        if (!customerWallet) {
          throw new Error('Customer wallet not found');
        }
        
        // Check sufficient balance
        if (customerWallet.balance < amount) {
          throw new Error(`Insufficient funds. Balance: ${customerWallet.balance}, Required: ${amount}`);
        }
        
        // Generate a unique reference for this payment
        const reference = `RFID${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        // Create customer transaction (debit)
        const customerTransaction = await Transaction.create([{
          wallet: customerWallet._id,
          amount: -amount, // Negative for debit
          type: 'DEBIT',
          description: description || 'RFID Payment',
          reference: `${reference}-PAY`,
          metadata: {
            paymentType: 'RFID_TAP',
            merchant: {
              id: merchantId,
              type: 'Merchant'
            },
            cardUid: cardUid,
            cardId: cardInTransaction._id
          }
        }], { session });
        
        // Create merchant transaction (credit)
        const merchantTransaction = await Transaction.create([{
          wallet: merchantWallet._id,
          amount,
          type: 'CREDIT',
          description: description || 'RFID Payment Received',
          reference: `${reference}-RECV`,
          metadata: {
            paymentType: 'RFID_TAP',
            customer: {
              id: cardInTransaction.owner,
              type: 'Customer'
            },
            cardUid: cardUid,
            cardId: cardInTransaction._id
          }
        }], { session });
        
        // Update customer wallet
        customerWallet.balance -= amount;
        customerWallet.transactions.push(customerTransaction[0]._id);
        await customerWallet.save({ session });
        
        // Update merchant wallet
        merchantWallet.balance += amount;
        merchantWallet.transactions.push(merchantTransaction[0]._id);
        await merchantWallet.save({ session });
        
        // Update card last used timestamp
        cardInTransaction.lastUsed = new Date();
        await cardInTransaction.save({ session });
        
        await session.commitTransaction();
        session.endSession();
        
        return res.status(200).json({
          status: 'success',
          message: 'Payment processed successfully',
          data: {
            amount,
            customerBalance: customerWallet.balance,
            merchantBalance: merchantWallet.balance,
            transactionReference: reference,
            customerTransaction: customerTransaction[0],
            merchantTransaction: merchantTransaction[0]
          }
        });
        
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        lastError = error;
        
        // Check if it's a write conflict error that we can retry
        if (error.message && error.message.includes('Write conflict') && attempt < maxRetries) {
          console.log(`Write conflict on attempt ${attempt}, retrying...`);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        } else {
          // If it's not a retryable error or exhausted retries, break
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    if (lastError.message && lastError.message.includes('Insufficient funds')) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient funds in customer wallet'
      });
    } else if (lastError.message && lastError.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: lastError.message
      });
    } else {
      throw lastError;
    }
    
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error('Payment processing error:', error);
    next(error);
  }
};

// card verification with PIN
export const verifyRfidCard = async (req, res, next) => {
  try {
    const { cardUid } = req.params;
    const { pin } = req.body; // PIN can be optional for basic verification
    
    const card = await RfidCard.findOne({
      cardUid,
      isActive: true
    }).select(pin ? '+pin' : ''); // Only select PIN if provided
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Invalid or inactive RFID card'
      });
    }
    
    // Check if card is expired
    if (card.expiryDate < new Date()) {
      card.isActive = false;
      card.status = 'EXPIRED';
      await card.save();
      
      return res.status(400).json({
        status: 'error',
        message: 'RFID card has expired'
      });
    }
    
    // Check card status
    if (card.status === 'PIN_LOCKED') {
      return res.status(400).json({
        status: 'error',
        message: 'Card is temporarily locked due to failed PIN attempts',
        data: {
          isLocked: true,
          unlockTime: card.pinLockedUntil
        }
      });
    }
    
    // If PIN is provided, verify it
    if (pin) {
      try {
        const isValidPin = await card.verifyPin(pin);
        
        // Always save the card after verifyPin regardless of result
        await card.save();
        
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
      } catch (pinError) {
        // Save the card even if there's an error
        try {
          await card.save();
        } catch (saveError) {
          console.error('Error saving card after PIN error:', saveError);
        }
        
        return res.status(400).json({
          status: 'error',
          message: pinError.message
        });
      }
    }
    
    // Get wallet balance
    const wallet = await Wallet.findOne({
      owner: card.owner,
      ownerType: 'Customer'
    });
    
    const responseData = {
      cardStatus: 'VALID',
      status: card.status,
      expiryDate: card.expiryDate,
      lastUsed: card.lastUsed
    };
    
    // Only include balance if PIN was verified or not required
    if (pin || !pin) {
      responseData.balance = wallet ? wallet.balance : null;
      responseData.currency = wallet ? wallet.currency : null;
    }
    
    // Include PIN change requirement
    if (card.requiresPinChange) {
      responseData.requiresPinChange = true;
    }
    
    res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

// Get card transaction history
export const getCardTransactionHistory = async (req, res, next) => {
  try {
    const { cardUid } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;
    
    // Find the card
    const card = await RfidCard.findOne({ cardUid });
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Verify ownership or admin access
    if (card.owner.toString() !== userId.toString() && userType !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to view this card\'s transaction history'
      });
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get transactions where this card was used
    const transactions = await Transaction.find({
      cardUsed: card._id
    })
    .populate('merchantId', 'businessName ownerName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Transaction.countDocuments({
      cardUsed: card._id
    });
    
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

// Refund card payment (admin/merchant only)
export const refundCardPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { transactionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    // Find the original transaction
    const originalTransaction = await Transaction.findById(transactionId).session(session);
    
    if (!originalTransaction) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    if (originalTransaction.status !== 'COMPLETED') {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Only completed transactions can be refunded'
      });
    }
    
    // Check if already refunded
    const existingRefund = await Transaction.findOne({
      type: 'REFUND',
      'metadata.originalTransactionId': transactionId
    }).session(session);
    
    if (existingRefund) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Transaction has already been refunded'
      });
    }
    
    // Verify permissions (admin or merchant who received the payment)
    if (userType !== 'Admin' && originalTransaction.toOwner.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to refund this transaction'
      });
    }
    
    // Get the wallets
    const customerWallet = await Wallet.findById(originalTransaction.from).session(session);
    const merchantWallet = await Wallet.findById(originalTransaction.to).session(session);
    
    if (!customerWallet || !merchantWallet) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }
    
    // Check merchant has sufficient balance for refund
    if (merchantWallet.balance < originalTransaction.amount - originalTransaction.fee) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Merchant has insufficient balance for refund'
      });
    }
    
    // Process refund
    const refundAmount = originalTransaction.amount - originalTransaction.fee;
    customerWallet.balance += refundAmount;
    merchantWallet.balance -= refundAmount;
    
    // Save wallet updates
    await customerWallet.save({ session });
    await merchantWallet.save({ session });
    
    // Create refund transaction
    const refundTransaction = await Transaction.create([{
      type: 'REFUND',
      amount: refundAmount,
      fee: 0,
      from: merchantWallet._id,
      to: customerWallet._id,
      fromOwner: originalTransaction.toOwner,
      toOwner: originalTransaction.fromOwner,
      description: `Refund for transaction ${transactionId}${reason ? ': ' + reason : ''}`,
      cardUsed: originalTransaction.cardUsed,
      merchantId: originalTransaction.merchantId,
      status: 'COMPLETED',
      metadata: {
        originalTransactionId: transactionId,
        refundReason: reason,
        refundedBy: userId
      }
    }], { session });
    
    // Update original transaction status
    originalTransaction.status = 'REFUNDED';
    await originalTransaction.save({ session });
    
    await session.commitTransaction();
    
    res.status(200).json({
      status: 'success',
      message: 'Refund processed successfully',
      data: {
        refundTransaction: refundTransaction[0],
        refundAmount,
        customerNewBalance: customerWallet.balance,
        merchantNewBalance: merchantWallet.balance
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in refundCardPayment:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

// Check card balance (customer only - requires PIN)
export const checkCardBalance = async (req, res, next) => {
  try {
    const { cardUid, pin } = req.body;
    
    if (!cardUid || !pin) {
      return res.status(400).json({
        status: 'error',
        message: 'Card UID and PIN are required'
      });
    }
    
    // Find card with PIN
    const card = await RfidCard.findOne({ cardUid }).select('+pin');
    
    if (!card) {
      return res.status(404).json({
        status: 'error',
        message: 'Card not found'
      });
    }
    
    // Verify PIN
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
    } catch (pinError) {
      return res.status(400).json({
        status: 'error',
        message: pinError.message
      });
    }
    
    // Get wallet balance
    const wallet = await Wallet.findOne({ owner: card.owner });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        balance: wallet.balance,
        cardStatus: card.status,
        expiryDate: card.expiryDate,
        lastUsed: card.lastUsed
      }
    });
  } catch (error) {
    next(error);
  }
};