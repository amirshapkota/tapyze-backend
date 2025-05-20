import mongoose from 'mongoose';

const nfcScannerSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: [true, 'Scanner device ID is required'],
    unique: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  model: {
    type: String,
    required: [true, 'Scanner model is required']
  },
  lastConnected: {
    type: Date
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  firmwareVersion: {
    type: String
  },
  status: {
    type: String,
    enum: ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'PENDING_ACTIVATION'],
    default: 'PENDING_ACTIVATION'
  }
});

const NfcScanner = mongoose.model('NfcScanner', nfcScannerSchema);
export default NfcScanner;