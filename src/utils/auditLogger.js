/**
 * Audit Logger Utility
 * Handles logging of administrative actions for compliance and tracking
 */

class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs in memory
  }

  /**
   * Log an audit event
   * @param {Object} event - The audit event details
   * @param {string} event.action - Action performed (CREATE, UPDATE, DELETE, etc.)
   * @param {string} event.resource - Resource type (ITEM, USER, etc.)
   * @param {string} event.resourceId - ID of the affected resource
   * @param {string} event.userId - ID of the user performing the action
   * @param {string} event.userEmail - Email of the user performing the action
   * @param {Object} event.details - Additional details about the action
   * @param {Object} [event.oldValues] - Previous values (for updates)
   * @param {Object} [event.newValues] - New values (for creates/updates)
   */
  log(event) {
    const auditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      userId: event.userId,
      userEmail: event.userEmail,
      details: event.details || {},
      oldValues: event.oldValues,
      newValues: event.newValues,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    };

    // Add to memory storage
    this.logs.unshift(auditEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Send to backend for persistent storage
    this.sendToBackend(auditEntry);

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Audit Log:', auditEntry);
    }

    return auditEntry;
  }

  /**
   * Log item-specific actions
   */
  logItemAction(action, itemId, userId, userEmail, details = {}, oldValues = null, newValues = null) {
    return this.log({
      action,
      resource: 'ITEM',
      resourceId: itemId,
      userId,
      userEmail,
      details,
      oldValues,
      newValues
    });
  }

  /**
   * Log bulk operations
   */
  logBulkAction(action, resourceType, resourceIds, userId, userEmail, details = {}) {
    return this.log({
      action: `BULK_${action}`,
      resource: resourceType,
      resourceId: resourceIds.join(','),
      userId,
      userEmail,
      details: {
        ...details,
        count: resourceIds.length,
        affectedIds: resourceIds
      }
    });
  }

  /**
   * Get recent logs
   * @param {number} limit - Number of logs to retrieve
   * @param {Object} filters - Optional filters
   */
  getLogs(limit = 50, filters = {}) {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    
    if (filters.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
    }
    
    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }
    
    if (filters.resourceId) {
      filteredLogs = filteredLogs.filter(log => log.resourceId === filters.resourceId);
    }
    
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= fromDate);
    }
    
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= toDate);
    }

    return filteredLogs.slice(0, limit);
  }

  /**
   * Send audit log to backend for persistent storage
   */
  async sendToBackend(auditEntry) {
    try {
      const response = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(auditEntry)
      });

      if (!response.ok) {
        console.error('Failed to send audit log to backend:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending audit log:', error);
      // Store failed logs for retry
      this.storeFailedLog(auditEntry);
    }
  }

  /**
   * Store failed logs in localStorage for retry
   */
  storeFailedLog(auditEntry) {
    try {
      const failedLogs = JSON.parse(localStorage.getItem('failedAuditLogs') || '[]');
      failedLogs.push(auditEntry);
      
      // Keep only last 100 failed logs
      const trimmedLogs = failedLogs.slice(-100);
      localStorage.setItem('failedAuditLogs', JSON.stringify(trimmedLogs));
    } catch (error) {
      console.error('Failed to store failed audit log:', error);
    }
  }

  /**
   * Retry failed logs
   */
  async retryFailedLogs() {
    try {
      const failedLogs = JSON.parse(localStorage.getItem('failedAuditLogs') || '[]');
      
      if (failedLogs.length === 0) {
        return;
      }

      const retryPromises = failedLogs.map(log => this.sendToBackend(log));
      await Promise.allSettled(retryPromises);
      
      // Clear failed logs after retry attempt
      localStorage.removeItem('failedAuditLogs');
    } catch (error) {
      console.error('Error retrying failed logs:', error);
    }
  }

  /**
   * Generate unique ID for audit entries
   */
  generateId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP address (best effort)
   */
  getClientIP() {
    // This is limited in browser environment
    // In a real implementation, this would be handled server-side
    return 'client';
  }

  /**
   * Get user agent
   */
  getUserAgent() {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  /**
   * Get authentication token
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  /**
   * Export logs as CSV
   */
  exportLogsAsCSV(logs = null) {
    const logsToExport = logs || this.logs;
    
    if (logsToExport.length === 0) {
      return '';
    }

    const headers = [
      'Timestamp',
      'Action',
      'Resource',
      'Resource ID',
      'User Email',
      'Details',
      'IP Address'
    ];

    const csvContent = [
      headers.join(','),
      ...logsToExport.map(log => [
        log.timestamp,
        log.action,
        log.resource,
        log.resourceId,
        log.userEmail,
        JSON.stringify(log.details).replace(/"/g, '""'),
        log.ipAddress
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Download logs as CSV file
   */
  downloadLogsAsCSV(filename = null) {
    const csv = this.exportLogsAsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Clear all logs (use with caution)
   */
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('failedAuditLogs');
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

// Common audit actions constants
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_CREATE: 'BULK_CREATE',
  BULK_UPDATE: 'BULK_UPDATE',
  BULK_DELETE: 'BULK_DELETE',
  VIEW: 'VIEW',
  SEARCH: 'SEARCH',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  UPLOAD: 'UPLOAD'
};

// Resource types constants
export const RESOURCE_TYPES = {
  ITEM: 'ITEM',
  USER: 'USER',
  CATEGORY: 'CATEGORY',
  ORDER: 'ORDER',
  INVENTORY: 'INVENTORY'
};

// Helper functions for common item operations
export const itemAuditHelpers = {
  logItemCreate: (item, userId, userEmail) => {
    return auditLogger.logItemAction(
      AUDIT_ACTIONS.CREATE,
      item.id,
      userId,
      userEmail,
      { itemName: item.name, category: item.category },
      null,
      item
    );
  },

  logItemUpdate: (itemId, oldValues, newValues, userId, userEmail) => {
    return auditLogger.logItemAction(
      AUDIT_ACTIONS.UPDATE,
      itemId,
      userId,
      userEmail,
      { 
        itemName: newValues.name || oldValues.name,
        changedFields: Object.keys(newValues)
      },
      oldValues,
      newValues
    );
  },

  logItemDelete: (item, userId, userEmail) => {
    return auditLogger.logItemAction(
      AUDIT_ACTIONS.DELETE,
      item.id,
      userId,
      userEmail,
      { itemName: item.name, category: item.category },
      item,
      null
    );
  },

  logBulkItemDelete: (items, userId, userEmail) => {
    return auditLogger.logBulkAction(
      AUDIT_ACTIONS.DELETE,
      RESOURCE_TYPES.ITEM,
      items.map(item => item.id),
      userId,
      userEmail,
      { 
        itemNames: items.map(item => item.name),
        categories: [...new Set(items.map(item => item.category))]
      }
    );
  }
};

export default auditLogger;