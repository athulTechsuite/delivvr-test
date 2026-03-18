const Item = require('../models/Item');
const { validationResult } = require('express-validator');
const { uploadToCloudinary } = require('../services/fileUploadService');
const mongoose = require('mongoose');
const DOMPurify = require('isomorphic-dompurify');

// Input sanitization helper
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input.trim());
  }
  return input;
};

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Sanitize query parameters
const sanitizeQueryParams = (query) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(query)) {
    sanitized[key] = sanitizeInput(value);
  }
  return sanitized;
};

// Get all items with pagination, search, and filtering
exports.getAllItems = async (req, res) => {
  try {
    const sanitizedQuery = sanitizeQueryParams(req.query);
    
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = sanitizedQuery;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page parameter'
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter (must be between 1 and 100)'
      });
    }

    // Validate sortBy parameter against allowed fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'status', 'category'];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sortBy parameter'
      });
    }

    // Validate sortOrder parameter
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sortOrder parameter'
      });
    }

    const query = {};
    
    // Search functionality with sanitized input
    if (search) {
      const sanitizedSearch = sanitizeInput(search);
      // Escape regex special characters
      const escapedSearch = sanitizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { sku: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Category filter with ObjectId validation
    if (category) {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID'
        });
      }
      query.category = new mongoose.Types.ObjectId(category);
    }

    // Status filter with allowed values
    if (status) {
      const allowedStatuses = ['active', 'inactive', 'draft'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      query.status = status;
    }

    const options = {
      page: pageNum,
      limit: limitNum,
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'category', select: 'name' },
        { path: 'createdBy', select: 'name email' },
        { path: 'updatedBy', select: 'name email' }
      ]
    };

    const items = await Item.paginate(query, options);

    res.status(200).json({
      success: true,
      data: items,
      message: 'Items retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
};

// Get single item by ID
exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }
    
    const item = await Item.findById(new mongoose.Types.ObjectId(id))
      .populate('category', 'name')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item,
      message: 'Item retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching item',
      error: error.message
    });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Sanitize request body
    const sanitizedBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      sanitizedBody[key] = sanitizeInput(value);
    }

    // Validate user ID
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const itemData = {
      ...sanitizedBody,
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      updatedBy: new mongoose.Types.ObjectId(req.user.id)
    };

    // Validate category if provided
    if (itemData.category && !isValidObjectId(itemData.category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Handle file uploads if present
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file));
      const uploadResults = await Promise.all(uploadPromises);
      itemData.images = uploadResults.map(result => ({
        url: result.secure_url,
        publicId: result.public_id,
        filename: result.original_filename
      }));
    }

    const item = new Item(itemData);
    await item.save();

    // Populate references for response
    await item.populate([
      { path: 'category', select: 'name' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      data: item,
      message: 'Item created successfully'
    });
  } catch (error) {
    console.error('Error creating item:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Item with this ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating item',
      error: error.message
    });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const item = await Item.findById(new mongoose.Types.ObjectId(id));
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Sanitize request body
    const sanitizedBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      sanitizedBody[key] = sanitizeInput(value);
    }

    // Validate user ID
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const updateData = {
      ...sanitizedBody,
      updatedBy: new mongoose.Types.ObjectId(req.user.id),
      updatedAt: new Date()
    };

    // Validate category if provided
    if (updateData.category && !isValidObjectId(updateData.category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Handle new file uploads if present
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file));
      const uploadResults = await Promise.all(uploadPromises);
      const newImages = uploadResults.map(result => ({
        url: result.secure_url,
        publicId: result.public_id,
        filename: result.original_filename
      }));
      
      // Merge with existing images or replace based on request
      if (req.body.replaceImages === 'true') {
        updateData.images = newImages;
      } else {
        updateData.images = [...(item.images || []), ...newImages];
      }
    }

    const updatedItem = await Item.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'category', select: 'name' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    });
  } catch (error) {
    console.error('Error updating item:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Item with this ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating item',
      error: error.message
    });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }
    
    const item = await Item.findById(new mongoose.Types.ObjectId(id));
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    await Item.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting item',
      error: error.message
    });
  }
};

// Bulk operations
exports.bulkUpdateItems = async (req, res) => {
  try {
    const { itemIds, action, updateData } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Item IDs are required'
      });
    }

    // Validate all item IDs
    const validItemIds = [];
    for (const itemId of itemIds) {
      if (!isValidObjectId(itemId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid item ID format in bulk operation'
        });
      }
      validItemIds.push(new mongoose.Types.ObjectId(itemId));
    }

    // Validate action
    const allowedActions = ['delete', 'updateStatus', 'updateCategory'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk action'
      });
    }

    let result;
    const baseUpdateData = {
      updatedBy: new mongoose.Types.ObjectId(req.user.id),
      updatedAt: new Date()
    };

    switch (action) {
      case 'delete':
        result = await Item.deleteMany({ _id: { $in: validItemIds } });
        return res.status(200).json({
          success: true,
          message: `${result.deletedCount} items deleted successfully`,
          deletedCount: result.deletedCount
        });

      case 'updateStatus':
        if (!updateData || !updateData.status) {
          return res.status(400).json({
            success: false,
            message: 'Status is required for status update'
          });
        }
        
        const allowedStatuses = ['active', 'inactive', 'draft'];
        if (!allowedStatuses.includes(updateData.status)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid status value'
          });
        }
        
        result = await Item.updateMany(
          { _id: { $in: validItemIds } },
          { ...baseUpdateData, status: updateData.status }
        );
        break;

      case 'updateCategory':
        if (!updateData || !updateData.category) {
          return res.status(400).json({
            success: false,
            message: 'Category is required for category update'
          });
        }
        
        if (!isValidObjectId(updateData.category)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category ID'
          });
        }
        
        result = await Item.updateMany(
          { _id: { $in: validItemIds } },
          { ...baseUpdateData, category: new mongoose.Types.ObjectId(updateData.category) }
        );
        break;
    }

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} items updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk operation',
      error: error.message
    });
  }
};

// Get item statistics for dashboard
exports.getItemStats = async (req, res) => {
  try {
    const stats = await Item.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          draft: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          }
        }
      }
    ]);

    const categoryStats = await Item.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { categoryName: '$category.name', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const recentItems = await Item.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('category', 'name')
      .populate('createdBy', 'name')
      .select('name status createdAt category createdBy');

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, active: 0, inactive: 0, draft: 0 },
        categoryDistribution: categoryStats,
        recentItems
      },
      message: 'Item statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching item stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching item statistics',
      error: error.message
    });
  }
};