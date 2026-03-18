const Item = require('../models/Item');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

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

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// File size limit (200KB)
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 // 200KB
  }
});

// Get all items with pagination, search, and filters
const getAllItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const items = await Item.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalItems = await Item.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items',
      error: error.message
    });
  }
};

// Get single item by ID
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item',
      error: error.message
    });
  }
};

// Create new item
const createItem = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      availableCount,
      status,
      tags
    } = req.body;

    // Validate required fields
    if (!name || !description || !category || !price || availableCount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, category, price, availableCount'
      });
    }

    const itemData = {
      name,
      description,
      category,
      price: parseFloat(price),
      availableCount: parseInt(availableCount),
      status: status || 'active',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    // Handle image upload if present
    if (req.file) {
      itemData.imageUrl = `/uploads/items/${req.file.filename}`;
    }

    const item = new Item(itemData);
    await item.save();

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating item:', error);
    
    // Clean up uploaded file if item creation fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create item',
      error: error.message
    });
  }
};

// Update existing item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      price,
      availableCount,
      status,
      tags
    } = req.body;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store old image path for cleanup
    const oldImagePath = item.imageUrl;

    // Update item data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (availableCount !== undefined) updateData.availableCount = parseInt(availableCount);
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags.split(',').map(tag => tag.trim());

    // Handle new image upload
    if (req.file) {
      updateData.imageUrl = `/uploads/items/${req.file.filename}`;
      
      // Clean up old image file
      if (oldImagePath && oldImagePath.startsWith('/uploads/')) {
        try {
          await fs.unlink(path.join('.', oldImagePath));
        } catch (unlinkError) {
          console.error('Error deleting old image:', unlinkError);
        }
      }
    }

    updateData.updatedAt = new Date();

    const updatedItem = await Item.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Error updating item:', error);
    
    // Clean up uploaded file if update fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update item',
      error: error.message
    });
  }
};

// Delete item
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store image path for cleanup
    const imagePath = item.imageUrl;

    // Delete item from database
    await Item.findByIdAndDelete(id);

    // Clean up image file
    if (imagePath && imagePath.startsWith('/uploads/')) {
      try {
        await fs.unlink(path.join('.', imagePath));
      } catch (unlinkError) {
        console.error('Error deleting image file:', unlinkError);
      }
    }

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item',
      error: error.message
    });
  }
};

// Get item statistics
const getItemStats = async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const activeItems = await Item.countDocuments({ status: 'active' });
    const inactiveItems = await Item.countDocuments({ status: 'inactive' });
    const outOfStockItems = await Item.countDocuments({ availableCount: 0 });
    const lowStockItems = await Item.countDocuments({ 
      availableCount: { $gt: 0, $lte: 10 } 
    });

    // Get category distribution
    const categoryStats = await Item.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$availableCount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalItems,
          activeItems,
          inactiveItems,
          outOfStockItems,
          lowStockItems
        },
        categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching item statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item statistics',
      error: error.message
    });
  }
};

// Bulk update item status
const bulkUpdateStatus = async (req, res) => {
  try {
    const { itemIds, status } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'itemIds array is required'
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either "active" or "inactive"'
      });
    }

    const result = await Item.updateMany(
      { _id: { $in: itemIds } },
      { status, updatedAt: new Date() }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} items updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error bulk updating items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update items',
      error: error.message
    });
  }
};

module.exports = {
  getAllItems,
  getItemById,
  createItem: [upload.single('image'), createItem],
  updateItem: [upload.single('image'), updateItem],
  deleteItem,
  getItemStats,
  bulkUpdateStatus
};