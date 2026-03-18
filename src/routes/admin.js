const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/items/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Validation rules for item creation/update
const itemValidationRules = () => {
  return [
    body('name')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Item name must be between 1 and 255 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Description must be between 1 and 1000 characters'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('category')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Category must be between 1 and 100 characters'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'draft'])
      .withMessage('Status must be active, inactive, or draft'),
    body('inventory_count')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Inventory count must be a non-negative integer')
  ];
};

// Helper function to log admin actions
const logAuditAction = async (userId, action, resourceType, resourceId, details = {}) => {
  try {
    await AuditLog.create({
      user_id: userId,
      action: action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: JSON.stringify(details),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};

// GET /api/admin/items - List all items with pagination, search, and filters
router.get('/items', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    // Apply search filter
    if (search) {
      whereConditions.name = {
        [require('sequelize').Op.iLike]: `%${search}%`
      };
    }

    // Apply category filter
    if (category) {
      whereConditions.category = category;
    }

    // Apply status filter
    if (status) {
      whereConditions.status = status;
    }

    const { count, rows: items } = await Item.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: [
        'id', 'name', 'description', 'price', 'category', 
        'status', 'inventory_count', 'image_url', 'created_at', 'updated_at'
      ]
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: count,
          items_per_page: parseInt(limit),
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/items/:id - Get single item details
router.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: { item }
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/admin/items - Create new item
router.post('/items', upload.single('image'), itemValidationRules(), async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      price,
      category,
      status = 'active',
      inventory_count = 0
    } = req.body;

    const itemData = {
      name,
      description,
      price: parseFloat(price),
      category,
      status,
      inventory_count: parseInt(inventory_count),
      created_by: req.user.id
    };

    // Add image URL if uploaded
    if (req.file) {
      itemData.image_url = `/uploads/items/${req.file.filename}`;
    }

    const item = await Item.create(itemData);

    // Log audit action
    await logAuditAction(
      req.user.id,
      'CREATE',
      'item',
      item.id,
      { item_name: name, category }
    );

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: { item }
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/admin/items/:id - Update existing item
router.put('/items/:id', upload.single('image'), itemValidationRules(), async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const {
      name,
      description,
      price,
      category,
      status,
      inventory_count
    } = req.body;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store original values for audit log
    const originalValues = {
      name: item.name,
      price: item.price,
      category: item.category,
      status: item.status
    };

    const updateData = {
      name,
      description,
      price: parseFloat(price),
      category,
      status,
      inventory_count: parseInt(inventory_count),
      updated_by: req.user.id
    };

    // Update image URL if new image uploaded
    if (req.file) {
      updateData.image_url = `/uploads/items/${req.file.filename}`;
    }

    await item.update(updateData);

    // Log audit action
    await logAuditAction(
      req.user.id,
      'UPDATE',
      'item',
      item.id,
      { 
        original: originalValues,
        updated: { name, price, category, status }
      }
    );

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: { item }
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/admin/items/:id - Delete item
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store item data for audit log before deletion
    const itemData = {
      name: item.name,
      category: item.category,
      price: item.price
    };

    await item.destroy();

    // Log audit action
    await logAuditAction(
      req.user.id,
      'DELETE',
      'item',
      id,
      itemData
    );

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/categories - Get all unique categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Item.findAll({
      attributes: ['category'],
      group: ['category'],
      raw: true
    });

    const categoryList = categories.map(cat => cat.category).filter(Boolean);

    res.json({
      success: true,
      data: { categories: categoryList }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalItems = await Item.count();
    const activeItems = await Item.count({ where: { status: 'active' } });
    const inactiveItems = await Item.count({ where: { status: 'inactive' } });
    const draftItems = await Item.count({ where: { status: 'draft' } });
    const lowStockItems = await Item.count({ 
      where: { 
        inventory_count: { [require('sequelize').Op.lt]: 10 },
        status: 'active'
      } 
    });

    res.json({
      success: true,
      data: {
        stats: {
          total_items: totalItems,
          active_items: activeItems,
          inactive_items: inactiveItems,
          draft_items: draftItems,
          low_stock_items: lowStockItems
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;