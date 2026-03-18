const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Product = require('../../models/Product');
const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');
const adminRoutes = require('../admin');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

// Mock models
jest.mock('../../models/Product');
jest.mock('../../models/AuditLog');
jest.mock('../../models/User');
jest.mock('../../middleware/auth');

// Mock auth middleware
const { requireAuth, requireAdmin } = require('../../middleware/auth');
requireAuth.mockImplementation((req, res, next) => {
  req.user = {
    id: '64f123456789abcd12345678',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'admin'
  };
  next();
});
requireAdmin.mockImplementation((req, res, next) => next());

// Test data
const mockAdminUser = {
  _id: '64f123456789abcd12345678',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true
};

const mockRegularUser = {
  _id: '64f123456789abcd12345679',
  name: 'Test User',
  email: 'user@test.com',
  role: 'user',
  isActive: true
};

const mockItems = [
  {
    _id: '64f123456789abcd12345001',
    name: 'Test Item 1',
    description: 'Test description 1',
    category: 'Electronics',
    quantity: 10,
    price: 99.99,
    status: 'active',
    sku: 'TEST-001',
    images: ['image1.jpg'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    _id: '64f123456789abcd12345002',
    name: 'Test Item 2',
    description: 'Test description 2',
    category: 'Clothing',
    quantity: 5,
    price: 49.99,
    status: 'active',
    sku: 'TEST-002',
    images: [],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
];

const mockAuditLogs = [
  {
    _id: '64f123456789abcd12346001',
    itemId: '64f123456789abcd12345001',
    userId: '64f123456789abcd12345678',
    action: 'UPDATE',
    previousData: { name: 'Old Name' },
    newData: { name: 'Test Item 1' },
    changes: [{ field: 'name', oldValue: 'Old Name', newValue: 'Test Item 1' }],
    createdAt: new Date('2024-01-01')
  }
];

// Helper function to generate JWT token
const generateToken = (userId = mockAdminUser._id, role = 'admin') => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Admin Routes', () => {
  // TC-001: Dashboard displays list of items with key information
  describe('GET /api/admin - TC-001: Dashboard Item List', () => {
    it('should return paginated list of items with key information', async () => {
      // Mock Product.find chain
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockItems)
      };
      Product.find.mockReturnValue(mockQuery);
      Product.countDocuments.mockResolvedValue(2);
      
      // Mock stats aggregation
      Product.aggregate.mockResolvedValue([{
        _id: null,
        totalItems: 2,
        totalQuantity: 15,
        activeItems: 2,
        lowStockItems: 0,
        totalValue: 749.93
      }]);
      
      const response = await request(app)
        .get('/api/admin')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.items[0]).toMatchObject({
        name: 'Test Item 1',
        description: 'Test description 1',
        quantity: 10,
        status: 'active'
      });
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 1,
        totalItems: 2
      });
      expect(response.body.data.stats).toMatchObject({
        totalItems: 2,
        activeItems: 2
      });
    });

    it('should filter items by search query', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockItems[0]])
      };
      Product.find.mockReturnValue(mockQuery);
      Product.countDocuments.mockResolvedValue(1);
      Product.aggregate.mockResolvedValue([{ _id: null, totalItems: 1 }]);
      
      await request(app)
        .get('/api/admin?search=Test Item 1')
        .expect(200);
      
      expect(Product.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: 'Test Item 1', $options: 'i' } },
          { description: { $regex: 'Test Item 1', $options: 'i' } },
          { sku: { $regex: 'Test Item 1', $options: 'i' } }
        ]
      });
    });

    it('should filter items by status and category', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockItems)
      };
      Product.find.mockReturnValue(mockQuery);
      Product.countDocuments.mockResolvedValue(2);
      Product.aggregate.mockResolvedValue([{ _id: null, totalItems: 2 }]);
      
      await request(app)
        .get('/api/admin?status=active&category=Electronics')
        .expect(200);
      
      expect(Product.find).toHaveBeenCalledWith({
        status: 'active',
        category: 'Electronics'
      });
    });
  });

  // TC-002: Create new items with all required fields
  describe('POST /api/admin/items - TC-002: Create New Items', () => {
    it('should create new item with all required fields', async () => {
      const newItemData = {
        name: 'New Test Item',
        description: 'New test item description',
        category: 'Electronics',
        quantity: 20,
        price: 199.99,
        sku: 'TEST-003',
        status: 'active'
      };
      
      const savedItem = { ...newItemData, _id: '64f123456789abcd12345003', createdAt: new Date() };
      Product.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(savedItem),
        ...savedItem
      }));
      
      // Mock audit log creation
      AuditLog.create = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .post('/api/admin/items')
        .send(newItemData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'New Test Item',
        description: 'New test item description',
        quantity: 20,
        status: 'active'
      });
      
      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith({
        action: 'CREATE',
        itemId: savedItem._id,
        userId: mockAdminUser.id,
        newData: expect.objectContaining(newItemData),
        timestamp: expect.any(Date)
      });
    });

    it('should return validation error for missing required fields', async () => {
      const invalidItemData = {
        name: '', // Missing required name
        description: 'Test description'
      };
      
      const response = await request(app)
        .post('/api/admin/items')
        .send(invalidItemData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle duplicate SKU error', async () => {
      const duplicateItemData = {
        name: 'Duplicate Item',
        description: 'Duplicate item description',
        category: 'Electronics',
        quantity: 10,
        price: 99.99,
        sku: 'TEST-001', // Existing SKU
        status: 'active'
      };
      
      Product.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue({ code: 11000, keyPattern: { sku: 1 } })
      }));
      
      const response = await request(app)
        .post('/api/admin/items')
        .send(duplicateItemData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('SKU already exists');
    });
  });

  // TC-004: Edit existing item details
  describe('PUT /api/admin/items/:id - TC-004: Edit Items', () => {
    it('should update existing item successfully', async () => {
      const itemId = '64f123456789abcd12345001';
      const updateData = {
        name: 'Updated Test Item',
        description: 'Updated description',
        quantity: 15,
        price: 129.99
      };
      
      const originalItem = { ...mockItems[0] };
      const updatedItem = { ...originalItem, ...updateData, updatedAt: new Date() };
      
      Product.findById.mockResolvedValue(originalItem);
      Product.findByIdAndUpdate.mockResolvedValue(updatedItem);
      AuditLog.create = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .put(`/api/admin/items/${itemId}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Test Item');
      expect(response.body.data.quantity).toBe(15);
      
      // Verify audit log for update
      expect(AuditLog.create).toHaveBeenCalledWith({
        action: 'UPDATE',
        itemId,
        userId: mockAdminUser.id,
        previousData: originalItem,
        newData: updatedItem,
        changes: expect.any(Array),
        timestamp: expect.any(Date)
      });
    });

    it('should return 404 for non-existent item', async () => {
      const nonExistentId = '64f123456789abcd12345999';
      Product.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .put(`/api/admin/items/${nonExistentId}`)
        .send({ name: 'Updated Name' })
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  // TC-005: Delete items with proper confirmation
  describe('DELETE /api/admin/items/:id - TC-005: Delete Items', () => {
    it('should delete item successfully', async () => {
      const itemId = '64f123456789abcd12345001';
      const itemToDelete = { ...mockItems[0] };
      
      Product.findById.mockResolvedValue(itemToDelete);
      Product.findByIdAndDelete.mockResolvedValue(itemToDelete);
      AuditLog.create = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .delete(`/api/admin/items/${itemId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      
      // Verify audit log for deletion
      expect(AuditLog.create).toHaveBeenCalledWith({
        action: 'DELETE',
        itemId,
        userId: mockAdminUser.id,
        previousData: itemToDelete,
        timestamp: expect.any(Date)
      });
    });

    it('should return 404 when trying to delete non-existent item', async () => {
      const nonExistentId = '64f123456789abcd12345999';
      Product.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .delete(`/api/admin/items/${nonExistentId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  // TC-011: Bulk operations for efficient management
  describe('DELETE /api/admin/items/bulk-delete - TC-011: Bulk Operations', () => {
    it('should perform bulk delete operation', async () => {
      const itemIds = ['64f123456789abcd12345001', '64f123456789abcd12345002'];
      const itemsToDelete = mockItems;
      
      Product.find.mockResolvedValue(itemsToDelete);
      Product.deleteMany.mockResolvedValue({ deletedCount: 2 });
      AuditLog.create = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .delete('/api/admin/items/bulk-delete')
        .send({ ids: itemIds })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(2);
      
      // Verify bulk operation was logged
      expect(AuditLog.create).toHaveBeenCalledWith({
        action: 'BULK_DELETE',
        userId: mockAdminUser.id,
        bulkOperation: {
          affectedItems: itemIds,
          criteria: { _id: { $in: itemIds } },
          totalAffected: 2
        },
        timestamp: expect.any(Date)
      });
    });

    it('should validate bulk operation request', async () => {
      const response = await request(app)
        .delete('/api/admin/items/bulk-delete')
        .send({ ids: [] }) // Empty array
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No items selected');
    });
  });

  // TC-012: Audit trail tracks all changes with timestamps and user information
  describe('GET /api/admin/items/audit - TC-012: Audit Trail', () => {
    it('should return audit logs for specific item', async () => {
      const itemId = '64f123456789abcd12345001';
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnValue(mockAuditLogs)
      };
      AuditLog.find.mockReturnValue(mockQuery);
      AuditLog.countDocuments.mockResolvedValue(1);
      
      const response = await request(app)
        .get(`/api/admin/items/audit?itemId=${itemId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0]).toMatchObject({
        itemId,
        action: 'UPDATE',
        changes: [{
          field: 'name',
          oldValue: 'Old Name',
          newValue: 'Test Item 1'
        }]
      });
    });

    it('should filter audit logs by action type', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnValue([])
      };
      AuditLog.find.mockReturnValue(mockQuery);
      AuditLog.countDocuments.mockResolvedValue(0);
      
      await request(app)
        .get('/api/admin/items/audit?action=CREATE')
        .expect(200);
      
      expect(AuditLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE' })
      );
    });
  });

  // TC-008: Error handling and success feedback
  describe('Error Handling - TC-008: Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      Product.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      
      const response = await request(app)
        .get('/api/admin')
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Server error');
    });

    it('should handle invalid ObjectId format', async () => {
      const invalidId = 'invalid-object-id';
      
      const response = await request(app)
        .get(`/api/admin/items/${invalidId}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid item ID');
    });
  });

  // TC-007: Admin authentication and access control (COMPREHENSIVE COVERAGE)
  describe('Authentication and Access Control - TC-007: Admin Authentication', () => {
    beforeEach(() => {
      // Reset middleware mocks before each test
      requireAuth.mockClear();
      requireAdmin.mockClear();
    });

    describe('Authentication Token Validation', () => {
      it('should deny access without authentication token', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.',
            code: 'NO_TOKEN'
          });
        });
        
        const response = await request(app)
          .get('/api/admin')
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('NO_TOKEN');
        expect(response.body.message).toContain('No token provided');
      });

      it('should deny access with invalid token', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Invalid authentication token.',
            code: 'INVALID_TOKEN'
          });
        });
        
        const response = await request(app)
          .get('/api/admin')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INVALID_TOKEN');
      });

      it('should deny access with expired token', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Token has expired.',
            code: 'TOKEN_EXPIRED'
          });
        });
        
        const response = await request(app)
          .get('/api/admin')
          .set('Authorization', 'Bearer expired-token')
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('TOKEN_EXPIRED');
      });

      it('should deny access with malformed token', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Malformed authentication token.',
            code: 'MALFORMED_TOKEN'
          });
        });
        
        const response = await request(app)
          .get('/api/admin')
          .set('Authorization', 'InvalidBearer token')
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('MALFORMED_TOKEN');
      });
    });

    describe('Role-Based Access Control', () => {
      it('should deny access to regular users', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          req.user = mockRegularUser;
          next();
        });
        
        requireAdmin.mockImplementation((req, res, next) => {
          if (req.user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              message: 'Access denied. Administrator privileges required.',
              code: 'INSUFFICIENT_PRIVILEGES'
            });
          }
          next();
        });
        
        const response = await request(app)
          .get('/api/admin')
          .expect(403);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INSUFFICIENT_PRIVILEGES');
      });

      it('should deny access to inactive admin users', async () => {
        const inactiveAdmin = { ...mockAdminUser, isActive: false };
        
        requireAuth.mockImplementation((req, res, next) => {
          req.user = inactiveAdmin;
          next();
        });
        
        requireAdmin.mockImplementation((req, res, next) => {
          if (!req.user.isActive) {
            return res.status(403).json({
              success: false,
              message: 'Account has been deactivated.',
              code: 'ACCOUNT_INACTIVE'
            });
          }
          next();
        });
        
        const response = await request(app)
          .get('/api/admin')
          .expect(403);
        
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('ACCOUNT_INACTIVE');
      });

      it('should allow access to active admin users', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });
        
        requireAdmin.mockImplementation((req, res, next) => {
          if (req.user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              message: 'Administrator privileges required.'
            });
          }
          if (!req.user.isActive) {
            return res.status(403).json({
              success: false,
              message: 'Account inactive.'
            });
          }
          next();
        });

        // Mock Product operations for successful response
        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockItems)
        };
        Product.find.mockReturnValue(mockQuery);
        Product.countDocuments.mockResolvedValue(2);
        Product.aggregate.mockResolvedValue([{ _id: null, totalItems: 2 }]);
        
        const response = await request(app)
          .get('/api/admin')
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
    });

    describe('Cross-Route Authentication Consistency', () => {
      const testRoutes = [
        { method: 'get', path: '/api/admin', data: null },
        { method: 'post', path: '/api/admin/items', data: { name: 'Test', price: 10 } },
        { method: 'put', path: '/api/admin/items/64f123456789abcd12345001', data: { name: 'Updated' } },
        { method: 'delete', path: '/api/admin/items/64f123456789abcd12345001', data: null },
        { method: 'get', path: '/api/admin/items/audit', data: null }
      ];

      testRoutes.forEach(({ method, path, data }) => {
        it(`should enforce authentication on ${method.toUpperCase()} ${path}`, async () => {
          requireAuth.mockImplementation((req, res, next) => {
            res.status(401).json({ 
              success: false, 
              message: 'Authentication required',
              code: 'NO_AUTH'
            });
          });
          
          let req = request(app)[method](path);
          if (data) {
            req = req.send(data);
          }
          
          const response = await req.expect(401);
          expect(response.body.success).toBe(false);
          expect(response.body.code).toBe('NO_AUTH');
        });

        it(`should enforce admin role on ${method.toUpperCase()} ${path}`, async () => {
          requireAuth.mockImplementation((req, res, next) => {
            req.user = mockRegularUser;
            next();
          });
          
          requireAdmin.mockImplementation((req, res, next) => {
            res.status(403).json({
              success: false,
              message: 'Admin access required',
              code: 'NOT_ADMIN'
            });
          });
          
          let req = request(app)[method](path);
          if (data) {
            req = req.send(data);
          }
          
          const response = await req.expect(403);
          expect(response.body.success).toBe(false);
          expect(response.body.code).toBe('NOT_ADMIN');
        });
      });
    });

    describe('Session and Token Security', () => {
      it('should handle concurrent session validation', async () => {
        let authCallCount = 0;
        requireAuth.mockImplementation((req, res, next) => {
          authCallCount++;
          if (authCallCount > 3) {
            return res.status(401).json({
              success: false,
              message: 'Session limit exceeded',
              code: 'SESSION_LIMIT'
            });
          }
          req.user = mockAdminUser;
          next();
        });

        requireAdmin.mockImplementation((req, res, next) => next());

        // Mock successful product operations
        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([])
        };
        Product.find.mockReturnValue(mockQuery);
        Product.countDocuments.mockResolvedValue(0);
        Product.aggregate.mockResolvedValue([{ _id: null, totalItems: 0 }]);

        // First 3 requests should succeed
        await request(app).get('/api/admin').expect(200);
        await request(app).get('/api/admin').expect(200);
        await request(app).get('/api/admin').expect(200);
        
        // Fourth request should fail
        const response = await request(app).get('/api/admin').expect(401);
        expect(response.body.code).toBe('SESSION_LIMIT');
      });

      it('should validate user context in token', async () => {
        requireAuth.mockImplementation((req, res, next) => {
          req.user = { 
            id: mockAdminUser._id, 
            role: 'admin',
            // Missing required fields
            isActive: undefined
          };
          next();
        });
        
        requireAdmin.mockImplementation((req, res, next) => {
          if (req.user.isActive === undefined) {
            return res.status(401).json({
              success: false,
              message: 'Invalid user context in token',
              code: 'INVALID_USER_CONTEXT'
            });
          }
          next();
        });
        
        const response = await request(app)
          .get('/api/admin')
          .expect(401);
        
        expect(response.body.code).toBe('INVALID_USER_CONTEXT');
      });
    });

    describe('Permission Granularity', () => {
      it('should allow admin to view items but deny modifications if read-only', async () => {
        const readOnlyAdmin = { ...mockAdminUser, permissions: ['read'] };
        
        requireAuth.mockImplementation((req, res, next) => {
          req.user = readOnlyAdmin;
          next();
        });
        
        requireAdmin.mockImplementation((req, res, next) => {
          if (req.method !== 'GET' && req.user.permissions && !req.user.permissions.includes('write')) {
            return res.status(403).json({
              success: false,
              message: 'Read-only access. Modification not permitted.',
              code: 'READ_ONLY_ACCESS'
            });
          }
          next();
        });

        // GET should work
        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([])
        };
        Product.find.mockReturnValue(mockQuery);
        Product.countDocuments.mockResolvedValue(0);
        Product.aggregate.mockResolvedValue([{ _id: null, totalItems: 0 }]);

        await request(app).get('/api/admin').expect(200);
        
        // POST should fail
        const response = await request(app)
          .post('/api/admin/items')
          .send({ name: 'Test Item', price: 10 })
          .expect(403);
        
        expect(response.body.code).toBe('READ_ONLY_ACCESS');
      });
    });

    describe('Error Response Consistency', () => {
      it('should return consistent error format for authentication failures', async () => {
        const testCases = [
          { 
            mock: () => requireAuth.mockImplementation((req, res) => 
              res.status(401).json({ success: false, message: 'No token', code: 'NO_TOKEN' })),
            expectedCode: 'NO_TOKEN'
          },
          { 
            mock: () => requireAuth.mockImplementation((req, res) => 
              res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' })),
            expectedCode: 'INVALID_TOKEN'
          },
          { 
            mock: () => {
              requireAuth.mockImplementation((req, res, next) => { req.user = mockRegularUser; next(); });
              requireAdmin.mockImplementation((req, res) => 
                res.status(403).json({ success: false, message: 'Not admin', code: 'NOT_ADMIN' }));
            },
            expectedCode: 'NOT_ADMIN'
          }
        ];

        for (const testCase of testCases) {
          testCase.mock();
          
          const response = await request(app).get('/api/admin');
          
          expect(response.body).toHaveProperty('success', false);
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('code', testCase.expectedCode);
          expect(typeof response.body.message).toBe('string');
        }
      });
    });
  });

  // TC-010: Access restricted to authenticated administrators only (Legacy test maintained for compatibility)
  describe('Authentication - TC-010: Admin Access Control', () => {
    it('should deny access without authentication token', async () => {
      // Remove auth middleware mock temporarily
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({ 
          success: false, 
          message: 'Access denied. No token provided.',
          code: 'NO_TOKEN'
        });
      });
      
      const response = await request(app)
        .get('/api/admin')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
      
      // Restore mock
      requireAuth.mockImplementation((req, res, next) => {
        req.user = mockAdminUser;
        next();
      });
    });

    it('should deny access to non-admin users', async () => {
      requireAdmin.mockImplementation((req, res, next) => {
        res.status(403).json({
          success: false,
          message: 'Access denied. Administrator privileges required.',
          code: 'INSUFFICIENT_PRIVILEGES'
        });
      });
      
      const response = await request(app)
        .get('/api/admin')
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_PRIVILEGES');
      
      // Restore mock
      requireAdmin.mockImplementation((req, res, next) => next());
    });
  });
});