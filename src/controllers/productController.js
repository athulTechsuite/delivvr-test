const Product = require('../models/Product');
const { validationResult } = require('express-validator');

// Get all products with filtering and pagination
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Only show active products for non-admin users
    if (!req.user || req.user.role !== 'admin') {
      filter.isActive = true;
      filter.stock = { $gt: 0 };
    }

    const products = await Product.find(filter)
      .populate('vendor', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

// Admin dashboard: Get all items with comprehensive data
const getAdminDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter object for admin dashboard
    const filter = {};
    
    // Status filter
    if (req.query.status) {
      if (req.query.status === 'active') {
        filter.isActive = true;
      } else if (req.query.status === 'inactive') {
        filter.isActive = false;
      }
    }
    
    // Stock filter
    if (req.query.stockLevel) {
      switch (req.query.stockLevel) {
        case 'outOfStock':
          filter.stock = 0;
          break;
        case 'lowStock':
          filter.stock = { $gt: 0, $lte: 10 };
          break;
        case 'inStock':
          filter.stock = { $gt: 10 };
          break;
      }
    }
    
    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    
    // Search filter
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { 'vendor.name': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        filter.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.createdAt.$lte = new Date(req.query.dateTo);
      }
    }

    const sortOptions = {};
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'name':
          sortOptions.name = req.query.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'price':
          sortOptions.price = req.query.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'stock':
          sortOptions.stock = req.query.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'created':
          sortOptions.createdAt = req.query.sortOrder === 'desc' ? -1 : 1;
          break;
        default:
          sortOptions.createdAt = -1;
      }
    } else {
      sortOptions.createdAt = -1;
    }

    const products = await Product.find(filter)
      .populate('vendor', 'name email phone')
      .select('name description price category stock isActive images averageRating createdAt updatedAt auditTrail')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    // Get dashboard statistics
    const stats = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ stock: 0 }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 10 } }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } }
      ])
    ]);

    const dashboardStats = {
      totalItems: total,
      activeItems: stats[0],
      inactiveItems: stats[1],
      outOfStockItems: stats[2],
      lowStockItems: stats[3],
      totalInventoryValue: stats[4][0]?.totalValue || 0
    };

    res.json({
      success: true,
      data: {
        items: products,
        statistics: dashboardStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard data',
      error: error.message
    });
  }
};

// Bulk operations for admin
const bulkUpdateProducts = async (req, res) => {
  try {
    const { operation, productIds, updateData } = req.body;
    
    if (!operation || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk operation parameters'
      });
    }

    let updateQuery = {};
    let successMessage = '';

    switch (operation) {
      case 'activate':
        updateQuery = { 
          isActive: true, 
          updatedAt: new Date(),
          $push: {
            auditTrail: {
              action: 'bulk_activate',
              performedBy: req.user.id,
              performedAt: new Date(),
              changes: { isActive: true }
            }
          }
        };
        successMessage = `${productIds.length} products activated successfully`;
        break;
      case 'deactivate':
        updateQuery = { 
          isActive: false, 
          updatedAt: new Date(),
          $push: {
            auditTrail: {
              action: 'bulk_deactivate',
              performedBy: req.user.id,
              performedAt: new Date(),
              changes: { isActive: false }
            }
          }
        };
        successMessage = `${productIds.length} products deactivated successfully`;
        break;
      case 'updateCategory':
        if (!updateData.category) {
          return res.status(400).json({
            success: false,
            message: 'Category is required for bulk category update'
          });
        }
        updateQuery = { 
          category: updateData.category, 
          updatedAt: new Date(),
          $push: {
            auditTrail: {
              action: 'bulk_category_update',
              performedBy: req.user.id,
              performedAt: new Date(),
              changes: { category: updateData.category }
            }
          }
        };
        successMessage = `${productIds.length} products category updated successfully`;
        break;
      case 'delete':
        updateQuery = { 
          isActive: false, 
          deletedAt: new Date(),
          updatedAt: new Date(),
          $push: {
            auditTrail: {
              action: 'bulk_delete',
              performedBy: req.user.id,
              performedAt: new Date(),
              changes: { isActive: false, deletedAt: new Date() }
            }
          }
        };
        successMessage = `${productIds.length} products deleted successfully`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid bulk operation'
        });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      updateQuery
    );

    res.json({
      success: true,
      message: successMessage,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operation',
      error: error.message
    });
  }
};

// Get audit trail for a product
const getProductAuditTrail = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .select('name auditTrail')
      .populate('auditTrail.performedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: {
        productName: product.name,
        auditTrail: product.auditTrail.sort((a, b) => b.performedAt - a.performedAt)
      }
    });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit trail',
      error: error.message
    });
  }
};

// Get single product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id)
      .populate('vendor', 'name email')
      .populate('reviews.user', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is accessible to current user
    if (!req.user || req.user.role !== 'admin') {
      if (!product.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Product not available'
        });
      }
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

// Create new product (admin/vendor only)
const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      price,
      category,
      stock,
      images,
      specifications,
      tags
    } = req.body;

    // Set vendor based on user role
    let vendorId = req.user.id;
    if (req.user.role === 'admin' && req.body.vendor) {
      vendorId = req.body.vendor;
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      stock,
      images: images || [],
      specifications: specifications || {},
      tags: tags || [],
      vendor: vendorId,
      isActive: true,
      auditTrail: [{
        action: 'create',
        performedBy: req.user.id,
        performedAt: new Date(),
        changes: { created: true }
      }]
    });

    await product.save();
    
    const populatedProduct = await Product.findById(product._id)
      .populate('vendor', 'name email');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: populatedProduct
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

// Update product (admin/vendor owner only)
const updateProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && product.vendor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    const allowedUpdates = [
      'name', 'description', 'price', 'category', 'stock', 
      'images', 'specifications', 'tags', 'isActive'
    ];
    
    const updates = {};
    const changes = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        changes[field] = { from: product[field], to: req.body[field] };
        updates[field] = req.body[field];
      }
    });

    // Only admin can change vendor
    if (req.user.role === 'admin' && req.body.vendor) {
      changes.vendor = { from: product.vendor, to: req.body.vendor };
      updates.vendor = req.body.vendor;
    }

    updates.updatedAt = new Date();
    
    // Add audit trail entry
    updates.$push = {
      auditTrail: {
        action: 'update',
        performedBy: req.user.id,
        performedAt: new Date(),
        changes: changes
      }
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('vendor', 'name email');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

// Delete product (admin/vendor owner only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && product.vendor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    product.deletedAt = new Date();
    product.updatedAt = new Date();
    
    // Add audit trail entry
    product.auditTrail.push({
      action: 'delete',
      performedBy: req.user.id,
      performedAt: new Date(),
      changes: { isActive: false, deletedAt: new Date() }
    });
    
    await product.save();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

// Get products by vendor (vendor/admin only)
const getVendorProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Determine which vendor's products to fetch
    let vendorId = req.user.id;
    if (req.user.role === 'admin' && req.params.vendorId) {
      vendorId = req.params.vendorId;
    }

    const filter = { vendor: vendorId };
    
    // Apply additional filters
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const products = await Product.find(filter)
      .populate('vendor', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor products',
      error: error.message
    });
  }
};

// Get product categories
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// Add product review (customers only)
const addReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Add new review
    product.reviews.push({
      user: req.user.id,
      rating,
      comment,
      createdAt: new Date()
    });

    // Update average rating
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
    product.averageRating = totalRating / product.reviews.length;

    // Add audit trail entry
    product.auditTrail.push({
      action: 'review_added',
      performedBy: req.user.id,
      performedAt: new Date(),
      changes: { rating, comment }
    });

    await product.save();

    const updatedProduct = await Product.findById(id)
      .populate('vendor', 'name email')
      .populate('reviews.user', 'name');

    res.json({
      success: true,
      message: 'Review added successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  getCategories,
  addReview,
  getAdminDashboard,
  bulkUpdateProducts,
  getProductAuditTrail
};