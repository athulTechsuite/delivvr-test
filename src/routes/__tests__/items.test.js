const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Item = require('../../models/Item');
const User = require('../../models/User');
const itemsRouter = require('../items');

// Mock middleware
jest.mock('../../middleware/auth');
jest.mock('../../middleware/adminAuth');

const app = express();
app.use(express.json());
app.use('/api/items', itemsRouter);

// Mock data
const mockAdmin = {
  _id: new mongoose.Types.ObjectId(),
  email: 'admin@test.com',
  role: 'admin',
  name: 'Admin User',
  isActive: true
};

const mockItems = [
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Item 1',
    description: 'Description for test item 1',
    category: 'Electronics',
    status: 'active',
    price: 99.99,
    stock: 10,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Item 2',
    description: 'Description for test item 2',
    category: 'Clothing',
    status: 'inactive',
    price: 49.99,
    stock: 5,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
];

describe('Items API Routes', () => {
  beforeEach(() => {
    // Mock auth middleware to add user to request
    require('../../middleware/auth').mockImplementation((req, res, next) => {
      req.user = mockAdmin;
      next();
    });
    
    require('../../middleware/adminAuth').mockImplementation((req, res, next) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  // TC-001: Get all items with pagination and filtering
  describe('GET /api/items - TC-001: Item List Retrieval', () => {
    beforeEach(() => {
      Item.countDocuments = jest.fn();
      Item.find = jest.fn().mockReturnThis();
      Item.select = jest.fn().mockReturnThis();
      Item.sort = jest.fn().mockReturnThis();
      Item.skip = jest.fn().mockReturnThis();
      Item.limit = jest.fn().mockReturnThis();
    });

    it('should return paginated list of items', async () => {
      Item.countDocuments.mockResolvedValue(2);
      Item.limit.mockResolvedValue(mockItems);

      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.totalCount).toBe(2);
      expect(response.body.data.currentPage).toBe(1);
    });

    it('should handle pagination parameters', async () => {
      Item.countDocuments.mockResolvedValue(10);
      Item.limit.mockResolvedValue(mockItems.slice(0, 1));

      const response = await request(app)
        .get('/api/items?page=2&limit=1')
        .expect(200);

      expect(Item.skip).toHaveBeenCalledWith(1);
      expect(Item.limit).toHaveBeenCalledWith(1);
    });

    it('should filter items by search term', async () => {
      Item.countDocuments.mockResolvedValue(1);
      Item.limit.mockResolvedValue([mockItems[0]]);

      await request(app)
        .get('/api/items?search=Test Item 1')
        .expect(200);

      expect(Item.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { name: { $regex: 'Test Item 1', $options: 'i' } },
            { description: { $regex: 'Test Item 1', $options: 'i' } }
          ])
        })
      );
    });

    it('should filter items by category', async () => {
      Item.countDocuments.mockResolvedValue(1);
      Item.limit.mockResolvedValue([mockItems[0]]);

      await request(app)
        .get('/api/items?category=Electronics')
        .expect(200);

      expect(Item.find).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Electronics'
        })
      );
    });

    it('should filter items by status', async () => {
      Item.countDocuments.mockResolvedValue(1);
      Item.limit.mockResolvedValue([mockItems[0]]);

      await request(app)
        .get('/api/items?status=active')
        .expect(200);

      expect(Item.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active'
        })
      );
    });

    it('should handle sorting parameters', async () => {
      Item.countDocuments.mockResolvedValue(2);
      Item.limit.mockResolvedValue(mockItems);

      await request(app)
        .get('/api/items?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(Item.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/items?page=0&limit=101')
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  // TC-003: Create new item
  describe('POST /api/items - TC-003: Item Creation', () => {
    beforeEach(() => {
      Item.prototype.save = jest.fn();
    });

    it('should create a new item with valid data', async () => {
      const newItemData = {
        name: 'New Test Item',
        description: 'New item description',
        category: 'Electronics',
        price: 199.99,
        status: 'active',
        stock: 15
      };

      const savedItem = { 
        _id: new mongoose.Types.ObjectId(), 
        ...newItemData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      Item.prototype.save.mockResolvedValue(savedItem);

      const response = await request(app)
        .post('/api/items')
        .send(newItemData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newItemData.name);
      expect(response.body.message).toBe('Item created successfully');
    });

    it('should return validation errors for missing required fields', async () => {
      const invalidData = {
        description: 'Missing name and category'
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'name')).toBe(true);
      expect(response.body.errors.some(err => err.path === 'category')).toBe(true);
    });

    it('should return 400 for invalid price value', async () => {
      const invalidData = {
        name: 'Test Item',
        category: 'Electronics',
        price: -10
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors during creation', async () => {
      const newItemData = {
        name: 'Test Item',
        category: 'Electronics',
        price: 99.99
      };

      Item.prototype.save.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/items')
        .send(newItemData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error creating item');
    });
  });

  // TC-004: Update existing item
  describe('PUT /api/items/:id - TC-004: Item Update', () => {
    const itemId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      Item.findByIdAndUpdate = jest.fn();
    });

    it('should update an existing item', async () => {
      const updateData = {
        name: 'Updated Item Name',
        price: 149.99
      };

      const updatedItem = {
        _id: itemId,
        ...mockItems[0],
        ...updateData,
        updatedAt: new Date()
      };

      Item.findByIdAndUpdate.mockResolvedValue(updatedItem);

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.price).toBe(updateData.price);
    });

    it('should return 404 for non-existent item', async () => {
      Item.findByIdAndUpdate.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Item not found');
    });

    it('should validate update data', async () => {
      const invalidData = {
        price: -50
      };

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  // TC-005: Delete item
  describe('DELETE /api/items/:id - TC-005: Item Deletion', () => {
    const itemId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      Item.findByIdAndDelete = jest.fn();
    });

    it('should delete an existing item', async () => {
      Item.findByIdAndDelete.mockResolvedValue(mockItems[0]);

      const response = await request(app)
        .delete(`/api/items/${itemId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Item deleted successfully');
      expect(Item.findByIdAndDelete).toHaveBeenCalledWith(itemId.toString());
    });

    it('should return 404 for non-existent item', async () => {
      Item.findByIdAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/items/${itemId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Item not found');
    });

    it('should handle database errors during deletion', async () => {
      Item.findByIdAndDelete.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/items/${itemId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  // TC-006: Bulk operations
  describe('POST /api/items/bulk-delete - TC-006: Bulk Operations', () => {
    beforeEach(() => {
      Item.deleteMany = jest.fn();
    });

    it('should delete multiple items', async () => {
      const itemIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ];

      Item.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const response = await request(app)
        .post('/api/items/bulk-delete')
        .send({ itemIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(2);
      expect(Item.deleteMany).toHaveBeenCalledWith({
        _id: { $in: itemIds }
      });
    });

    it('should return 400 for empty item IDs array', async () => {
      const response = await request(app)
        .post('/api/items/bulk-delete')
        .send({ itemIds: [] })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid item IDs', async () => {
      const response = await request(app)
        .post('/api/items/bulk-delete')
        .send({ itemIds: ['invalid-id'] })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  // TC-010: Role-based access control
  describe('Role-based Access Control - TC-010', () => {
    it('should deny access to non-admin users', async () => {
      require('../../middleware/auth').mockImplementation((req, res, next) => {
        req.user = { ...mockAdmin, role: 'customer' };
        next();
      });

      const response = await request(app)
        .get('/api/items')
        .expect(403);

      expect(response.body.message).toBe('Admin access required');
    });

    it('should allow access to admin users', async () => {
      Item.countDocuments = jest.fn().mockResolvedValue(0);
      Item.find = jest.fn().mockReturnThis();
      Item.select = jest.fn().mockReturnThis();
      Item.sort = jest.fn().mockReturnThis();
      Item.skip = jest.fn().mockReturnThis();
      Item.limit = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication for all routes', async () => {
      require('../../middleware/auth').mockImplementation((req, res, next) => {
        res.status(401).json({ message: 'Authentication required' });
      });

      const response = await request(app)
        .get('/api/items')
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });
});