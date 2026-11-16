import mongoose from 'mongoose';
import { ACTION_STATUSES, allowedTransitions } from '../workflows/collectionAction.workflow.js';

const statusChangeSchema = new mongoose.Schema({
  from: { type: String, enum: ACTION_STATUSES },
  to: { type: String, enum: ACTION_STATUSES, required: true },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: { type: Date, default: Date.now },
  note: String
}, { _id: false });

const collectionActionSchema = new mongoose.Schema({
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  actionType: {
    type: String,
    enum: ['phone_call', 'email', 'meeting', 'reminder_letter', 'legal_notice', 'visit'],
    required: true,
    index: true
  },
  actionDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ACTION_STATUSES,
    default: 'planned',
    index: true
  },
  statusHistory: [statusChangeSchema],
  notes: {
    type: String,
    trim: true
  },
  result: {
    type: String,
    trim: true
  },
  nextActionDate: {
    type: Date,
    index: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  contactPerson: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, 
    min: 0
  },
  legalReference: String,
  legalDocument: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

collectionActionSchema.virtual('isNextActionOverdue').get(function() {
  return this.nextActionDate && this.nextActionDate < new Date() && this.status !== 'completed';
});

collectionActionSchema.virtual('allowedTransitions').get(function() {
  return allowedTransitions(this.status);
});

collectionActionSchema.virtual('actionTypeLabel').get(function() {
  const labels = {
    phone_call: 'Phone call',
    email: 'Email',
    meeting: 'Meeting',
    reminder_letter: 'Reminder letter',
    legal_notice: 'Formal notice',
    visit: 'On-site visit'
  };
  return labels[this.actionType] || this.actionType;
});

collectionActionSchema.index({ client: 1, actionDate: -1 });
collectionActionSchema.index({ invoice: 1, actionDate: -1 });
collectionActionSchema.index({ performedBy: 1, actionDate: -1 });

export const CollectionAction = mongoose.model('CollectionAction', collectionActionSchema);