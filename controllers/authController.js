import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import Wallet from '../models/Wallet.js';
import Admin from '../models/Admin.js';
import { sendEmail } from '../utils/email.js'; // You'll need to create this utility

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

// CREATE ADDITIONAL ADMIN (Only existing admins can do this)
export const createAdmin = async (req, res, next) => {
  try {
    // Check if the request is coming from an admin
    if (req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only existing admins can create new admin accounts'
      });
    }
    
    const {
      fullName,
      email,
      password,
      confirmPassword,
      role = 'ADMIN' // Default role is ADMIN
    } = req.body;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Check if user already exists
    const existingAdmin = await Admin.findOne({ email });
    
    if (existingAdmin) {
      return res.status(400).json({
        status: 'error',
        message: 'Admin with this email already exists'
      });
    }
    
    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Extra check: Only SUPER_ADMINs can create other SUPER_ADMINs
    const currentAdmin = await Admin.findById(req.user.id);
    if (role === 'SUPER_ADMIN' && currentAdmin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        status: 'error',
        message: 'Only SUPER_ADMINs can create other SUPER_ADMINs'
      });
    }
    
    // Create admin
    const admin = await Admin.create({
      fullName,
      email,
      password,
      role
    });
    
    // Don't send back the password
    admin.password = undefined;
    
    res.status(201).json({
      status: 'success',
      message: 'Admin account created successfully',
      data: {
        admin
      }
    });
  } catch (error) {
    next(error);
  }
};

// FORGOT PASSWORD - CUSTOMER
export const customerForgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide your email address'
      });
    }
    
    // Get customer based on email
    const customer = await Customer.findOne({ email });
    
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'No customer found with that email address'
      });
    }
    
    // Generate the random reset code
    const resetCode = customer.createPasswordResetCode();
    await customer.save({ validateBeforeSave: false });
    
    // Send it to customer's email using template
    try {
      await sendEmail({
        email: customer.email,
        template: 'passwordReset',
        name: customer.fullName,
        code: resetCode
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Reset code sent to your email!'
      });
    } catch (err) {
      customer.passwordResetCode = undefined;
      customer.passwordResetExpires = undefined;
      await customer.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        status: 'error',
        message: 'There was an error sending the email. Try again later.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// VERIFY RESET CODE - CUSTOMER
export const customerVerifyResetCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide the reset code'
      });
    }
    
    // Hash the provided code to compare with stored hash
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find customer with matching code and valid expiry
    const customer = await Customer.findOne({
      passwordResetCode: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!customer) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset code is invalid or has expired'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Reset code verified successfully',
      data: {
        email: customer.email,
        verified: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// VERIFY RESET CODE & RESET PASSWORD - CUSTOMER
export const customerResetPassword = async (req, res, next) => {
  try {
    const { code, password, confirmPassword } = req.body;
    
    if (!code || !password || !confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide reset code, password and confirm password'
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Hash the provided code to compare with stored hash
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find customer with matching code and valid expiry
    const customer = await Customer.findOne({
      passwordResetCode: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!customer) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset code is invalid or has expired'
      });
    }
    
    // Set new password and clear reset fields
    customer.password = password;
    customer.passwordResetCode = undefined;
    customer.passwordResetExpires = undefined;
    await customer.save();
    
    // Log the customer in, send JWT
    createSendToken(customer, 200, res, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};

// FORGOT PASSWORD - MERCHANT
export const merchantForgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide your email address'
      });
    }
    
    // Get merchant based on email
    const merchant = await Merchant.findOne({ email });
    
    if (!merchant) {
      return res.status(404).json({
        status: 'error',
        message: 'No merchant found with that email address'
      });
    }
    
    // Generate the random reset code
    const resetCode = merchant.createPasswordResetCode();
    await merchant.save({ validateBeforeSave: false });
    
    // Send it to merchant's email using template
    try {
      await sendEmail({
        email: merchant.email,
        template: 'merchantPasswordReset',
        ownerName: merchant.ownerName,
        businessName: merchant.businessName,
        code: resetCode
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Reset code sent to your email!'
      });
    } catch (err) {
      merchant.passwordResetCode = undefined;
      merchant.passwordResetExpires = undefined;
      await merchant.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        status: 'error',
        message: 'There was an error sending the email. Try again later.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// VERIFY RESET CODE - MERCHANT
export const merchantVerifyResetCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide the reset code'
      });
    }
    
    // Hash the provided code to compare with stored hash
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find merchant with matching code and valid expiry
    const merchant = await Merchant.findOne({
      passwordResetCode: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!merchant) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset code is invalid or has expired'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Reset code verified successfully',
      data: {
        email: merchant.email,
        verified: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// VERIFY RESET CODE & RESET PASSWORD - MERCHANT
export const merchantResetPassword = async (req, res, next) => {
  try {
    const { code, password, confirmPassword } = req.body;
    
    if (!code || !password || !confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide reset code, password and confirm password'
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }
    
    // Hash the provided code to compare with stored hash
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find merchant with matching code and valid expiry
    const merchant = await Merchant.findOne({
      passwordResetCode: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!merchant) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset code is invalid or has expired'
      });
    }
    
    // Set new password and clear reset fields
    merchant.password = password;
    merchant.passwordResetCode = undefined;
    merchant.passwordResetExpires = undefined;
    await merchant.save();
    
    // Log the merchant in, send JWT
    createSendToken(merchant, 200, res, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};

// CHANGE PASSWORD - CUSTOMER
export const customerChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide current password, new password and confirm new password'
      });
    }
    
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'New passwords do not match'
      });
    }
    
    // Get customer from collection
    const customer = await Customer.findById(req.user.id).select('+password');
    
    // Check if current password is correct
    if (!(await customer.correctPassword(currentPassword, customer.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Your current password is incorrect'
      });
    }
    
    // Update password
    customer.password = newPassword;
    await customer.save();
    
    // Log customer in, send JWT
    createSendToken(customer, 200, res, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

// CHANGE PASSWORD - MERCHANT
export const merchantChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide current password, new password and confirm new password'
      });
    }
    
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'New passwords do not match'
      });
    }
    
    // Get merchant from collection
    const merchant = await Merchant.findById(req.user.id).select('+password');
    
    // Check if current password is correct
    if (!(await merchant.correctPassword(currentPassword, merchant.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Your current password is incorrect'
      });
    }
    
    // Update password
    merchant.password = newPassword;
    await merchant.save();
    
    // Log merchant in, send JWT
    createSendToken(merchant, 200, res, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

// EDIT PROFILE - CUSTOMER
export const customerEditProfile = async (req, res, next) => {
  try {
    const { fullName, phone, gender } = req.body;
    
    // Build update object with only provided fields
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (gender) updateData.gender = gender;
    
    // Check if phone is being updated and already exists
    if (phone) {
      const existingCustomer = await Customer.findOne({ 
        phone, 
        _id: { $ne: req.user.id } 
      });
      
      if (existingCustomer) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number already exists'
        });
      }
    }
    
    // Update customer
    const customer = await Customer.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        customer
      }
    });
  } catch (error) {
    next(error);
  }
};

// EDIT PROFILE - MERCHANT
export const merchantEditProfile = async (req, res, next) => {
  try {
    const { businessName, ownerName, phone, businessAddress, businessType } = req.body;
    
    // Build update object with only provided fields
    const updateData = {};
    if (businessName) updateData.businessName = businessName;
    if (ownerName) updateData.ownerName = ownerName;
    if (phone) updateData.phone = phone;
    if (businessAddress) updateData.businessAddress = businessAddress;
    if (businessType) updateData.businessType = businessType;
    
    // Check if phone is being updated and already exists
    if (phone) {
      const existingMerchant = await Merchant.findOne({ 
        phone, 
        _id: { $ne: req.user.id } 
      });
      
      if (existingMerchant) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number already exists'
        });
      }
    }
    
    // Update merchant
    const merchant = await Merchant.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        merchant
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET PROFILE - CUSTOMER
export const getCustomerProfile = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        customer
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET PROFILE - MERCHANT
export const getMerchantProfile = async (req, res, next) => {
  try {
    const merchant = await Merchant.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        merchant
      }
    });
  } catch (error) {
    next(error);
  }
};