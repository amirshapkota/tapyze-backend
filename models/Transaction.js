import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required']
  },
  type: {
    type: String,
    required: true,
    enum: ['CREDIT', 'DEBIT', 'TRANSFER']
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'COMPLETED'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate a unique reference before saving
transactionSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;