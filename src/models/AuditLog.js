const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'VIEW']
  },
  resource: {
    type: String,
    required: true,
    enum: ['ITEM', 'USER', 'ORDER', 'CATEGORY']
  },
  resourceId: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'WARNING'],
    default: 'SUCCESS'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Static method to create audit log entry
auditLogSchema.statics.createLog = async function(logData) {
  try {
    const auditLog = new this(logData);
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent breaking main operations
    return null;
  }
};

// Static method to get logs with pagination
auditLogSchema.statics.getLogs = async function(filters = {}, options = {}) {
  const {
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = -1
  } = options;

  const skip = (page - 1) * limit;

  const query = {};
  
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.resource) query.resource = filters.resource;
  if (filters.resourceId) query.resourceId = filters.resourceId;
  if (filters.status) query.status = filters.status;
  
  if (filters.dateFrom || filters.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) query.timestamp.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.timestamp.$lte = new Date(filters.dateTo);
  }

  const [logs, total] = await Promise.all([
    this.find(query)
      .populate('userId', 'username email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};

// Helper method to format log for display
auditLogSchema.methods.getDisplayMessage = function() {
  const actionMessages = {
    CREATE: `Created ${this.resource.toLowerCase()}`,
    UPDATE: `Updated ${this.resource.toLowerCase()}`,
    DELETE: `Deleted ${this.resource.toLowerCase()}`,
    VIEW: `Viewed ${this.resource.toLowerCase()}`
  };

  const baseMessage = actionMessages[this.action] || this.action;
  return `${baseMessage} (ID: ${this.resourceId})`;
};

// Middleware to automatically populate user info
auditLogSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'userId',
    select: 'username email'
  });
  next();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;