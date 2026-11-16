import mongoose from 'mongoose';

// Append-only trail of sensitive actions: who did what, on which record, when and from where.
const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userEmail: String,
  role: String,
  action: {
    type: String,
    required: true,
    index: true
  },
  entity: {
    type: String,
    enum: ['User', 'Client', 'Invoice', 'CollectionAction'],
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
