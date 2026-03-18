const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Configure multer for image uploads with size limit
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 // 200KB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
  // This should be replaced with your actual admin authentication logic
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Mock database - replace with actual database queries
let items = [
  {
    id: 1,
    name: 'Sample Item 1',
    description: 'This is a sample item',
    price: 29.99,
    category: 'Electronics',
    availableCount: 15,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    name: 'Sample Item 2',
    description: 'Another sample item',
    price: 49.99,
    category: 'Clothing',
    availableCount: 8,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let nextId = 3;

// GET /api/items - Get all items with pagination, search, and filter
router.get('/', (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    let filteredItems = [...items];

    // Apply search filter
    if (search) {
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply category filter
    if (category) {
      filteredItems = filteredItems.filter(item =>
        item.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Apply sorting
    filteredItems.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    res.json({
      items: paginatedItems,
      totalItems: filteredItems.length,
      totalPages: Math.ceil(filteredItems.length / limit),
      currentPage: parseInt(page),
      itemsPerPage: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/:id - Get single item
router.get('/:id', (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const item = items.find(i => i.id === itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/items - Create new item
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, availableCount } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || availableCount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'description', 'price', 'category', 'availableCount']
      });
    }

    // Validate data types
    if (isNaN(parseFloat(price)) || isNaN(parseInt(availableCount))) {
      return res.status(400).json({
        error: 'Price must be a valid number and availableCount must be an integer'
      });
    }

    let imageUrl = null;
    
    // Handle image upload if provided
    if (req.file) {
      // Check file size (multer should handle this, but double-check)
      if (req.file.size > 200 * 1024) {
        return res.status(400).json({
          error: 'Image file size must be less than 200KB'
        });
      }

      // In a real application, you would save this to a cloud storage service
      // For now, we'll just create a mock URL
      imageUrl = `/uploads/items/${Date.now()}-${req.file.originalname}`;
    }

    const newItem = {
      id: nextId++,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.trim(),
      availableCount: parseInt(availableCount),
      image: imageUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    items.push(newItem);

    res.status(201).json({
      message: 'Item created successfully',
      item: newItem
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Image file size must be less than 200KB'
      });
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id - Update item
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const itemIndex = items.findIndex(i => i.id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { name, description, price, category, availableCount } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || availableCount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'description', 'price', 'category', 'availableCount']
      });
    }

    // Validate data types
    if (isNaN(parseFloat(price)) || isNaN(parseInt(availableCount))) {
      return res.status(400).json({
        error: 'Price must be a valid number and availableCount must be an integer'
      });
    }

    const existingItem = items[itemIndex];
    let imageUrl = existingItem.image;

    // Handle image upload if provided
    if (req.file) {
      // Check file size
      if (req.file.size > 200 * 1024) {
        return res.status(400).json({
          error: 'Image file size must be less than 200KB'
        });
      }

      // In a real application, you would save this to a cloud storage service
      imageUrl = `/uploads/items/${Date.now()}-${req.file.originalname}`;
    }

    const updatedItem = {
      ...existingItem,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.trim(),
      availableCount: parseInt(availableCount),
      image: imageUrl,
      updatedAt: new Date()
    };

    items[itemIndex] = updatedItem;

    res.json({
      message: 'Item updated successfully',
      item: updatedItem
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Image file size must be less than 200KB'
      });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Delete item
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const itemIndex = items.findIndex(i => i.id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const deletedItem = items.splice(itemIndex, 1)[0];

    res.json({
      message: 'Item deleted successfully',
      item: deletedItem
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// GET /api/items/categories/list - Get unique categories
router.get('/categories/list', (req, res) => {
  try {
    const categories = [...new Set(items.map(item => item.category))];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/items/:id/count - Update item count
router.post('/:id/count', requireAdmin, (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { availableCount } = req.body;

    if (availableCount === undefined || isNaN(parseInt(availableCount))) {
      return res.status(400).json({
        error: 'availableCount is required and must be a valid integer'
      });
    }

    const itemIndex = items.findIndex(i => i.id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items[itemIndex].availableCount = parseInt(availableCount);
    items[itemIndex].updatedAt = new Date();

    res.json({
      message: 'Item count updated successfully',
      item: items[itemIndex]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item count' });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Image file size must be less than 200KB'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      error: 'Only image files are allowed'
    });
  }

  res.status(500).json({ error: 'Server error' });
});

module.exports = router;