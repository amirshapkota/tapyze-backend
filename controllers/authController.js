import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import Wallet from '../models/Wallet.js';
import Admin from '../models/Admin.js';

// Helper function to create JWT
const signToken = (id, type) => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Helper function to send token response
const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id, user.constructor.modelName);
  
  res.status(statusCode).json({
    status: 'success',
    message,
    token,
    data: {
      user
    }
  });
};

// Helper function to create wallet for new users
const createWallet = async (owner, ownerType) => {
  return await Wallet.create({
    owner: owner._id,
    ownerType
  });
};

// CUSTOMER SIGNUP
export const customerSignup = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      gender,
      password,
      confirmPassword
    } = req.body;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Check if user already exists
    const existingCustomer = await Customer.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingCustomer) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email or phone already exists'
      });
    }
    
    // Create customer
    const customer = await Customer.create({
      fullName,
      email,
      phone,
      gender,
      password
    });
    
    // Create wallet for customer
    await createWallet(customer, 'Customer');
    
    createSendToken(customer, 201, res, 'Account created successfully');
  } catch (error) {
    next(error);
  }
};

// CUSTOMER LOGIN
export const customerLogin = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    
    // Check if email/phone and password exist
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email/phone and password'
      });
    }
    
    // Check if customer exists
    const customer = await Customer.findOne({
      $or: [{ email }, { phone }]
    }).select('+password');
    
    if (!customer || !(await customer.correctPassword(password, customer.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect credentials'
      });
    }
    
    createSendToken(customer, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// MERCHANT SIGNUP
export const merchantSignup = async (req, res, next) => {
  try {
    const {
      businessName,
      ownerName,
      email,
      phone,
      businessAddress,
      businessType,
      password,
      confirmPassword
    } = req.body;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Check if merchant already exists
    const existingMerchant = await Merchant.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingMerchant) {
      return res.status(400).json({
        status: 'error',
        message: 'Merchant with this email or phone already exists'
      });
    }
    
    // Create merchant
    const merchant = await Merchant.create({
      businessName,
      ownerName,
      email,
      phone,
      businessAddress,
      businessType,
      password
    });
    
    // Create wallet for merchant
    await createWallet(merchant, 'Merchant');
    
    createSendToken(merchant, 201, res, 'Merchant account created successfully');
  } catch (error) {
    next(error);
  }
};

// MERCHANT LOGIN
export const merchantLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }
    
    // Check if merchant exists
    const merchant = await Merchant.findOne({ email }).select('+password');
    
    if (!merchant || !(await merchant.correctPassword(password, merchant.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }
    
    createSendToken(merchant, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// ADMIN LOGIN
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }
    
    // Check if admin exists
    const admin = await Admin.findOne({ email }).select('+password');
    
    if (!admin || !(await admin.correctPassword(password, admin.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }
    
    createSendToken(admin, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// SETUP FIRST ADMIN (one-time setup)
export const setupFirstAdmin = async (req, res, next) => {
  try {
    // Check if any admins already exist
    const adminCount = await Admin.countDocuments();
    
    if (adminCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Admin accounts already exist. Cannot use this endpoint.'
      });
    }
    
    const {
      fullName,
      email,
      password,
      confirmPassword
    } = req.body;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all required fields'
      });
    }
    
    // Create first admin as SUPER_ADMIN
    const admin = await Admin.create({
      fullName,
      email,
      password,
      role: 'SUPER_ADMIN'
    });
    
    createSendToken(admin, 201, res, 'First admin account created successfully');
  } catch (error) {
    next(error);
  }
};