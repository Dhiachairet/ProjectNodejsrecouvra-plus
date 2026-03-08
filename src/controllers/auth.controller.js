import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { validateRegister, validateLogin } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export async function register(req, res, next) {
  try {
    // Validate input
    const { error } = validateRegister.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const { email, password, firstName, lastName, role } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return sendError(res, 400, 'User already exists');
    }
    
    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: role || 'agent'
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    sendJson(res, 201, {
      success: true,
      token,
      user
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export async function login(req, res, next) {
  try {
    // Validate input
    const { error } = validateLogin.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const { email, password } = req.body;
    
    // Check for user (explicitly select password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    // Check if user is active
    if (!user.active) {
      return sendError(res, 401, 'User account is deactivated. Please contact admin.');
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    sendJson(res, 200, {
      success: true,
      token,
      user
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export async function getMe(req, res, next) {
  try {
    // User is already attached to req by protect middleware
    sendJson(res, 200, {
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
}