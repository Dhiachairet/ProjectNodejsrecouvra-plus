import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative']
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'check', 'credit_card', 'other'],
    required: true
  },
  reference: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.01, 'Quantity must be at least 0.01']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'],
    default: 'unpaid',
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  items: [invoiceItemSchema],
  payments: [paymentSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cancelledAt: Date,
  cancelledReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for remaining amount
invoiceSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.paidAmount;
});

// Virtual for payment status percentage
invoiceSchema.virtual('paymentPercentage').get(function() {
  if (this.amount === 0) return 100;
  return (this.paidAmount / this.amount) * 100;
});

// Virtual for isOverdue
invoiceSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status !== 'paid' && this.status !== 'cancelled';
});

// Pre-save middleware to auto-calculate status
invoiceSchema.pre('save', function(next) {
  // Don't recalculate if cancelled
  if (this.status === 'cancelled') {
    return next();
  }
  
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partially_paid';
  } else if (this.dueDate < new Date()) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  next();
});

// Post-save middleware to update client statistics
invoiceSchema.post('save', async function(doc) {
  try {
    const Client = mongoose.model('Client');
    const stats = await mongoose.model('Invoice').aggregate([
      { $match: { client: doc.client, status: { $ne: 'cancelled' } } },
      { $group: {
        _id: '$client',
        totalInvoices: { $sum: 1 },
        totalPaid: { $sum: '$paidAmount' },
        totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } }
      }}
    ]);
    
    if (stats.length > 0) {
      await Client.findByIdAndUpdate(doc.client, {
        totalInvoices: stats[0].totalInvoices,
        totalPaid: stats[0].totalPaid,
        totalUnpaid: stats[0].totalUnpaid
      });
    }
  } catch (error) {
    console.error('Error updating client stats:', error);
  }
});

// Index for efficient queries
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);