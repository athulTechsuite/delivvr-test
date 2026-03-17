const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

// Helper function to log audit actions
const logAuditAction = async (userId, action, resource, resourceId, details = {}) => {
  try {
    const auditLog = new AuditLog({
      userId,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date()
    });
    await auditLog.save();
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

// Get all products (public route)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = { active: true };
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortObj
    };
    
    const products = await Product.paginate(query, options);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get single product by ID (public route)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendor', 'name email');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new product (admin/vendor only)
router.post('/', auth, roleAuth(['admin', 'vendor']), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      images,
      inventory,
      specifications,
      weight,
      dimensions
    } = req.body;
    
    // Validation
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, and category are required'
      });
    }
    
    const productData = {
      name,
      description,
      price: parseFloat(price),
      category,
      images: images || [],
      inventory: inventory || 0,
      specifications: specifications || {},
      weight,
      dimensions,
      vendor: req.user.role === 'vendor' ? req.user.userId : null,
      active: true
    };
    
    const product = new Product(productData);
    await product.save();
    
    // Log audit action
    await logAuditAction(req.user.userId, 'CREATE', 'product', product._id, {
      productName: name,
      category,
      price
    });
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update product (admin or product owner vendor only)
router.put('/:id', auth, roleAuth(['admin', 'vendor']), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if vendor is trying to update their own product
    if (req.user.role === 'vendor' && product.vendor.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own products'
      });
    }
    
    const originalData = { ...product.toObject() };
    
    const {
      name,
      description,
      price,
      category,
      images,
      inventory,
      specifications,
      weight,
      dimensions,
      active
    } = req.body;
    
    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (images) product.images = images;
    if (inventory !== undefined) product.inventory = inventory;
    if (specifications) product.specifications = specifications;
    if (weight) product.weight = weight;
    if (dimensions) product.dimensions = dimensions;
    if (active !== undefined) product.active = active;
    
    product.updatedAt = new Date();
    
    await product.save();
    
    // Log audit action with changes
    const changes = {};
    Object.keys(req.body).forEach(key => {
      if (originalData[key] !== product[key]) {
        changes[key] = { from: originalData[key], to: product[key] };
      }
    });
    
    await logAuditAction(req.user.userId, 'UPDATE', 'product', product._id, {
      productName: product.name,
      changes
    });
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete product (admin or product owner vendor only)
router.delete('/:id', auth, roleAuth(['admin', 'vendor']), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if vendor is trying to delete their own product
    if (req.user.role === 'vendor' && product.vendor.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own products'
      });
    }
    
    // Soft delete - just mark as inactive
    product.active = false;
    product.updatedAt = new Date();
    await product.save();
    
    // Log audit action
    await logAuditAction(req.user.userId, 'DELETE', 'product', product._id, {
      productName: product.name,
      category: product.category
    });
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk operations for admin
router.post('/bulk', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { action, productIds, updateData } = req.body;
    
    if (!action || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Action and product IDs are required'
      });
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    if (action === 'delete') {
      // Bulk soft delete
      const updateResult = await Product.updateMany(
        { _id: { $in: productIds } },
        { active: false, updatedAt: new Date() }
      );
      
      results.success = updateResult.modifiedCount;
      results.failed = productIds.length - updateResult.modifiedCount;
      
      // Log audit action for bulk delete
      await logAuditAction(req.user.userId, 'BULK_DELETE', 'product', null, {
        productIds,
        count: updateResult.modifiedCount
      });
      
    } else if (action === 'update' && updateData) {
      // Bulk update
      const allowedFields = ['category', 'active', 'price', 'inventory'];
      const updateFields = {};
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields[key] = updateData[key];
        }
      });
      
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid update fields provided'
        });
      }
      
      updateFields.updatedAt = new Date();
      
      const updateResult = await Product.updateMany(
        { _id: { $in: productIds } },
        updateFields
      );
      
      results.success = updateResult.modifiedCount;
      results.failed = productIds.length - updateResult.modifiedCount;
      
      // Log audit action for bulk update
      await logAuditAction(req.user.userId, 'BULK_UPDATE', 'product', null, {
        productIds,
        updateFields,
        count: updateResult.modifiedCount
      });
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action or missing update data'
      });
    }
    
    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: results
    });
    
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk operation'
    });
  }
});

// Get products by vendor (vendor only - their own products)
router.get('/vendor/my-products', auth, roleAuth(['vendor']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, status } = req.query;
    
    const query = { vendor: req.user.userId };
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add status filter
    if (status === 'active') {
      query.active = true;
    } else if (status === 'inactive') {
      query.active = false;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const products = await Product.paginate(query, options);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all products for admin (including inactive ones)
router.get('/admin/all', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'all', 
      search, 
      category, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      vendor
    } = req.query;
    
    const query = {};
    
    if (status === 'active') {
      query.active = true;
    } else if (status === 'inactive') {
      query.active = false;
    }
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add vendor filter
    if (vendor) {
      query.vendor = vendor;
    }
    
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortObj,
      populate: 'vendor'
    };
    
    const products = await Product.paginate(query, options);
    
    // Get summary statistics
    const totalProducts = await Product.countDocuments({});
    const activeProducts = await Product.countDocuments({ active: true });
    const inactiveProducts = await Product.countDocuments({ active: false });
    
    res.json({
      success: true,
      data: products,
      summary: {
        total: totalProducts,
        active: activeProducts,
        inactive: inactiveProducts
      }
    });
  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get product categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { active: true });
    
    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update product inventory (admin/vendor only)
router.patch('/:id/inventory', auth, roleAuth(['admin', 'vendor']), async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if vendor is trying to update their own product
    if (req.user.role === 'vendor' && product.vendor.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own products'
      });
    }
    
    const oldQuantity = product.inventory;
    product.inventory = quantity;
    product.updatedAt = new Date();
    
    await product.save();
    
    // Log audit action
    await logAuditAction(req.user.userId, 'UPDATE_INVENTORY', 'product', product._id, {
      productName: product.name,
      oldQuantity,
      newQuantity: quantity
    });
    
    res.json({
      success: true,
      message: 'Inventory updated successfully',
      data: { inventory: product.inventory }
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get audit logs for products (admin only)
router.get('/admin/audit-logs', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, userId, action } = req.query;
    
    const query = { resource: 'product' };
    
    if (productId) {
      query.resourceId = productId;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (action) {
      query.action = action;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { timestamp: -1 },
      populate: 'userId'
    };
    
    const auditLogs = await AuditLog.paginate(query, options);
    
    res.json({
      success: true,
      data: auditLogs
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;