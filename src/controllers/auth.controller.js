import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { validateRegister, validateLogin } from '../utils/validation.js';
import { sendJson, sendError } from '../utils/send.js';


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

export async function register(req, res, next) {
  try {

    const { error } = validateRegister.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const { email, password, firstName, lastName, role } = req.body;
    
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return sendError(res, 400, 'User already exists');
    }
    
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: role || 'agent'
    });
  
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


export async function login(req, res, next) {
  try {
   
    const { error } = validateLogin.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    const { email, password } = req.body;
    
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    
    if (!user.active) {
      return sendError(res, 401, 'User account is deactivated. Please contact admin.');
    }
    
  
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


export async function getMe(req, res, next) {
  try {
    
    sendJson(res, 200, {
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
}