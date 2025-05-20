import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import Customer from '../models/Customer.js';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';

export const protect = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in. Please log in to get access.'
      });
    }
    
    // Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    let currentUser;
    if (decoded.type === 'Customer') {
      currentUser = await Customer.findById(decoded.id);
    } else if (decoded.type === 'Merchant') {
      currentUser = await Merchant.findById(decoded.id);
    } else if (decoded.type === 'Admin') {
      currentUser = await Admin.findById(decoded.id);
    }
    
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }
    
    // Grant access to protected route
    req.user = {
      id: currentUser._id,
      type: decoded.type
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token or token expired'
    });
  }
};

// Admin restriction middleware
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (req.user.type !== 'Admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  };
};