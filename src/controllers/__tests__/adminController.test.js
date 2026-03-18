const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Item = require('../../models/Item');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const adminController = require('../adminController');
const authMiddleware = require('../../middleware/auth');
const adminMiddleware = require('../../middleware/admin');
const jwt = require('jsonwebtoken');

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock middleware for testing
app.use((req, res, next) => {
  req.user = {
    id: '507f1f77bcf86cd799439011',
    role: 'admin',
    email: 'admin@test.com'
  };
  next();
});

// Routes
app.get('/admin/items', adminController.getItems);
app.post('/admin/items', adminController.createItem);
app.put('/admin/items/:id', adminController.updateItem);
app.delete('/admin/items/:id', adminController.deleteItem);
app.get('/admin/items/:id', adminController.getItemById);

let mongoServer;

// Test data
const mockItems = [
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Item 1',
    description: 'Test description 1',
    price: 29.99,
    category: 'electronics',
    status: 'active',
    sku: 'TEST-001',
    stockQuantity: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Item 2',
    description: 'Test description 2',
    price: 49.99,
    category: 'clothing',
    status: 'inactive',
    sku: 'TEST-002',
    stockQuantity: 50,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Electronics Item',
    description: 'Electronics description',
    price: 199.99,
    category: 'electronics',
    status: 'active',
    sku: 'ELEC-001',
    stockQuantity: 25,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03')
  }
];

describe('AdminController', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Item.deleteMany({});
    await AuditLog.deleteMany({});
    await Item.insertMany(mockItems);
  });

  afterEach(async () => {
    await Item.deleteMany({});
    await AuditLog.deleteMany({});
  });

  // TC-001: Admin can view a list of all items with pagination
  describe('TC-001: GET /admin/items - List items with pagination', () => {
    test('should return paginated list of items', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pagination).toEqual(
        expect.objectContaining({
          currentPage: 1,
          totalPages: 2,
          totalItems: 3,
          itemsPerPage: 2,
          hasNextPage: true,
          hasPrevPage: false
        })
      );
    });

    test('should return second page of items', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.pagination.currentPage).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(false);
      expect(response.body.data.pagination.hasPrevPage).toBe(true);
    });

    test('should handle invalid page parameters', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ page: -1, limit: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });
  });

  // TC-006: Admin can search and filter items by name, category, or status
  describe('TC-006: Search and filter functionality', () => {
    test('should search items by name', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ search: 'Electronics' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Electronics Item');
    });

    test('should search items by description', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ search: 'electronics description' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].description).toContain('Electronics description');
    });

    test('should filter items by category', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ category: 'electronics' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      response.body.data.items.forEach(item => {
        expect(item.category).toBe('electronics');
      });
    });

    test('should filter items by status', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('active');
      });
    });

    test('should combine search and filter', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ search: 'Test', category: 'electronics', status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Test Item 1');
    });

    test('should sort items by different fields', async () => {
      const response = await request(app)
        .get('/admin/items')
        .query({ sortBy: 'price', sortOrder: 'desc' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const prices = response.body.data.items.map(item => item.price);
      expect(prices).toEqual([199.99, 49.99, 29.99]);
    });
  });

  // TC-002: Admin can create new items with all required fields
  describe('TC-002: POST /admin/items - Create new item', () => {
    test('should create new item with valid data', async () => {
      const newItem = {
        name: 'New Test Item',
        description: 'New test description with sufficient length',
        price: 39.99,
        category: 'books',
        status: 'active',
        sku: 'BOOK-001',
        stockQuantity: 75
      };

      const response = await request(app)
        .post('/admin/items')
        .send(newItem)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          name: newItem.name,
          description: newItem.description,
          price: newItem.price,
          category: newItem.category,
          status: newItem.status,
          sku: newItem.sku,
          stockQuantity: newItem.stockQuantity
        })
      );

      // Verify item was saved to database
      const savedItem = await Item.findById(response.body.data._id);
      expect(savedItem).toBeTruthy();
      expect(savedItem.name).toBe(newItem.name);
    });

    test('should create audit log entry for item creation', async () => {
      const newItem = {
        name: 'Audited Item',
        description: 'Test description for audit logging',
        price: 25.99,
        category: 'toys',
        status: 'active',
        sku: 'TOY-001',
        stockQuantity: 100
      };

      const response = await request(app)
        .post('/admin/items')
        .send(newItem)
        .expect(201);

      // Check audit log was created
      const auditLog = await AuditLog.findOne({
        resource: 'ITEM',
        resourceId: response.body.data._id,
        action: 'CREATE'
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.userId.toString()).toBe('507f1f77bcf86cd799439011');
    });

    test('should validate required fields', async () => {
      const invalidItem = {
        description: 'Missing name and price'
      };

      const response = await request(app)
        .post('/admin/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
          expect.objectContaining({ field: 'price' })
        ])
      );
    });

    test('should validate price is positive', async () => {
      const invalidItem = {
        name: 'Invalid Price Item',
        description: 'Item with negative price',
        price: -10.99,
        category: 'other',
        sku: 'INV-001'
      };

      const response = await request(app)
        .post('/admin/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'price' })
        ])
      );
    });

    test('should validate unique SKU', async () => {
      const duplicateItem = {
        name: 'Duplicate SKU Item',
        description: 'Item with duplicate SKU',
        price: 29.99,
        category: 'other',
        sku: 'TEST-001', // This SKU already exists
        stockQuantity: 10
      };

      const response = await request(app)
        .post('/admin/items')
        .send(duplicateItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('SKU already exists');
    });
  });

  // TC-004: Admin can edit existing item details
  describe('TC-004: PUT /admin/items/:id - Update existing item', () => {
    test('should update existing item', async () => {
      const itemId = mockItems[0]._id;
      const updateData = {
        name: 'Updated Test Item',
        price: 35.99,
        description: 'Updated test description with new information'
      };

      const response = await request(app)
        .put(`/admin/items/${itemId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.price).toBe(updateData.price);
      expect(response.body.data.description).toBe(updateData.description);

      // Verify database was updated
      const updatedItem = await Item.findById(itemId);
      expect(updatedItem.name).toBe(updateData.name);
      expect(updatedItem.price).toBe(updateData.price);
    });

    test('should create audit log for item update', async () => {
      const itemId = mockItems[0]._id;
      const updateData = {
        name: 'Audited Update Item',
        price: 45.99
      };

      await request(app)
        .put(`/admin/items/${itemId}`)
        .send(updateData)
        .expect(200);

      // Check audit log was created
      const auditLog = await AuditLog.findOne({
        resource: 'ITEM',
        resourceId: itemId.toString(),
        action: 'UPDATE'
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.changes.before.name).toBe('Test Item 1');
      expect(auditLog.changes.after.name).toBe('Audited Update Item');
    });

    test('should return 404 for non-existent item', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Non-existent Item'
      };

      const response = await request(app)
        .put(`/admin/items/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Item not found');
    });

    test('should validate update data', async () => {
      const itemId = mockItems[0]._id;
      const invalidUpdateData = {
        price: 'invalid-price',
        status: 'invalid-status'
      };

      const response = await request(app)
        .put(`/admin/items/${itemId}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  // TC-005: Admin can delete items with confirmation prompt (backend validation)
  describe('TC-005: DELETE /admin/items/:id - Delete item', () => {
    test('should delete existing item', async () => {
      const itemId = mockItems[0]._id;

      const response = await request(app)
        .delete(`/admin/items/${itemId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Item deleted successfully');

      // Verify item was removed from database
      const deletedItem = await Item.findById(itemId);
      expect(deletedItem).toBeNull();
    });

    test('should create audit log for item deletion', async () => {
      const itemId = mockItems[0]._id;
      const originalItem = await Item.findById(itemId);

      await request(app)
        .delete(`/admin/items/${itemId}`)
        .expect(200);

      // Check audit log was created
      const auditLog = await AuditLog.findOne({
        resource: 'ITEM',
        resourceId: itemId.toString(),
        action: 'DELETE'
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.changes.before.name).toBe(originalItem.name);
      expect(auditLog.changes.after).toBeNull();
    });

    test('should return 404 for non-existent item', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/admin/items/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Item not found');
    });

    test('should handle soft delete for items with orders', async () => {
      // This would be implemented if soft delete is required
      const itemId = mockItems[0]._id;

      // Mock item having associated orders
      jest.spyOn(Item, 'findById').mockResolvedValueOnce({
        ...mockItems[0],
        hasOrders: true,
        softDelete: jest.fn()
      });

      const response = await request(app)
        .delete(`/admin/items/${itemId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('archived');
    });
  });

  // TC-007: All CRUD operations include proper error handling
  describe('TC-007: Error Handling', () => {
    test('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(Item, 'find').mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/admin/items')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });

    test('should handle validation errors gracefully', async () => {
      const invalidItem = {
        name: 'A', // Too short
        description: 'Short', // Too short
        price: 0, // Invalid
        category: 'invalid-category'
      };

      const response = await request(app)
        .post('/admin/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/admin/items/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid item ID');
    });
  });

  // TC-008: Changes are logged for audit purposes (integration test)
  describe('TC-008: Audit Logging Integration', () => {
    test('should log all CRUD operations', async () => {
      // Create
      const createResponse = await request(app)
        .post('/admin/items')
        .send({
          name: 'Audit Test Item',
          description: 'Item for testing audit logging',
          price: 19.99,
          category: 'test',
          sku: 'AUDIT-001',
          stockQuantity: 50
        })
        .expect(201);

      const itemId = createResponse.body.data._id;

      // Update
      await request(app)
        .put(`/admin/items/${itemId}`)
        .send({ name: 'Updated Audit Test Item' })
        .expect(200);

      // Delete
      await request(app)
        .delete(`/admin/items/${itemId}`)
        .expect(200);

      // Verify all audit logs were created
      const auditLogs = await AuditLog.find({
        resource: 'ITEM',
        resourceId: itemId
      }).sort({ timestamp: 1 });

      expect(auditLogs).toHaveLength(3);
      expect(auditLogs[0].action).toBe('CREATE');
      expect(auditLogs[1].action).toBe('UPDATE');
      expect(auditLogs[2].action).toBe('DELETE');
    });

    test('should include user information in audit logs', async () => {
      const response = await request(app)
        .post('/admin/items')
        .send({
          name: 'User Audit Test',
          description: 'Testing user info in audit logs',
          price: 15.99,
          category: 'test',
          sku: 'USER-001',
          stockQuantity: 30
        })
        .expect(201);

      const auditLog = await AuditLog.findOne({
        resource: 'ITEM',
        resourceId: response.body.data._id,
        action: 'CREATE'
      });

      expect(auditLog.userId.toString()).toBe('507f1f77bcf86cd799439011');
      expect(auditLog.userAgent).toBeDefined();
      expect(auditLog.timestamp).toBeDefined();
    });
  });
});