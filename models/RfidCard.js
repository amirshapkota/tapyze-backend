import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  pin: {
    type: String,
    required: [true, 'PIN is required'],
    minlength: [4, 'PIN must be at least 4 digits'],
    maxlength: [6, 'PIN cannot exceed 6 digits'],
    match: [/^\d{4,6}$/, 'PIN must contain only digits'],
    select: false // Don't include PIN in queries by default
  },
  pinAttempts: {
    type: Number,
    default: 0,
    max: [3, 'Maximum 3 PIN attempts allowed']
  },
  pinLockedUntil: {
    type: Date
  },
  lastPinChange: {
    type: Date,
    default: Date.now
  },
  requiresPinChange: {
    type: Boolean,
    default: false
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
    enum: ['ACTIVE', 'INACTIVE', 'LOST', 'EXPIRED', 'PENDING_ACTIVATION', 'PIN_LOCKED'],
    default: 'PENDING_ACTIVATION'
  }
});

// Hash PIN before saving
rfidCardSchema.pre('save', async function(next) {
  if (!this.isModified('pin')) return next();
  
  // Validate PIN format
  if (!/^\d{4,6}$/.test(this.pin)) {
    const error = new Error('PIN must be 4-6 digits');
    error.name = 'ValidationError';
    return next(error);
  }
  
  this.pin = await bcrypt.hash(this.pin, 12);
  this.lastPinChange = new Date();
  next();
});

// Instance method to verify PIN
rfidCardSchema.methods.verifyPin = async function(candidatePin) {
  // Check if card is locked
  if (this.isPinLocked()) {
    throw new Error('Card is temporarily locked due to too many failed attempts');
  }
  
  const isCorrect = await bcrypt.compare(candidatePin, this.pin);
  
  if (!isCorrect) {
    this.pinAttempts += 1;
    if (this.pinAttempts >= 3) {
      this.pinLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      this.status = 'PIN_LOCKED';
    }
    await this.save();
    return false;
  }
  
  // Reset attempts on successful verification
  this.pinAttempts = 0;
  this.pinLockedUntil = undefined;
  if (this.status === 'PIN_LOCKED') {
    this.status = 'ACTIVE';
  }
  this.lastUsed = new Date();
  await this.save();
  
  return true;
};

// Instance method to check if PIN is locked
rfidCardSchema.methods.isPinLocked = function() {
  return this.pinLockedUntil && this.pinLockedUntil > new Date();
};

// Instance method to unlock PIN (admin only)
rfidCardSchema.methods.unlockPin = function() {
  this.pinAttempts = 0;
  this.pinLockedUntil = undefined;
  if (this.status === 'PIN_LOCKED') {
    this.status = 'ACTIVE';
  }
};

// Remove sensitive data from JSON response
rfidCardSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.pin;
  delete obj.pinAttempts;
  delete obj.pinLockedUntil;
  return obj;
};

const RfidCard = mongoose.model('RfidCard', rfidCardSchema);
export default RfidCard;