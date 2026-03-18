const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Product = require('../../models/Product');
const User = require('../../models/User');
const productsRouter = require('../products');
const auth = require('../../middleware/auth');
const roleAuth = require('../../middleware/roleAuth');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/products', productsRouter);

// Mock the middleware
jest.mock('../../middleware/auth');
jest.mock('../../middleware/roleAuth');
jest.mock('../../models/Product');
jest.mock('../../models/User');

describe('Products API Routes', () => {
  let adminToken, userToken, adminUser, regularUser;

  beforeAll(() => {
    adminUser = {
      _id: 'admin123',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true
    };

    regularUser = {
      _id: 'user123',
      email: 'user@test.com',
      role: 'customer',
      isActive: true
    };

    adminToken = jwt.sign({ userId: adminUser._id }, 'test-secret');
    userToken = jwt.sign({ userId: regularUser._id }, 'test-secret');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock auth middleware to pass through
    auth.mockImplementation((req, res, next) => {
      if (req.headers.authorization === `Bearer ${adminToken}`) {
        req.user = adminUser;
      } else if (req.headers.authorization === `Bearer ${userToken}`) {
        req.user = regularUser;
      }
      next();
    });

    roleAuth.requireAdmin.mockImplementation((req, res, next) => {
      if (req.user && req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Admin access required' });
      }
    });
  });

  // TC-001: Dashboard displays a list of all items with pagination (20 items per page)
  describe('GET /api/products - TC-001: Pagination', () => {
    test('should return products with pagination for admin users', async () => {
      const mockProducts = Array.from({ length: 25 }, (_, i) => ({
        _id: `product${i}`,
        name: `Product ${i}`,
        description: `Description ${i}`,
        category: 'electronics',
        price: 99.99 + i,
        isActive: true,
        createdAt: new Date()
      }));

      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockProducts.slice(0, 20))
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(25);

      const response = await request(app)
        .get('/api/products?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(20);
      expect(response.body.data.pagination.totalItems).toBe(25);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    test('should default to page 1 and limit 20 for admin users', async () => {
      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Product.find().populate().sort().skip).toHaveBeenCalledWith(0);
      expect(Product.find().populate().sort().skip().limit).toHaveBeenCalledWith(20);
    });
  });

  // TC-002: Search functionality allows filtering by item name, category, and status
  describe('GET /api/products - TC-002: Search and Filtering', () => {
    test('should filter products by search term', async () => {
      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/products?search=laptop')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'laptop', $options: 'i' } },
            { description: { $regex: 'laptop', $options: 'i' } }
          ]
        })
      );
    });

    test('should filter products by category', async () => {
      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/products?category=electronics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'electronics'
        })
      );
    });

    test('should filter products by status for admin users', async () => {
      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/products?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false
        })
      );
    });

    test('should only show active products for non-admin users', async () => {
      Product.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Product.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          stock: { $gt: 0 }
        })
      );
    });
  });

  // TC-003: Create new item form with fields for name, description, category, price, and image upload
  describe('POST /api/products - TC-003: Create Product', () => {
    test('should create new product with valid data', async () => {
      const newProduct = {
        name: 'New Product',
        description: 'Product description',
        category: 'electronics',
        price: 199.99,
        isActive: true
      };

      const mockCreatedProduct = {
        _id: 'newproduct123',
        ...newProduct,
        createdAt: new Date()
      };

      Product.prototype.save = jest.fn().mockResolvedValue(mockCreatedProduct);

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', newProduct.name)
        .field('description', newProduct.description)
        .field('category', newProduct.category)
        .field('price', newProduct.price.toString())
        .attach('image', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newProduct.name);
    });

    test('should reject creation without admin privileges', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Product',
          description: 'Description',
          category: 'electronics',
          price: 99.99
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  // TC-004: Edit existing items
  describe('PUT /api/products/:id - TC-004: Update Product', () => {
    test('should update existing product', async () => {
      const updatedData = {
        name: 'Updated Product',
        description: 'Updated description',
        price: 299.99
      };

      const mockProduct = {
        _id: 'product123',
        name: 'Original Product',
        save: jest.fn().mockResolvedValue({ ...updatedData, _id: 'product123' })
      };

      Product.findById.mockResolvedValue(mockProduct);

      const response = await request(app)
        .put('/api/products/product123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(mockProduct.save).toHaveBeenCalled();
    });

    test('should return 404 for non-existent product', async () => {
      Product.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Product not found');
    });
  });

  // TC-005: Delete items
  describe('DELETE /api/products/:id - TC-005: Delete Product', () => {
    test('should delete existing product', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Product to Delete'
      };

      Product.findByIdAndDelete.mockResolvedValue(mockProduct);

      const response = await request(app)
        .delete('/api/products/product123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Product deleted successfully');
    });

    test('should return 404 when deleting non-existent product', async () => {
      Product.findByIdAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/products/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Product not found');
    });
  });

  // TC-011: Bulk actions for deleting multiple items
  describe('DELETE /api/products/bulk - TC-011: Bulk Delete', () => {
    test('should delete multiple products', async () => {
      const productIds = ['product1', 'product2', 'product3'];
      
      Product.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const response = await request(app)
        .delete('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(3);
      expect(Product.deleteMany).toHaveBeenCalledWith({
        _id: { $in: productIds }
      });
    });

    test('should return error for empty product list', async () => {
      const response = await request(app)
        .delete('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No products selected for deletion');
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      Product.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });
  });
});