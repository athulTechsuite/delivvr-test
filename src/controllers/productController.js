const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { validationResult } = require('express-validator');

// Audit logging helper
const logAuditAction = async (action, userId, resourceType, resourceId, details = {}) => {
  try {
    await AuditLog.create({
      action,
      userId,
      resourceType,
      resourceId,
      details,
      timestamp: new Date(),
      ipAddress: details.ipAddress
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

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
    if (req.query.vendor) {
      filter.vendor = req.query.vendor;
    }
    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(',') };
    }

    // Admin-specific filters
    if (req.user && req.user.role === 'admin') {
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === 'true';
      }
      if (req.query.stockStatus) {
        switch (req.query.stockStatus) {
          case 'inStock':
            filter.stock = { $gt: 0 };
            break;
          case 'outOfStock':
            filter.stock = { $lte: 0 };
            break;
          case 'lowStock':
            filter.stock = { $gt: 0, $lte: 10 };
            break;
        }
      }
    } else {
      // Only show active products for non-admin users
      filter.isActive = true;
      filter.stock = { $gt: 0 };
    }

    // Build sort object
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      sort = { [sortField]: sortOrder };
    }

    const products = await Product.find(filter)
      .populate('vendor', 'name email')
      .sort(sort)
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
      isActive: true
    });

    await product.save();
    
    const populatedProduct = await Product.findById(product._id)
      .populate('vendor', 'name email');

    // Log audit action
    await logAuditAction(
      'create',
      req.user.id,
      'product',
      product._id,
      {
        productName: name,
        category,
        price,
        ipAddress: req.ip
      }
    );

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

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('vendor', 'name email');

    // Log audit action
    await logAuditAction(
      'update',
      req.user.id,
      'product',
      id,
      {
        productName: product.name,
        changes,
        ipAddress: req.ip
      }
    );

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
    product.updatedAt = new Date();
    await product.save();

    // Log audit action
    await logAuditAction(
      'delete',
      req.user.id,
      'product',
      id,
      {
        productName: product.name,
        category: product.category,
        ipAddress: req.ip
      }
    );

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

// Bulk update products (admin only)
const bulkUpdateProducts = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for bulk operations'
      });
    }

    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs are required'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Updates object is required'
      });
    }

    const allowedUpdates = ['category', 'isActive', 'tags'];
    const validUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        validUpdates[key] = updates[key];
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }

    validUpdates.updatedAt = new Date();

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: validUpdates }
    );

    // Log audit action for bulk update
    await logAuditAction(
      'bulk_update',
      req.user.id,
      'product',
      null,
      {
        productIds,
        updates: validUpdates,
        modifiedCount: result.modifiedCount,
        ipAddress: req.ip
      }
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} products`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update products',
      error: error.message
    });
  }
};

// Bulk delete products (admin only)
const bulkDeleteProducts = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for bulk operations'
      });
    }

    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs are required'
      });
    }

    // Get product names for audit log
    const products = await Product.find({ _id: { $in: productIds } }, 'name category');

    // Soft delete by setting isActive to false
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date() 
        } 
      }
    );

    // Log audit action for bulk delete
    await logAuditAction(
      'bulk_delete',
      req.user.id,
      'product',
      null,
      {
        productIds,
        products: products.map(p => ({ id: p._id, name: p.name, category: p.category })),
        modifiedCount: result.modifiedCount,
        ipAddress: req.ip
      }
    );

    res.json({
      success: true,
      message: `Successfully deleted ${result.modifiedCount} products`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk delete products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk delete products',
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

// Get product statistics (admin only)
const getProductStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ stock: { $lte: 0 }, isActive: true }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 10 }, isActive: true }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, avgPrice: { $avg: '$price' }, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        activeProducts: stats[0],
        inactiveProducts: stats[1],
        outOfStock: stats[2],
        lowStock: stats[3],
        categoryCounts: stats[4],
        priceStats: stats[5][0] || { avgPrice: 0, totalValue: 0 }
      }
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product statistics',
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

    await product.save();

    const updatedProduct = await Product.findById(id)
      .populate('vendor', 'name email')
      .populate('reviews.user', 'name');

    // Log audit action
    await logAuditAction(
      'review',
      req.user.id,
      'product',
      id,
      {
        productName: product.name,
        rating,
        ipAddress: req.ip
      }
    );

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
  bulkUpdateProducts,
  bulkDeleteProducts,
  getVendorProducts,
  getCategories,
  getProductStats,
  addReview
};