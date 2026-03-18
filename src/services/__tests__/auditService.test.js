import { auditService } from '../auditService';
import { AuditLog } from '../../models/AuditLog';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)'
  }
});

describe('AuditService', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockToken = 'test-jwt-token';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'adminToken') return mockToken;
      if (key === 'userId') return mockUserId;
      return null;
    });
    
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  // TC-007: Audit logging records all CRUD operations
  describe('TC-007: CRUD Operations Audit Logging', () => {
    test('should record CREATE operations with complete data', async () => {
      const itemData = {
        id: '123',
        name: 'Test Item',
        description: 'Test description',
        price: 29.99,
        category: 'electronics',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await auditService.logItemCreated('123', itemData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`
          }),
          body: expect.stringContaining('"action":"CREATE"')
        })
      );

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'CREATE',
          resource: 'ITEM',
          resourceId: '123',
          userId: mockUserId,
          metadata: expect.objectContaining({
            newItem: itemData,
            operation: 'item_creation'
          }),
          timestamp: expect.any(String)
        })
      );
    });

    test('should record READ operations with access details', async () => {
      const itemId = '123';
      const readMetadata = {
        viewType: 'detail',
        duration: 30000,
        source: 'web_interface',
        searchQuery: null
      };

      await auditService.logItemViewed(itemId, readMetadata);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'READ',
          resource: 'ITEM',
          resourceId: itemId,
          userId: mockUserId,
          metadata: expect.objectContaining({
            ...readMetadata,
            operation: 'item_access'
          }),
          timestamp: expect.any(String)
        })
      );
    });

    test('should record UPDATE operations with before and after states', async () => {
      const itemId = '123';
      const oldData = {
        name: 'Old Name',
        price: 19.99,
        status: 'active',
        lastModified: '2024-01-01T00:00:00Z'
      };
      const newData = {
        name: 'New Name',
        price: 29.99,
        status: 'active',
        lastModified: new Date().toISOString()
      };

      await auditService.logItemUpdated(itemId, oldData, newData);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'UPDATE',
          resource: 'ITEM',
          resourceId: itemId,
          userId: mockUserId,
          changes: {
            before: oldData,
            after: newData
          },
          metadata: expect.objectContaining({
            operation: 'item_modification',
            fieldsChanged: expect.arrayContaining(['name', 'price', 'lastModified'])
          }),
          timestamp: expect.any(String)
        })
      );
    });

    test('should record DELETE operations with deleted item data', async () => {
      const itemId = '123';
      const deletedItem = {
        id: '123',
        name: 'Deleted Item',
        price: 39.99,
        status: 'active',
        deletedAt: new Date().toISOString()
      };

      await auditService.logItemDeleted(itemId, deletedItem);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'DELETE',
          resource: 'ITEM',
          resourceId: itemId,
          userId: mockUserId,
          changes: {
            before: deletedItem,
            after: null
          },
          metadata: expect.objectContaining({
            operation: 'item_deletion',
            softDelete: false
          }),
          timestamp: expect.any(String)
        })
      );
    });

    test('should record all CRUD operations for different resource types', async () => {
      // Test user CRUD operations
      const userData = { id: '456', username: 'testuser', email: 'test@example.com' };
      await auditService.logUserCreated('456', userData);
      
      let requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.resource).toBe('USER');
      expect(requestBody.action).toBe('CREATE');

      // Test category CRUD operations
      const categoryData = { id: '789', name: 'Electronics', description: 'Electronic items' };
      await auditService.logCategoryUpdated('789', { name: 'Old Electronics' }, categoryData);
      
      requestBody = JSON.parse(fetch.mock.calls[1][1].body);
      expect(requestBody.resource).toBe('CATEGORY');
      expect(requestBody.action).toBe('UPDATE');

      // Test order CRUD operations
      const orderData = { id: '101', total: 99.99, status: 'pending' };
      await auditService.logOrderDeleted('101', orderData);
      
      requestBody = JSON.parse(fetch.mock.calls[2][1].body);
      expect(requestBody.resource).toBe('ORDER');
      expect(requestBody.action).toBe('DELETE');
    });

    test('should capture operation metadata for all CRUD operations', async () => {
      const itemData = { id: '123', name: 'Test Item', price: 29.99 };
      
      await auditService.logItemCreated('123', itemData);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.metadata).toEqual(
        expect.objectContaining({
          operation: 'item_creation',
          newItem: itemData,
          userAgent: 'Mozilla/5.0 (Test Browser)',
          ipAddress: expect.any(String),
          sessionId: expect.any(String)
        })
      );
    });

    test('should log CRUD operations with proper sequencing', async () => {
      const itemId = '123';
      const itemData = { id: itemId, name: 'Test Item', price: 29.99 };
      
      // CREATE
      await auditService.logItemCreated(itemId, itemData);
      
      // READ
      await auditService.logItemViewed(itemId, { viewType: 'detail' });
      
      // UPDATE
      const updatedData = { ...itemData, name: 'Updated Item', price: 39.99 };
      await auditService.logItemUpdated(itemId, itemData, updatedData);
      
      // DELETE
      await auditService.logItemDeleted(itemId, updatedData);

      expect(fetch).toHaveBeenCalledTimes(4);
      
      const createRequest = JSON.parse(fetch.mock.calls[0][1].body);
      const readRequest = JSON.parse(fetch.mock.calls[1][1].body);
      const updateRequest = JSON.parse(fetch.mock.calls[2][1].body);
      const deleteRequest = JSON.parse(fetch.mock.calls[3][1].body);
      
      expect(createRequest.action).toBe('CREATE');
      expect(readRequest.action).toBe('READ');
      expect(updateRequest.action).toBe('UPDATE');
      expect(deleteRequest.action).toBe('DELETE');
      
      // Verify chronological order
      expect(new Date(createRequest.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(readRequest.timestamp).getTime()
      );
      expect(new Date(readRequest.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(updateRequest.timestamp).getTime()
      );
      expect(new Date(updateRequest.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(deleteRequest.timestamp).getTime()
      );
    });

    test('should handle batch CRUD operations logging', async () => {
      const items = [
        { id: '1', name: 'Item 1', price: 10.00 },
        { id: '2', name: 'Item 2', price: 20.00 },
        { id: '3', name: 'Item 3', price: 30.00 }
      ];

      await auditService.logBulkCreate(items);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'BULK_CREATE',
          resource: 'ITEM',
          userId: mockUserId,
          metadata: expect.objectContaining({
            operation: 'bulk_creation',
            itemCount: 3,
            items: items,
            batchId: expect.any(String)
          }),
          timestamp: expect.any(String)
        })
      );
    });
  });

  // TC-008: Changes are logged for audit purposes
  describe('TC-008: Audit Logging', () => {
    test('should log item creation event', async () => {
      const itemData = {
        id: '123',
        name: 'Test Item',
        description: 'Test description',
        price: 29.99,
        category: 'electronics'
      };

      await auditService.logItemCreated('123', itemData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`
          }),
          body: expect.stringContaining('"action":"CREATE"')
        })
      );

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'CREATE',
          resource: 'ITEM',
          resourceId: '123',
          userId: mockUserId,
          metadata: expect.objectContaining({
            newItem: itemData
          })
        })
      );
    });

    test('should log item update event with changes', async () => {
      const itemId = '123';
      const oldData = {
        name: 'Old Name',
        price: 19.99
      };
      const newData = {
        name: 'New Name',
        price: 29.99
      };

      await auditService.logItemUpdated(itemId, oldData, newData);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'UPDATE',
          resource: 'ITEM',
          resourceId: itemId,
          changes: {
            before: oldData,
            after: newData
          }
        })
      );
    });

    test('should log item deletion event', async () => {
      const itemId = '123';
      const deletedItem = {
        name: 'Deleted Item',
        price: 39.99
      };

      await auditService.logItemDeleted(itemId, deletedItem);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'DELETE',
          resource: 'ITEM',
          resourceId: itemId,
          changes: {
            before: deletedItem,
            after: null
          }
        })
      );
    });

    test('should log item view event', async () => {
      const itemId = '123';
      const metadata = {
        viewType: 'detail',
        duration: 30000
      };

      await auditService.logItemViewed(itemId, metadata);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'VIEW',
          resource: 'ITEM',
          resourceId: itemId,
          metadata
        })
      );
    });

    test('should include timestamp and user context in audit logs', async () => {
      const beforeTime = new Date().toISOString();
      
      await auditService.logItemCreated('123', { name: 'Test' });
      
      const afterTime = new Date().toISOString();
      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      
      expect(requestBody.timestamp).toBeDefined();
      expect(new Date(requestBody.timestamp).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(requestBody.timestamp >= beforeTime).toBe(true);
      expect(requestBody.timestamp <= afterTime).toBe(true);
      
      expect(requestBody.userId).toBe(mockUserId);
      expect(requestBody.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    });
  });

  describe('Error Handling', () => {
    test('should handle API failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      console.error = jest.fn();

      const result = await auditService.logItemCreated('123', { name: 'Test' });

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Audit logging failed:',
        expect.any(Error)
      );
    });

    test('should handle HTTP errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });
      console.error = jest.fn();

      const result = await auditService.logItemCreated('123', { name: 'Test' });

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Audit logging failed:',
        expect.objectContaining({
          message: 'Audit logging failed: Internal Server Error'
        })
      );
    });

    test('should store audit log in localStorage as fallback', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      const auditServiceSpy = jest.spyOn(auditService, 'storeLocalAuditLog');

      await auditService.logItemCreated('123', { name: 'Test' });

      expect(auditServiceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          resource: 'ITEM',
          resourceId: '123'
        })
      );
    });

    test('should handle missing authentication token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await auditService.logItemCreated('123', { name: 'Test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit'),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      );
    });
  });

  describe('Local Storage Fallback', () => {
    test('should store failed audit logs in localStorage', () => {
      const eventData = {
        action: 'CREATE',
        resource: 'ITEM',
        resourceId: '123'
      };

      auditService.storeLocalAuditLog(eventData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'failedAuditLogs',
        expect.stringContaining('"action":"CREATE"')
      );
    });

    test('should append to existing failed audit logs', () => {
      const existingLogs = [
        { action: 'UPDATE', resource: 'ITEM', resourceId: '456' }
      ];
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'failedAuditLogs') return JSON.stringify(existingLogs);
        if (key === 'adminToken') return mockToken;
        return null;
      });

      const newEventData = {
        action: 'CREATE',
        resource: 'ITEM',
        resourceId: '123'
      };

      auditService.storeLocalAuditLog(newEventData);

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(2);
      expect(savedData[1]).toEqual(expect.objectContaining(newEventData));
    });

    test('should retry failed audit logs when connection restored', async () => {
      const failedLogs = [
        {
          action: 'CREATE',
          resource: 'ITEM',
          resourceId: '123',
          timestamp: new Date().toISOString()
        },
        {
          action: 'UPDATE',
          resource: 'ITEM',
          resourceId: '456',
          timestamp: new Date().toISOString()
        }
      ];
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'failedAuditLogs') return JSON.stringify(failedLogs);
        if (key === 'adminToken') return mockToken;
        return null;
      });

      await auditService.retryFailedLogs();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('failedAuditLogs');
    });
  });

  describe('Bulk Audit Operations', () => {
    test('should log bulk operations', async () => {
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' }
      ];

      await auditService.logBulkDelete(items.map(i => i.id), items);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit/bulk'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"BULK_DELETE"')
        })
      );

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.metadata.itemCount).toBe(3);
      expect(requestBody.metadata.itemIds).toEqual(['1', '2', '3']);
    });

    test('should log bulk status updates', async () => {
      const itemIds = ['1', '2', '3'];
      const fromStatus = 'active';
      const toStatus = 'inactive';

      await auditService.logBulkStatusUpdate(itemIds, fromStatus, toStatus);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(
        expect.objectContaining({
          action: 'BULK_UPDATE',
          resource: 'ITEM',
          metadata: expect.objectContaining({
            operation: 'status_change',
            fromStatus,
            toStatus,
            itemCount: 3
          })
        })
      );
    });
  });

  describe('Audit Log Querying', () => {
    test('should fetch audit logs with filters', async () => {
      const mockAuditLogs = [
        {
          id: '1',
          action: 'CREATE',
          resource: 'ITEM',
          resourceId: '123',
          timestamp: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          action: 'UPDATE',
          resource: 'ITEM',
          resourceId: '123',
          timestamp: '2024-01-01T01:00:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            logs: mockAuditLogs,
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalItems: 2
            }
          }
        })
      });

      const filters = {
        resource: 'ITEM',
        resourceId: '123',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      };

      const result = await auditService.getAuditLogs(filters);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit'),
        expect.objectContaining({
          method: 'GET'
        })
      );

      expect(result.data.logs).toEqual(mockAuditLogs);
    });
  });
});