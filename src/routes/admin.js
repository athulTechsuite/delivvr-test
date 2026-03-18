const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'uploads/items';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and documents are allowed.'));
    }
  }
});

// Apply authentication and admin middleware to all routes
router.use(requireAuth);
router.use(requireAdmin);

// Helper function to log audit trail
async function logAuditTrail(action, itemId, userId, details = {}) {
  try {
    await AuditLog.create({
      action,
      itemId,
      userId,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log audit trail:', error);
  }
}

// GET /admin - Admin dashboard main page
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query filters
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Product.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    // Get summary statistics
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    res.render('admin/dashboard', {
      items,
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
      stats,
      title: 'Admin Dashboard - Item Management'
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', { 
      message: 'Failed to load dashboard',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /admin/items/new - Create new item form
router.get('/items/new', (req, res) => {
  res.render('admin/item-form', {
    title: 'Create New Item',
    item: {},
    isEdit: false
  });
});

// POST /admin/items - Create new item
router.post('/items', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]), async (req, res) => {
  try {
    const itemData = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      quantity: parseInt(req.body.quantity) || 0,
      price: parseFloat(req.body.price) || 0,
      status: req.body.status || 'active',
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      createdBy: req.user.id
    };

    // Handle file uploads
    if (req.files.image && req.files.image[0]) {
      itemData.image = req.files.image[0].filename;
    }

    if (req.files.attachments && req.files.attachments.length > 0) {
      itemData.attachments = req.files.attachments.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
    }

    const item = await Product.create(itemData);

    // Log audit trail
    await logAuditTrail('CREATE', item._id, req.user.id, {
      itemName: item.name,
      quantity: item.quantity
    });

    req.flash('success', `Item "${item.name}" created successfully`);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error creating item:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      const allFiles = [...(req.files.image || []), ...(req.files.attachments || [])];
      for (const file of allFiles) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    req.flash('error', 'Failed to create item: ' + error.message);
    res.redirect('/admin/items/new');
  }
});

// GET /admin/items/:id/edit - Edit item form
router.get('/items/:id/edit', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    
    if (!item) {
      req.flash('error', 'Item not found');
      return res.redirect('/admin');
    }

    res.render('admin/item-form', {
      title: 'Edit Item',
      item,
      isEdit: true
    });
  } catch (error) {
    console.error('Error loading item for edit:', error);
    req.flash('error', 'Failed to load item');
    res.redirect('/admin');
  }
});

// PUT /admin/items/:id - Update item
router.put('/items/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]), async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    
    if (!item) {
      req.flash('error', 'Item not found');
      return res.redirect('/admin');
    }

    const oldData = { ...item.toObject() };

    // Update basic fields
    item.name = req.body.name;
    item.description = req.body.description;
    item.category = req.body.category;
    item.quantity = parseInt(req.body.quantity) || 0;
    item.price = parseFloat(req.body.price) || 0;
    item.status = req.body.status;
    item.tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];
    item.updatedBy = req.user.id;
    item.updatedAt = new Date();

    // Handle new image upload
    if (req.files.image && req.files.image[0]) {
      // Delete old image if exists
      if (item.image) {
        try {
          await fs.unlink(path.join('uploads/items', item.image));
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }
      item.image = req.files.image[0].filename;
    }

    // Handle new attachments
    if (req.files.attachments && req.files.attachments.length > 0) {
      const newAttachments = req.files.attachments.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
      item.attachments = [...(item.attachments || []), ...newAttachments];
    }

    await item.save();

    // Log audit trail with changes
    const changes = {};
    if (oldData.name !== item.name) changes.name = { from: oldData.name, to: item.name };
    if (oldData.quantity !== item.quantity) changes.quantity = { from: oldData.quantity, to: item.quantity };
    if (oldData.status !== item.status) changes.status = { from: oldData.status, to: item.status };

    await logAuditTrail('UPDATE', item._id, req.user.id, {
      itemName: item.name,
      changes
    });

    req.flash('success', `Item "${item.name}" updated successfully`);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error updating item:', error);
    req.flash('error', 'Failed to update item: ' + error.message);
    res.redirect(`/admin/items/${req.params.id}/edit`);
  }
});

// DELETE /admin/items/:id - Delete item
router.delete('/items/:id', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Delete associated files
    if (item.image) {
      try {
        await fs.unlink(path.join('uploads/items', item.image));
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }

    if (item.attachments && item.attachments.length > 0) {
      for (const attachment of item.attachments) {
        try {
          await fs.unlink(path.join('uploads/items', attachment.filename));
        } catch (error) {
          console.error('Error deleting attachment:', error);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);

    // Log audit trail
    await logAuditTrail('DELETE', req.params.id, req.user.id, {
      itemName: item.name,
      quantity: item.quantity
    });

    res.json({ success: true, message: `Item "${item.name}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
});

// POST /admin/items/bulk-action - Bulk operations
router.post('/items/bulk-action', async (req, res) => {
  try {
    const { action, itemIds } = req.body;
    
    if (!action || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid bulk action request' });
    }

    let result;
    const items = await Product.find({ _id: { $in: itemIds } });

    switch (action) {
      case 'delete':
        // Delete files for all items
        for (const item of items) {
          if (item.image) {
            try {
              await fs.unlink(path.join('uploads/items', item.image));
            } catch (error) {
              console.error('Error deleting image:', error);
            }
          }
          if (item.attachments) {
            for (const attachment of item.attachments) {
              try {
                await fs.unlink(path.join('uploads/items', attachment.filename));
              } catch (error) {
                console.error('Error deleting attachment:', error);
              }
            }
          }
        }
        
        result = await Product.deleteMany({ _id: { $in: itemIds } });
        
        // Log audit trail for bulk delete
        for (const item of items) {
          await logAuditTrail('BULK_DELETE', item._id, req.user.id, {
            itemName: item.name,
            bulkOperation: true
          });
        }
        
        break;

      case 'activate':
        result = await Product.updateMany(
          { _id: { $in: itemIds } },
          { status: 'active', updatedBy: req.user.id, updatedAt: new Date() }
        );
        
        // Log audit trail for bulk activate
        for (const item of items) {
          await logAuditTrail('BULK_UPDATE', item._id, req.user.id, {
            itemName: item.name,
            changes: { status: { from: item.status, to: 'active' } },
            bulkOperation: true
          });
        }
        
        break;

      case 'deactivate':
        result = await Product.updateMany(
          { _id: { $in: itemIds } },
          { status: 'inactive', updatedBy: req.user.id, updatedAt: new Date() }
        );
        
        // Log audit trail for bulk deactivate
        for (const item of items) {
          await logAuditTrail('BULK_UPDATE', item._id, req.user.id, {
            itemName: item.name,
            changes: { status: { from: item.status, to: 'inactive' } },
            bulkOperation: true
          });
        }
        
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid bulk action' });
    }

    res.json({ 
      success: true, 
      message: `Bulk ${action} completed successfully`,
      modifiedCount: result.modifiedCount || result.deletedCount
    });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ success: false, message: 'Bulk operation failed' });
  }
});

// GET /admin/items/:id - View item details
router.get('/items/:id', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!item) {
      req.flash('error', 'Item not found');
      return res.redirect('/admin');
    }

    // Get audit trail for this item
    const auditTrail = await AuditLog.find({ itemId: req.params.id })
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .limit(50);

    res.render('admin/item-details', {
      title: `Item Details - ${item.name}`,
      item,
      auditTrail
    });
  } catch (error) {
    console.error('Error loading item details:', error);
    req.flash('error', 'Failed to load item details');
    res.redirect('/admin');
  }
});

// DELETE /admin/items/:id/attachments/:filename - Delete specific attachment
router.delete('/items/:id/attachments/:filename', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const attachmentIndex = item.attachments.findIndex(
      att => att.filename === req.params.filename
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(path.join('uploads/items', req.params.filename));
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Remove from database
    item.attachments.splice(attachmentIndex, 1);
    item.updatedBy = req.user.id;
    item.updatedAt = new Date();
    await item.save();

    // Log audit trail
    await logAuditTrail('DELETE_ATTACHMENT', item._id, req.user.id, {
      itemName: item.name,
      filename: req.params.filename
    });

    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment' });
  }
});

// GET /admin/audit-trail - View audit trail
router.get('/audit-trail', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const action = req.query.action || '';
    const userId = req.query.userId || '';
    const itemId = req.query.itemId || '';

    // Build query filters
    const query = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (itemId) query.itemId = itemId;

    const skip = (page - 1) * limit;

    const [auditLogs, totalLogs] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email')
        .populate('itemId', 'name')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalLogs / limit);

    res.render('admin/audit-trail', {
      title: 'Audit Trail',
      auditLogs,
      currentPage: page,
      totalPages,
      totalLogs,
      limit,
      action,
      userId,
      itemId
    });
  } catch (error) {
    console.error('Error loading audit trail:', error);
    res.status(500).render('error', { 
      message: 'Failed to load audit trail',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router;