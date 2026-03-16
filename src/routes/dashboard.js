const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Dashboard route - redirects based on user role
router.get('/', authenticateToken, (req, res) => {
  const userRole = req.user.role;
  
  switch (userRole) {
    case 'admin':
      return res.redirect('/dashboard/admin');
    case 'vendor':
      return res.redirect('/dashboard/vendor');
    case 'customer':
    default:
      return res.redirect('/dashboard/customer');
  }
});

// Customer Dashboard
router.get('/customer', authenticateToken, authorizeRoles(['customer', 'admin']), async (req, res) => {
  try {
    // TODO: Fetch user orders, wishlist, and account data
    const dashboardData = {
      user: req.user,
      orders: [], // await Order.findByUserId(req.user.id)
      wishlist: [], // await Wishlist.findByUserId(req.user.id)
      recentOrders: [], // await Order.findRecent(req.user.id)
    };

    res.render('dashboard/customer', { 
      title: 'Customer Dashboard',
      user: req.user,
      data: dashboardData
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);
    res.status(500).render('error', { 
      message: 'Error loading dashboard',
      error: { status: 500 }
    });
  }
});

// Admin Dashboard
router.get('/admin', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    // TODO: Fetch admin analytics, user management data, product stats
    const dashboardData = {
      user: req.user,
      totalUsers: 0, // await User.count()
      totalOrders: 0, // await Order.count()
      totalProducts: 0, // await Product.count()
      revenueStats: {}, // await Order.getRevenueStats()
      recentOrders: [], // await Order.findRecent()
    };

    res.render('dashboard/admin', {
      title: 'Admin Dashboard',
      user: req.user,
      data: dashboardData
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('error', { 
      message: 'Error loading dashboard',
      error: { status: 500 }
    });
  }
});

// Vendor Dashboard
router.get('/vendor', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    // TODO: Fetch vendor inventory, sales data, product performance
    const dashboardData = {
      user: req.user,
      products: [], // await Product.findByVendorId(req.user.id)
      salesData: {}, // await Order.getVendorSales(req.user.id)
      inventory: [], // await Inventory.findByVendorId(req.user.id)
      recentOrders: [], // await Order.findByVendorId(req.user.id)
    };

    res.render('dashboard/vendor', {
      title: 'Vendor Dashboard',
      user: req.user,
      data: dashboardData
    });
  } catch (error) {
    console.error('Vendor dashboard error:', error);
    res.status(500).render('error', { 
      message: 'Error loading dashboard',
      error: { status: 500 }
    });
  }
});

// Account Settings (accessible to all authenticated users)
router.get('/settings', authenticateToken, (req, res) => {
  res.render('dashboard/settings', {
    title: 'Account Settings',
    user: req.user
  });
});

// Update Account Settings
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    
    // TODO: Validate input and update user profile
    // await User.updateById(req.user.id, { firstName, lastName, email, phone })
    
    req.flash('success', 'Account settings updated successfully');
    res.redirect('/dashboard/settings');
  } catch (error) {
    console.error('Settings update error:', error);
    req.flash('error', 'Error updating account settings');
    res.redirect('/dashboard/settings');
  }
});

// API endpoints for dashboard data (for AJAX requests)
router.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    let stats = {};

    switch (userRole) {
      case 'admin':
        stats = {
          totalUsers: 0, // await User.count()
          totalOrders: 0, // await Order.count()
          totalRevenue: 0, // await Order.getTotalRevenue()
          pendingOrders: 0, // await Order.countPending()
        };
        break;
      case 'vendor':
        stats = {
          totalProducts: 0, // await Product.countByVendor(req.user.id)
          totalSales: 0, // await Order.getVendorSales(req.user.id)
          lowStock: 0, // await Inventory.countLowStock(req.user.id)
        };
        break;
      case 'customer':
      default:
        stats = {
          totalOrders: 0, // await Order.countByUser(req.user.id)
          wishlistItems: 0, // await Wishlist.countByUser(req.user.id)
        };
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

module.exports = router;