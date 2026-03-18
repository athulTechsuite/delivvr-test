const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 // 200KB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all products (public route)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, minPrice, maxPrice } = req.query;
    
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

// Get products by vendor (vendor only - their own products)
router.get('/vendor/my-products', auth, roleAuth(['vendor']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const query = { vendor: req.user.userId };
    
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

// Admin dashboard: Get all products with enhanced filtering and pagination
router.get('/admin/dashboard', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category, 
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Status filter
    if (status === 'active') {
      query.active = true;
    } else if (status === 'inactive') {
      query.active = false;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        { path: 'vendor', select: 'name email' }
      ]
    };
    
    const products = await Product.paginate(query, options);
    
    // Add summary statistics
    const totalProducts = await Product.countDocuments({});
    const activeProducts = await Product.countDocuments({ active: true });
    const inactiveProducts = await Product.countDocuments({ active: false });
    
    res.json({
      success: true,
      data: {
        ...products,
        statistics: {
          total: totalProducts,
          active: activeProducts,
          inactive: inactiveProducts
        }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Bulk delete products
router.post('/admin/bulk-delete', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }
    
    // Validate product IDs
    const validIds = productIds.filter(id => id && typeof id === 'string');
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid product IDs provided'
      });
    }
    
    // Soft delete - mark as inactive
    const result = await Product.updateMany(
      { _id: { $in: validIds } },
      { 
        active: false,
        updatedAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} products deleted successfully`,
      data: {
        deletedCount: result.modifiedCount,
        requestedCount: validIds.length
      }
    });
  } catch (error) {
    console.error('Bulk delete products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Bulk update product status
router.post('/admin/bulk-status', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { productIds, active } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Active status (boolean) is required'
      });
    }
    
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { 
        active: active,
        updatedAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      data: {
        updatedCount: result.modifiedCount,
        newStatus: active ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Bulk update products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Upload product image
router.post('/upload-image', auth, roleAuth(['admin', 'vendor']), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../public/uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Save file
    fs.writeFileSync(filePath, req.file.buffer);
    
    // Return file URL
    const imageUrl = `/uploads/products/${fileName}`;
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        filename: fileName,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({
        success: false,
        message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed'
      });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size must be less than 200KB'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Image upload failed'
    });
  }
});

// Get all products for admin (including inactive ones)
router.get('/admin/all', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    const query = {};
    
    if (status === 'active') {
      query.active = true;
    } else if (status === 'inactive') {
      query.active = false;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'vendor'
    };
    
    const products = await Product.paginate(query, options);
    
    res.json({
      success: true,
      data: products
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
    
    product.inventory = quantity;
    product.updatedAt = new Date();
    
    await product.save();
    
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

module.exports = router;