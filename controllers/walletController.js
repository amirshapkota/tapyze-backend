import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import mongoose from 'mongoose';

// Get wallet balance
export const getWalletBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    
    const wallet = await Wallet.findOne({
      owner: userId,
      ownerType: userType
    });
    
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
        currency: wallet.currency
      }
    });
  } catch (error) {
    next(error);
  }
};

// Find user by phone number
export const findUserByPhone = async (req, res, next) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    // Clean phone number (remove +977- prefix if present)
    const cleanPhone = phone.replace(/^\+977-?/, '');
    
    // Search in customers first
    let user = await Customer.findOne({ 
      $or: [
        { phone: cleanPhone },
        { phone: `+977-${cleanPhone}` },
        { phone: phone }
      ]
    }).select('fullName phone email');
    
    let userType = 'Customer';
    
    // If not found in customers, search in merchants
    if (!user) {
      user = await Merchant.findOne({ 
        $or: [
          { phone: cleanPhone },
          { phone: `+977-${cleanPhone}` },
          { phone: phone }
        ]
      }).select('businessName phone email');
      userType = 'Merchant';
    }
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found with this phone number'
      });
    }
    
    // Check if user has an active wallet
    const wallet = await Wallet.findOne({
      owner: user._id,
      ownerType: userType,
      isActive: true
    });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'User wallet not found or inactive'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.fullName || user.businessName,
          phone: user.phone,
          type: userType,
          hasActiveWallet: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Top up wallet (add funds)
export const topUpWallet = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid amount'
      });
    }
    
    // Minimum top-up amount
    if (amount < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum top-up amount is Rs. 10'
      });
    }
    
    const wallet = await Wallet.findOne({ 
      owner: userId,
      ownerType: userType
    }).session(session);
    
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }
    
    // Create transaction record
    const transaction = await Transaction.create([{
      wallet: wallet._id,
      amount,
      type: 'CREDIT',
      description: 'Wallet top-up',
      status: 'COMPLETED',
      metadata: {
        method: 'DIRECT', // Could be payment gateway in real impl
        initiatedBy: userId
      }
    }], { session });
    
    // Update wallet balance
    wallet.balance += amount;
    wallet.transactions.push(transaction[0]._id);
    await wallet.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Wallet topped up successfully',
      data: {
        balance: wallet.balance,
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Transfer funds to another wallet
export const transferFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { recipientPhone, recipientType, amount, description } = req.body;
    const senderId = req.user.id;
    const senderType = req.user.type;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid amount'
      });
    }
    
    if (amount < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum transfer amount is Rs. 10'
      });
    }
    
    if (!recipientPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient phone number is required'
      });
    }
    
    // Clean phone number
    const cleanPhone = recipientPhone.replace(/^\+977-?/, '');
    
    // Find sender wallet
    const senderWallet = await Wallet.findOne({
      owner: senderId,
      ownerType: senderType
    }).session(session);
    
    if (!senderWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Sender wallet not found'
      });
    }
    
    // Check sufficient balance
    if (senderWallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient funds'
      });
    }
    
    // Find recipient by phone number
    let recipient;
    let actualRecipientType = recipientType || 'Customer';
    
    if (actualRecipientType === 'Customer' || actualRecipientType === 'USER') {
      recipient = await Customer.findOne({ 
        $or: [
          { phone: cleanPhone },
          { phone: `+977-${cleanPhone}` },
          { phone: recipientPhone }
        ]
      }).session(session);
      actualRecipientType = 'Customer';
    } else {
      recipient = await Merchant.findOne({ 
        $or: [
          { phone: cleanPhone },
          { phone: `+977-${cleanPhone}` },
          { phone: recipientPhone }
        ]
      }).session(session);
      actualRecipientType = 'Merchant';
    }
    
    // If not found in specified type, try the other type
    if (!recipient) {
      if (actualRecipientType === 'Customer') {
        recipient = await Merchant.findOne({ 
          $or: [
            { phone: cleanPhone },
            { phone: `+977-${cleanPhone}` },
            { phone: recipientPhone }
          ]
        }).session(session);
        actualRecipientType = 'Merchant';
      } else {
        recipient = await Customer.findOne({ 
          $or: [
            { phone: cleanPhone },
            { phone: `+977-${cleanPhone}` },
            { phone: recipientPhone }
          ]
        }).session(session);
        actualRecipientType = 'Customer';
      }
    }
    
    if (!recipient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Recipient not found with this phone number'
      });
    }
    
    // Check if sender is trying to send to themselves
    if (recipient._id.toString() === senderId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'Cannot transfer funds to yourself'
      });
    }
    
    // Find recipient wallet
    const recipientWallet = await Wallet.findOne({
      owner: recipient._id,
      ownerType: actualRecipientType
    }).session(session);
    
    if (!recipientWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Recipient wallet not found'
      });
    }
    
    if (!recipientWallet.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'Recipient wallet is inactive'
      });
    }
    
    // Generate a unique reference for this transfer
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const reference = `TRF${timestamp}${randomNum}`;
    
    // Create sender transaction (debit)
    const senderTransaction = await Transaction.create([{
      wallet: senderWallet._id,
      amount: -amount, // Negative for debit
      type: 'DEBIT',
      description: description || `Transfer to ${recipient.fullName || recipient.businessName}`,
      reference: `${reference}-OUT`,
      status: 'COMPLETED',
      metadata: {
        transferType: 'OUTGOING',
        recipient: {
          id: recipient._id,
          type: actualRecipientType,
          name: recipient.fullName || recipient.businessName,
          phone: recipient.phone
        }
      }
    }], { session });
    
    // Create recipient transaction (credit)
    const recipientTransaction = await Transaction.create([{
      wallet: recipientWallet._id,
      amount,
      type: 'CREDIT',
      description: description || `Transfer from ${req.user.fullName || req.user.businessName}`,
      reference: `${reference}-IN`,
      status: 'COMPLETED',
      metadata: {
        transferType: 'INCOMING',
        sender: {
          id: senderId,
          type: senderType,
          name: req.user.fullName || req.user.businessName,
          phone: req.user.phone
        }
      }
    }], { session });
    
    // Update sender wallet
    senderWallet.balance -= amount;
    senderWallet.transactions.push(senderTransaction[0]._id);
    await senderWallet.save({ session });
    
    // Update recipient wallet
    recipientWallet.balance += amount;
    recipientWallet.transactions.push(recipientTransaction[0]._id);
    await recipientWallet.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Funds transferred successfully',
      data: {
        senderBalance: senderWallet.balance,
        recipient: {
          name: recipient.fullName || recipient.businessName,
          phone: recipient.phone,
          type: actualRecipientType
        },
        transaction: senderTransaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Get transaction history
export const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    
    const wallet = await Wallet.findOne({
      owner: userId,
      ownerType: userType
    });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({
      wallet: wallet._id
    })
    .sort({ createdAt: -1 }) // Latest first
    .skip(skip)
    .limit(limit);
    
    const total = await Transaction.countDocuments({ wallet: wallet._id });
    
    res.status(200).json({
      status: 'success',
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