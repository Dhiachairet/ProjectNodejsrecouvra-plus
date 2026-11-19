import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { emailValidator } from '../utils/email.js';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: emailValidator
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['agent', 'manager', 'admin'],
    default: 'agent'
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});


userSchema.pre('save', async function(next) {

  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});


userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  }
});


userSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  }
});

export const User = mongoose.model('User', userSchema);