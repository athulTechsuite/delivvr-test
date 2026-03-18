/**
 * Audit Service
 * Handles logging of administrative actions for audit trail purposes
 */

class AuditService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  }

  /**
   * Log an audit event
   * @param {Object} eventData - The audit event data
   * @param {string} eventData.action - Action performed (CREATE, UPDATE, DELETE, VIEW)
   * @param {string} eventData.resource - Resource type (ITEM, USER, etc.)
   * @param {string} eventData.resourceId - ID of the affected resource
   * @param {Object} eventData.changes - Changes made (for UPDATE actions)
   * @param {Object} eventData.metadata - Additional metadata
   * @returns {Promise<Object>} Response from the audit API
   */
  async logEvent(eventData) {
    try {
      const token = localStorage.getItem('adminToken');
      
      const auditEntry = {
        ...eventData,
        timestamp: new Date().toISOString(),
        userId: this.getCurrentUserId(),
        userAgent: navigator.userAgent,
        ipAddress: await this.getClientIP(),
      };

      const response = await fetch(`${this.baseURL}/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(auditEntry),
      });

      if (!response.ok) {
        throw new Error(`Audit logging failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Log to console but don't fail the main operation
      console.error('Audit logging failed:', error);
      // Optionally store in local storage as fallback
      this.storeLocalAuditLog(eventData);
      return null;
    }
  }

  /**
   * Log item creation
   */
  async logItemCreated(itemId, itemData) {
    return this.logEvent({
      action: 'CREATE',
      resource: 'ITEM',
      resourceId: itemId,
      changes: null,
      metadata: {
        newItem: itemData,
        message: 'New item created',
      },
    });
  }

  /**
   * Log item update
   */
  async logItemUpdated(itemId, oldData, newData) {
    const changes = this.calculateChanges(oldData, newData);
    
    return this.logEvent({
      action: 'UPDATE',
      resource: 'ITEM',
      resourceId: itemId,
      changes,
      metadata: {
        message: 'Item updated',
        fieldsChanged: Object.keys(changes),
      },
    });
  }

  /**
   * Log item deletion
   */
  async logItemDeleted(itemId, itemData) {
    return this.logEvent({
      action: 'DELETE',
      resource: 'ITEM',
      resourceId: itemId,
      changes: null,
      metadata: {
        deletedItem: itemData,
        message: 'Item deleted',
      },
    });
  }

  /**
   * Log item view (for sensitive operations)
   */
  async logItemViewed(itemId) {
    return this.logEvent({
      action: 'VIEW',
      resource: 'ITEM',
      resourceId: itemId,
      changes: null,
      metadata: {
        message: 'Item details viewed',
      },
    });
  }

  /**
   * Log bulk operations
   */
  async logBulkOperation(action, resourceType, resourceIds, metadata = {}) {
    return this.logEvent({
      action: `BULK_${action}`,
      resource: resourceType,
      resourceId: resourceIds.join(','),
      changes: null,
      metadata: {
        ...metadata,
        affectedCount: resourceIds.length,
        message: `Bulk ${action.toLowerCase()} operation performed`,
      },
    });
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(action, metadata = {}) {
    return this.logEvent({
      action,
      resource: 'AUTH',
      resourceId: this.getCurrentUserId() || 'anonymous',
      changes: null,
      metadata: {
        ...metadata,
        message: `Authentication event: ${action}`,
      },
    });
  }

  /**
   * Retrieve audit logs with filters
   */
  async getAuditLogs(filters = {}) {
    try {
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams();

      // Add filter parameters
      if (filters.action) queryParams.append('action', filters.action);
      if (filters.resource) queryParams.append('resource', filters.resource);
      if (filters.resourceId) queryParams.append('resourceId', filters.resourceId);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);

      const response = await fetch(`${this.baseURL}/audit?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }

  /**
   * Get current user ID from token or session
   */
  getCurrentUserId() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;

      // Decode JWT token to get user ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub;
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      return null;
    }
  }

  /**
   * Get client IP address (best effort)
   */
  async getClientIP() {
    try {
      // This would typically be handled by the server
      // For client-side, we can use a service or let the server determine it
      return 'client-side'; // Placeholder
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate changes between old and new data
   */
  calculateChanges(oldData, newData) {
    const changes = {};
    
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key],
        };
      }
    }

    // Check for removed fields
    for (const key in oldData) {
      if (!(key in newData)) {
        changes[key] = {
          from: oldData[key],
          to: null,
        };
      }
    }

    return changes;
  }

  /**
   * Store audit log locally as fallback
   */
  storeLocalAuditLog(eventData) {
    try {
      const localLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      localLogs.push({
        ...eventData,
        timestamp: new Date().toISOString(),
        stored: 'local',
      });

      // Keep only last 100 entries to prevent storage bloat
      if (localLogs.length > 100) {
        localLogs.splice(0, localLogs.length - 100);
      }

      localStorage.setItem('auditLogs', JSON.stringify(localLogs));
    } catch (error) {
      console.error('Failed to store local audit log:', error);
    }
  }

  /**
   * Sync local audit logs to server
   */
  async syncLocalLogs() {
    try {
      const localLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      const logsToSync = localLogs.filter(log => log.stored === 'local');

      if (logsToSync.length === 0) return;

      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${this.baseURL}/audit/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ logs: logsToSync }),
      });

      if (response.ok) {
        // Remove synced logs from local storage
        const remainingLogs = localLogs.filter(log => log.stored !== 'local');
        localStorage.setItem('auditLogs', JSON.stringify(remainingLogs));
      }
    } catch (error) {
      console.error('Failed to sync local audit logs:', error);
    }
  }

  /**
   * Export audit logs for compliance purposes
   */
  async exportAuditLogs(filters = {}, format = 'json') {
    try {
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams({
        ...filters,
        format,
      });

      const response = await fetch(`${this.baseURL}/audit/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to export audit logs: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const auditService = new AuditService();

export default auditService;

// Named exports for specific logging functions
export const {
  logItemCreated,
  logItemUpdated,
  logItemDeleted,
  logItemViewed,
  logBulkOperation,
  logAuthEvent,
  getAuditLogs,
  exportAuditLogs,
  syncLocalLogs,
} = auditService;