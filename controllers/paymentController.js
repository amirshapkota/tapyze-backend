import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import RfidCard from '../models/RfidCard.js';
import NfcScanner from '../models/NfcScanner.js';
import mongoose from 'mongoose';

export const processRfidPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { cardUid, amount, description } = req.body;
    const merchantId = req.user.id;
    
    // Verify amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid amount'
      });
    }
    
    // Find the merchant wallet
    const merchantWallet = await Wallet.findOne({
      owner: merchantId,
      ownerType: 'Merchant'
    }).session(session);
    
    if (!merchantWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Merchant wallet not found'
      });
    }
    
    // Find the RFID card
    const card = await RfidCard.findOne({
      cardUid,
      isActive: true,
      status: 'ACTIVE'
    }).session(session);
    
    if (!card) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Invalid or inactive RFID card'
      });
    }
    
    // Check if card is expired
    if (card.expiryDate < new Date()) {
      card.isActive = false;
      card.status = 'EXPIRED';
      await card.save({ session });
      
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'RFID card has expired'
      });
    }
    
    // Find the customer wallet
    const customerWallet = await Wallet.findOne({
      owner: card.owner,
      ownerType: 'Customer'
    }).session(session);
    
    if (!customerWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: 'error',
        message: 'Customer wallet not found'
      });
    }
    
    // Check sufficient balance
    if (customerWallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient funds in customer wallet'
      });
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
        cardUid: cardUid
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
          id: card.owner,
          type: 'Customer'
        },
        cardUid: cardUid
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
    card.lastUsed = new Date();
    await card.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Payment processed successfully',
      data: {
        amount,
        merchantBalance: merchantWallet.balance,
        transactionReference: reference
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Endpoint to verify card before payment (optional)
export const verifyRfidCard = async (req, res, next) => {
  try {
    const { cardUid } = req.params;
    
    const card = await RfidCard.findOne({
      cardUid,
      isActive: true,
      status: 'ACTIVE'
    });
    
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
    
    // Get wallet balance without exposing sensitive information
    const wallet = await Wallet.findOne({
      owner: card.owner,
      ownerType: 'Customer'
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        cardStatus: 'VALID',
        balance: wallet ? wallet.balance : null,
        currency: wallet ? wallet.currency : null
      }
    });
  } catch (error) {
    next(error);
  }
};