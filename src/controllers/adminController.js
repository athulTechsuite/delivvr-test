const Item = require('../models/Item');
const { validationResult } = require('express-validator');
const { logAuditEvent } = require('../utils/auditLogger');
const { uploadImage, deleteImage } = require('../services/imageService');

/**
 * Admin Controller for Item Management
 * Handles all CRUD operations for items with proper validation and audit logging
 */
class AdminController {
  /**
   * Get all items with pagination, search, and filtering
   */
  async getItems(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        category = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
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

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries
      const [items, totalCount] = await Promise.all([
        Item.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name')
          .lean(),
        Item.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);
      
      res.json({
        success: true,
        data: {
          items,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
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
  }

  /**
   * Get single item by ID
   */
  async getItemById(req, res) {
    try {
      const { id } = req.params;
      
      const item = await Item.findById(id).populate('category', 'name');
      
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
  }

  /**
   * Create new item
   */
  async createItem(req, res) {
    try {
      // Check validation errors
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
        inventory = 0,
        sku,
        tags = [],
        specifications = {}
      } = req.body;

      // Handle image upload
      let imageUrl = null;
      if (req.file) {
        try {
          imageUrl = await uploadImage(req.file, 'items');
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          return res.status(400).json({
            success: false,
            message: 'Failed to upload image',
            error: uploadError.message
          });
        }
      }

      // Create new item
      const newItem = new Item({
        name,
        description,
        price: parseFloat(price),
        category,
        status,
        inventory: parseInt(inventory),
        sku,
        tags: Array.isArray(tags) ? tags : [],
        specifications,
        imageUrl,
        createdBy: req.user.id
      });

      const savedItem = await newItem.save();
      await savedItem.populate('category', 'name');

      // Log audit event
      await logAuditEvent({
        action: 'CREATE_ITEM',
        userId: req.user.id,
        resourceType: 'Item',
        resourceId: savedItem._id,
        details: {
          itemName: savedItem.name,
          category: savedItem.category,
          price: savedItem.price
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'Item created successfully',
        data: savedItem
      });

    } catch (error) {
      console.error('Error creating item:', error);
      
      // If there was an image uploaded, clean it up
      if (req.file && req.file.filename) {
        try {
          await deleteImage(req.file.filename);
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded image:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create item',
        error: error.message
      });
    }
  }

  /**
   * Update existing item
   */
  async updateItem(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const existingItem = await Item.findById(id);
      
      if (!existingItem) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      const {
        name,
        description,
        price,
        category,
        status,
        inventory,
        sku,
        tags,
        specifications
      } = req.body;

      // Handle image upload/update
      let imageUrl = existingItem.imageUrl;
      if (req.file) {
        try {
          // Upload new image
          imageUrl = await uploadImage(req.file, 'items');
          
          // Delete old image if it exists
          if (existingItem.imageUrl) {
            await deleteImage(existingItem.imageUrl);
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          return res.status(400).json({
            success: false,
            message: 'Failed to upload image',
            error: uploadError.message
          });
        }
      }

      // Update item
      const updateData = {
        name,
        description,
        price: price ? parseFloat(price) : existingItem.price,
        category: category || existingItem.category,
        status: status || existingItem.status,
        inventory: inventory !== undefined ? parseInt(inventory) : existingItem.inventory,
        sku: sku || existingItem.sku,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : existingItem.tags,
        specifications: specifications || existingItem.specifications,
        imageUrl,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const updatedItem = await Item.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('category', 'name');

      // Log audit event
      await logAuditEvent({
        action: 'UPDATE_ITEM',
        userId: req.user.id,
        resourceType: 'Item',
        resourceId: updatedItem._id,
        details: {
          itemName: updatedItem.name,
          changes: Object.keys(updateData),
          oldValues: {
            name: existingItem.name,
            price: existingItem.price,
            status: existingItem.status
          },
          newValues: {
            name: updatedItem.name,
            price: updatedItem.price,
            status: updatedItem.status
          }
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Item updated successfully',
        data: updatedItem
      });

    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update item',
        error: error.message
      });
    }
  }

  /**
   * Delete item
   */
  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      
      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      // Delete associated image
      if (item.imageUrl) {
        try {
          await deleteImage(item.imageUrl);
        } catch (imageError) {
          console.error('Failed to delete item image:', imageError);
          // Continue with item deletion even if image deletion fails
        }
      }

      // Delete item
      await Item.findByIdAndDelete(id);

      // Log audit event
      await logAuditEvent({
        action: 'DELETE_ITEM',
        userId: req.user.id,
        resourceType: 'Item',
        resourceId: item._id,
        details: {
          itemName: item.name,
          category: item.category,
          price: item.price,
          deletedData: {
            name: item.name,
            sku: item.sku,
            status: item.status
          }
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

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
  }

  /**
   * Bulk delete items
   */
  async bulkDeleteItems(req, res) {
    try {
      const { itemIds } = req.body;
      
      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Item IDs are required'
        });
      }

      // Get items to be deleted for audit logging
      const itemsToDelete = await Item.find({ _id: { $in: itemIds } });
      
      if (itemsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No items found to delete'
        });
      }

      // Delete associated images
      for (const item of itemsToDelete) {
        if (item.imageUrl) {
          try {
            await deleteImage(item.imageUrl);
          } catch (imageError) {
            console.error(`Failed to delete image for item ${item._id}:`, imageError);
          }
        }
      }

      // Delete items
      const deleteResult = await Item.deleteMany({ _id: { $in: itemIds } });

      // Log audit events
      for (const item of itemsToDelete) {
        await logAuditEvent({
          action: 'BULK_DELETE_ITEM',
          userId: req.user.id,
          resourceType: 'Item',
          resourceId: item._id,
          details: {
            itemName: item.name,
            bulkOperation: true,
            totalItemsDeleted: deleteResult.deletedCount
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      res.json({
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} items`,
        data: {
          deletedCount: deleteResult.deletedCount
        }
      });

    } catch (error) {
      console.error('Error bulk deleting items:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete items',
        error: error.message
      });
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(req, res) {
    try {
      const [
        totalItems,
        activeItems,
        inactiveItems,
        outOfStockItems,
        lowStockItems,
        recentItems
      ] = await Promise.all([
        Item.countDocuments(),
        Item.countDocuments({ status: 'active' }),
        Item.countDocuments({ status: 'inactive' }),
        Item.countDocuments({ inventory: 0 }),
        Item.countDocuments({ inventory: { $lte: 10, $gt: 0 } }),
        Item.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('name price category createdAt')
          .populate('category', 'name')
      ]);

      res.json({
        success: true,
        data: {
          totalItems,
          activeItems,
          inactiveItems,
          outOfStockItems,
          lowStockItems,
          recentItems
        }
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: error.message
      });
    }
  }

  /**
   * Update item status (activate/deactivate)
   */
  async updateItemStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be "active" or "inactive"'
        });
      }

      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      const oldStatus = item.status;
      item.status = status;
      item.updatedBy = req.user.id;
      item.updatedAt = new Date();

      await item.save();

      // Log audit event
      await logAuditEvent({
        action: 'UPDATE_ITEM_STATUS',
        userId: req.user.id,
        resourceType: 'Item',
        resourceId: item._id,
        details: {
          itemName: item.name,
          oldStatus,
          newStatus: status
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: `Item ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: item
      });

    } catch (error) {
      console.error('Error updating item status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update item status',
        error: error.message
      });
    }
  }
}

module.exports = new AdminController();