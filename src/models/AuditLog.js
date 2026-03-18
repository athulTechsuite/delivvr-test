const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Reference to the item that was modified
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Reference to the admin user who made the change
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Type of operation performed
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE', 'BULK_DELETE'],
    required: true
  },
  
  // Entity type being modified
  entityType: {
    type: String,
    default: 'Product'
  },
  
  // Previous state of the item (before change)
  previousData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // New state of the item (after change)
  newData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Changes made (field-by-field diff)
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  
  // IP address of the admin user
  ipAddress: {
    type: String,
    default: null
  },
  
  // User agent of the admin user
  userAgent: {
    type: String,
    default: null
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Reason for the change (optional)
  reason: {
    type: String,
    default: null
  },
  
  // Bulk operation details (if applicable)
  bulkOperation: {
    affectedItems: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    criteria: mongoose.Schema.Types.Mixed,
    totalAffected: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ itemId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, action: 1 });

// Static method to log an audit entry
auditLogSchema.statics.logAction = async function(data) {
  try {
    const auditEntry = new this(data);
    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    console.error('Error creating audit log entry:', error);
    // Don't throw error to prevent disrupting main operations
    return null;
  }
};

// Static method to get audit trail for a specific item
auditLogSchema.statics.getItemHistory = async function(itemId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  return this.find({ itemId })
    .populate('userId', 'username email firstName lastName')
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get audit trail for a specific user
auditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    startDate,
    endDate,
    actions
  } = options;
  
  const query = { userId };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  if (actions && actions.length > 0) {
    query.action = { $in: actions };
  }
  
  return this.find(query)
    .populate('itemId', 'name description')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get audit statistics
auditLogSchema.statics.getActivityStats = async function(options = {}) {
  const {
    startDate,
    endDate,
    userId
  } = options;
  
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  if (userId) {
    matchStage.userId = new mongoose.Types.ObjectId(userId);
  }
  
  const pipeline = [];
  
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  pipeline.push({
    $group: {
      _id: '$action',
      count: { $sum: 1 },
      users: { $addToSet: '$userId' }
    }
  });
  
  pipeline.push({
    $project: {
      action: '$_id',
      count: 1,
      uniqueUsers: { $size: '$users' },
      _id: 0
    }
  });
  
  return this.aggregate(pipeline);
};

// Instance method to get formatted change summary
auditLogSchema.methods.getChangeSummary = function() {
  if (!this.changes || this.changes.length === 0) {
    return 'No specific changes recorded';
  }
  
  return this.changes.map(change => {
    const oldVal = change.oldValue !== null && change.oldValue !== undefined 
      ? String(change.oldValue) : 'empty';
    const newVal = change.newValue !== null && change.newValue !== undefined 
      ? String(change.newValue) : 'empty';
    return `${change.field}: ${oldVal} → ${newVal}`;
  }).join(', ');
};

// Instance method to check if this is a bulk operation
auditLogSchema.methods.isBulkOperation = function() {
  return ['BULK_UPDATE', 'BULK_DELETE'].includes(this.action);
};

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.createdAt.toLocaleString();
});

// Virtual for action description
auditLogSchema.virtual('actionDescription').get(function() {
  const descriptions = {
    'CREATE': 'Created item',
    'UPDATE': 'Updated item',
    'DELETE': 'Deleted item',
    'BULK_UPDATE': 'Bulk updated items',
    'BULK_DELETE': 'Bulk deleted items'
  };
  return descriptions[this.action] || this.action;
});

// Ensure virtuals are included in JSON output
auditLogSchema.set('toJSON', { virtuals: true });
auditLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);