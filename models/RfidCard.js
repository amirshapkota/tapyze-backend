import mongoose from 'mongoose';

const rfidCardSchema = new mongoose.Schema({
  cardUid: {
    type: String,
    required: [true, 'RFID card UID is required'],
    unique: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'LOST', 'EXPIRED', 'PENDING_ACTIVATION'],
    default: 'PENDING_ACTIVATION'
  }
});

const RfidCard = mongoose.model('RfidCard', rfidCardSchema);
export default RfidCard;