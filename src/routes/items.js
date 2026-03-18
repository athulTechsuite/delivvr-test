const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Item = require('../models/Item');

// Get all items with pagination, search, and filtering
router.get('/', 
  auth, 
  adminAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('category').optional().trim(),
    query('status').optional().isIn(['active', 'inactive', 'draft']),
    query('sortBy').optional().isIn(['name', 'category', 'status', 'createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';
      const category = req.query.category || '';
      const status = req.query.status || '';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

      // Build filter object
      const filter = {};
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (category) {
        filter.category = category;
      }

      if (status) {
        filter.status = status;
      }

      // Get total count for pagination
      const total = await Item.countDocuments(filter);

      // Get items with pagination and sorting
      const items = await Item.find(filter)
        .select('name category status price description imageUrl createdAt updatedAt')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email');

      // Get available categories for filtering
      const categories = await Item.distinct('category');

      res.json({
        items,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        },
        categories
      });
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get single item by ID
router.get('/:id', 
  auth, 
  adminAuth,
  async (req, res) => {
    try {
      const item = await Item.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error fetching item:', error);
      if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Item not found' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Create new item
router.post('/',
  auth,
  adminAuth,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().trim(),
    body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Invalid status'),
    body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
    body('inventory').optional().isInt({ min: 0 }).withMessage('Inventory must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, category, price, description, status, imageUrl, inventory } = req.body;

      // Check if item with same name already exists
      const existingItem = await Item.findOne({ name: name.trim() });
      if (existingItem) {
        return res.status(400).json({ message: 'Item with this name already exists' });
      }

      const item = new Item({
        name: name.trim(),
        category: category.trim(),
        price,
        description: description ? description.trim() : '',
        status: status || 'draft',
        imageUrl: imageUrl || '',
        inventory: inventory || 0,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });

      await item.save();
      
      // Populate user data before sending response
      await item.populate('createdBy', 'name email');

      res.status(201).json({
        message: 'Item created successfully',
        item
      });
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update item
router.put('/:id',
  auth,
  adminAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().trim(),
    body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Invalid status'),
    body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
    body('inventory').optional().isInt({ min: 0 }).withMessage('Inventory must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const item = await Item.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      const { name, category, price, description, status, imageUrl, inventory } = req.body;

      // Check if another item with same name exists (excluding current item)
      if (name && name.trim() !== item.name) {
        const existingItem = await Item.findOne({ 
          name: name.trim(), 
          _id: { $ne: req.params.id } 
        });
        if (existingItem) {
          return res.status(400).json({ message: 'Item with this name already exists' });
        }
      }

      // Update fields
      if (name) item.name = name.trim();
      if (category) item.category = category.trim();
      if (price !== undefined) item.price = price;
      if (description !== undefined) item.description = description.trim();
      if (status) item.status = status;
      if (imageUrl !== undefined) item.imageUrl = imageUrl;
      if (inventory !== undefined) item.inventory = inventory;
      
      item.updatedBy = req.user.id;
      item.updatedAt = new Date();

      await item.save();
      
      // Populate user data before sending response
      await item.populate(['createdBy', 'updatedBy'], 'name email');

      res.json({
        message: 'Item updated successfully',
        item
      });
    } catch (error) {
      console.error('Error updating item:', error);
      if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Item not found' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Delete single item
router.delete('/:id',
  auth,
  adminAuth,
  async (req, res) => {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      await Item.findByIdAndDelete(req.params.id);

      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Error deleting item:', error);
      if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Item not found' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Bulk operations
router.post('/bulk',
  auth,
  adminAuth,
  [
    body('action').isIn(['delete', 'updateStatus']).withMessage('Invalid bulk action'),
    body('itemIds').isArray({ min: 1 }).withMessage('Item IDs array is required'),
    body('itemIds.*').isMongoId().withMessage('Invalid item ID format'),
    body('status').if(body('action').equals('updateStatus'))
      .isIn(['active', 'inactive', 'draft']).withMessage('Invalid status for bulk update')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { action, itemIds, status } = req.body;

      // Verify all items exist
      const items = await Item.find({ _id: { $in: itemIds } });
      if (items.length !== itemIds.length) {
        return res.status(400).json({ message: 'Some items not found' });
      }

      let result;
      let message;

      if (action === 'delete') {
        result = await Item.deleteMany({ _id: { $in: itemIds } });
        message = `${result.deletedCount} item(s) deleted successfully`;
      } else if (action === 'updateStatus') {
        result = await Item.updateMany(
          { _id: { $in: itemIds } },
          { 
            status,
            updatedBy: req.user.id,
            updatedAt: new Date()
          }
        );
        message = `${result.modifiedCount} item(s) status updated successfully`;
      }

      res.json({
        message,
        affected: result.deletedCount || result.modifiedCount
      });
    } catch (error) {
      console.error('Error in bulk operation:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;