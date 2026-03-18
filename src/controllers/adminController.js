const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

// Get admin dashboard with items overview
exports.getDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const category = req.query.category || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build filter query
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Get paginated items
    const items = await Product.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('category', 'name')
      .lean();

    const totalItems = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    // Get dashboard statistics
    const stats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          activeItems: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          lowStockItems: {
            $sum: { $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0] }
          },
          totalValue: {
            $sum: { $multiply: ['$price', '$quantity'] }
          }
        }
      }
    ]);

    // Get category breakdown
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        stats: stats[0] || {
          totalItems: 0,
          totalQuantity: 0,
          activeItems: 0,
          lowStockItems: 0,
          totalValue: 0
        },
        categoryStats
      }
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
    const itemData = { ...req.body };
    
    // Handle file uploads if present
    if (req.files) {
      if (req.files.images) {
        itemData.images = req.files.images.map(file => ({
          url: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        }));
      }
      
      if (req.files.documents) {
        itemData.documents = req.files.documents.map(file => ({
          url: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype
        }));
      }
    }

    // Set created by admin
    itemData.createdBy = req.user.id;
    itemData.updatedBy = req.user.id;

    const newItem = new Product(itemData);
    await newItem.save();

    // Create audit log
    await AuditLog.create({
      action: 'CREATE',
      resource: 'Product',
      resourceId: newItem._id,
      userId: req.user.id,
      details: {
        itemName: newItem.name,
        sku: newItem.sku,
        initialQuantity: newItem.quantity
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: newItem
    });
  } catch (error) {
    console.error('Item creation error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      const allFiles = [
        ...(req.files.images || []),
        ...(req.files.documents || [])
      ];
      
      for (const file of allFiles) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Failed to cleanup file:', file.path, unlinkError);
        }
      }
    }

    res.status(400).json({
      success: false,
      message: 'Failed to create item',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

// Get single item details
exports.getItem = async (req, res) => {
  try {
    const item = await Product.findById(req.params.id)
      .populate('category', 'name description')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

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
    console.error('Item fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item',
      error: error.message
    });
  }
};

// Update existing item
exports.updateItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const updateData = { ...req.body };
    
    const existingItem = await Product.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store original data for audit
    const originalData = existingItem.toObject();

    // Handle file uploads
    if (req.files) {
      if (req.files.images) {
        const newImages = req.files.images.map(file => ({
          url: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        }));
        
        updateData.images = existingItem.images ? 
          [...existingItem.images, ...newImages] : newImages;
      }
      
      if (req.files.documents) {
        const newDocuments = req.files.documents.map(file => ({
          url: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype
        }));
        
        updateData.documents = existingItem.documents ? 
          [...existingItem.documents, ...newDocuments] : newDocuments;
      }
    }

    // Handle image/document removal
    if (req.body.removeImages) {
      const imagesToRemove = JSON.parse(req.body.removeImages);
      for (const imageId of imagesToRemove) {
        const imageIndex = existingItem.images.findIndex(img => img._id.toString() === imageId);
        if (imageIndex > -1) {
          const imagePath = existingItem.images[imageIndex].url;
          try {
            await fs.unlink(imagePath);
          } catch (error) {
            console.error('Failed to delete image file:', imagePath, error);
          }
          existingItem.images.splice(imageIndex, 1);
        }
      }
      updateData.images = existingItem.images;
    }

    if (req.body.removeDocuments) {
      const documentsToRemove = JSON.parse(req.body.removeDocuments);
      for (const docId of documentsToRemove) {
        const docIndex = existingItem.documents.findIndex(doc => doc._id.toString() === docId);
        if (docIndex > -1) {
          const docPath = existingItem.documents[docIndex].url;
          try {
            await fs.unlink(docPath);
          } catch (error) {
            console.error('Failed to delete document file:', docPath, error);
          }
          existingItem.documents.splice(docIndex, 1);
        }
      }
      updateData.documents = existingItem.documents;
    }

    updateData.updatedBy = req.user.id;
    updateData.updatedAt = new Date();

    const updatedItem = await Product.findByIdAndUpdate(
      itemId,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name description');

    // Create audit log with change details
    const changes = {};
    Object.keys(updateData).forEach(key => {
      if (key !== 'updatedBy' && key !== 'updatedAt' && 
          JSON.stringify(originalData[key]) !== JSON.stringify(updateData[key])) {
        changes[key] = {
          from: originalData[key],
          to: updateData[key]
        };
      }
    });

    await AuditLog.create({
      action: 'UPDATE',
      resource: 'Product',
      resourceId: itemId,
      userId: req.user.id,
      details: {
        itemName: updatedItem.name,
        sku: updatedItem.sku,
        changes
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
    console.error('Item update error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update item',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await Product.findById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Store item data for audit before deletion
    const itemData = item.toObject();

    // Delete associated files
    if (item.images && item.images.length > 0) {
      for (const image of item.images) {
        try {
          await fs.unlink(image.url);
        } catch (error) {
          console.error('Failed to delete image file:', image.url, error);
        }
      }
    }

    if (item.documents && item.documents.length > 0) {
      for (const document of item.documents) {
        try {
          await fs.unlink(document.url);
        } catch (error) {
          console.error('Failed to delete document file:', document.url, error);
        }
      }
    }

    await Product.findByIdAndDelete(itemId);

    // Create audit log
    await AuditLog.create({
      action: 'DELETE',
      resource: 'Product',
      resourceId: itemId,
      userId: req.user.id,
      details: {
        itemName: itemData.name,
        sku: itemData.sku,
        deletedData: itemData
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Item deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item',
      error: error.message
    });
  }
};

// Bulk operations
exports.bulkActions = async (req, res) => {
  try {
    const { action, itemIds, data } = req.body;

    if (!action || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk action parameters'
      });
    }

    let result;
    const auditPromises = [];

    switch (action) {
      case 'delete':
        // Get items before deletion for audit
        const itemsToDelete = await Product.find({ _id: { $in: itemIds } });
        
        // Delete files for each item
        for (const item of itemsToDelete) {
          if (item.images) {
            for (const image of item.images) {
              try {
                await fs.unlink(image.url);
              } catch (error) {
                console.error('Failed to delete image:', image.url, error);
              }
            }
          }
          if (item.documents) {
            for (const document of item.documents) {
              try {
                await fs.unlink(document.url);
              } catch (error) {
                console.error('Failed to delete document:', document.url, error);
              }
            }
          }
          
          // Create audit log for each deletion
          auditPromises.push(AuditLog.create({
            action: 'BULK_DELETE',
            resource: 'Product',
            resourceId: item._id,
            userId: req.user.id,
            details: {
              itemName: item.name,
              sku: item.sku,
              bulkOperation: true
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }));
        }
        
        result = await Product.deleteMany({ _id: { $in: itemIds } });
        break;

      case 'updateStatus':
        if (!data || !data.status) {
          return res.status(400).json({
            success: false,
            message: 'Status is required for bulk status update'
          });
        }
        
        result = await Product.updateMany(
          { _id: { $in: itemIds } },
          { 
            status: data.status,
            updatedBy: req.user.id,
            updatedAt: new Date()
          }
        );
        
        // Create audit logs
        for (const itemId of itemIds) {
          auditPromises.push(AuditLog.create({
            action: 'BULK_UPDATE_STATUS',
            resource: 'Product',
            resourceId: itemId,
            userId: req.user.id,
            details: {
              newStatus: data.status,
              bulkOperation: true
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }));
        }
        break;

      case 'updateCategory':
        if (!data || !data.category) {
          return res.status(400).json({
            success: false,
            message: 'Category is required for bulk category update'
          });
        }
        
        result = await Product.updateMany(
          { _id: { $in: itemIds } },
          { 
            category: data.category,
            updatedBy: req.user.id,
            updatedAt: new Date()
          }
        );
        
        // Create audit logs
        for (const itemId of itemIds) {
          auditPromises.push(AuditLog.create({
            action: 'BULK_UPDATE_CATEGORY',
            resource: 'Product',
            resourceId: itemId,
            userId: req.user.id,
            details: {
              newCategory: data.category,
              bulkOperation: true
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }));
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid bulk action'
        });
    }

    // Wait for all audit logs to be created
    await Promise.all(auditPromises);

    res.json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: {
        affectedCount: result.modifiedCount || result.deletedCount,
        itemsProcessed: itemIds.length
      }
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk operation failed',
      error: error.message
    });
  }
};

// Get audit trail for items
exports.getAuditTrail = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const itemId = req.query.itemId;
    const action = req.query.action;
    const userId = req.query.userId;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    const filter = { resource: 'Product' };
    
    if (itemId) filter.resourceId = itemId;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const auditLogs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email')
      .populate({
        path: 'resourceId',
        model: 'Product',
        select: 'name sku',
        match: { _id: { $exists: true } }
      })
      .lean();

    const totalLogs = await AuditLog.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalLogs,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Audit trail fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit trail',
      error: error.message
    });
  }
};

// Export items data
exports.exportItems = async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filter = {};
    
    // Apply filters from query parameters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const items = await Product.find(filter)
      .populate('category', 'name')
      .lean();

    // Create audit log for export
    await AuditLog.create({
      action: 'EXPORT',
      resource: 'Product',
      userId: req.user.id,
      details: {
        format,
        itemCount: items.length,
        filters: req.query
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (format === 'csv') {
      const csv = require('csv-writer');
      const csvWriter = csv.createObjectCsvStringifier({
        header: [
          { id: 'name', title: 'Name' },
          { id: 'sku', title: 'SKU' },
          { id: 'description', title: 'Description' },
          { id: 'category', title: 'Category' },
          { id: 'price', title: 'Price' },
          { id: 'quantity', title: 'Quantity' },
          { id: 'status', title: 'Status' },
          { id: 'createdAt', title: 'Created Date' },
          { id: 'updatedAt', title: 'Updated Date' }
        ]
      });

      const csvData = items.map(item => ({
        ...item,
        category: item.category?.name || '',
        createdAt: item.createdAt?.toISOString(),
        updatedAt: item.updatedAt?.toISOString()
      }));

      const csvString = csvWriter.getHeaderString() + csvWriter.stringifyRecords(csvData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=items-export.csv');
      res.send(csvString);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=items-export.json');
      res.json({
        exportDate: new Date().toISOString(),
        totalItems: items.length,
        items
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export items',
      error: error.message
    });
  }
};