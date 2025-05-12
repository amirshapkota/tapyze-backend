import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
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
    const { recipientId, recipientType, amount, description } = req.body;
    const senderId = req.user.id;
    const senderType = req.user.type;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid amount'
      });
    }
    
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
    
    // Find recipient wallet
    const recipientWallet = await Wallet.findOne({
      owner: recipientId,
      ownerType: recipientType
    }).session(session);
    
    if (!recipientWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Recipient wallet not found'
      });
    }
    
    // Generate a unique reference for this transfer
    const reference = `TRF${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Create sender transaction (debit)
    const senderTransaction = await Transaction.create([{
      wallet: senderWallet._id,
      amount: -amount, // Negative for debit
      type: 'DEBIT',
      description: description || 'Fund transfer',
      reference: `${reference}-SEND`,
      metadata: {
        transferType: 'OUTGOING',
        recipient: {
          id: recipientId,
          type: recipientType
        }
      }
    }], { session });
    
    // Create recipient transaction (credit)
    const recipientTransaction = await Transaction.create([{
      wallet: recipientWallet._id,
      amount,
      type: 'CREDIT',
      description: description || 'Fund transfer',
      reference: `${reference}-RECV`,
      metadata: {
        transferType: 'INCOMING',
        sender: {
          id: senderId,
          type: senderType
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