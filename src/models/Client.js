import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'France' }
  },
  company: {
    type: String,
    trim: true,
    index: true
  },
  taxId: {
    type: String,
    trim: true,
    sparse: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // N-N: a client is followed by several agents, an agent follows several clients
  assignedAgents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  totalInvoices: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  totalUnpaid: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

clientSchema.virtual('fullAddress').get(function() {
  const parts = [];
  if (this.address.street) parts.push(this.address.street);
  if (this.address.city) parts.push(this.address.city);
  if (this.address.postalCode) parts.push(this.address.postalCode);
  if (this.address.country) parts.push(this.address.country);
  return parts.join(', ');
});


clientSchema.virtual('outstandingBalance').get(function() {
  return this.totalUnpaid;
});


clientSchema.index({ name: 'text', company: 'text', email: 'text' });

export const Client = mongoose.model('Client', clientSchema);