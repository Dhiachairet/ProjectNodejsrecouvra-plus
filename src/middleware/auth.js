import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { sendError } from '../utils/send.js';

export async function protect(req, res, next) {
  try {
    let token;
    
    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return sendError(res, 401, 'Not authorized, no token');
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return sendError(res, 401, 'User not found');
      }
      
      // Check if user is active
      if (!req.user.active) {
        return sendError(res, 401, 'User account is deactivated');
      }
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return sendError(res, 401, 'Invalid token');
      }
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 401, 'Token expired');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
}