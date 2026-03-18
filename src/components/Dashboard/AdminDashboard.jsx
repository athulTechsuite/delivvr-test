import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Upload,
  X,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import DOMPurify from 'dompurify';

// API service
const ApiService = {
  fetchUsers: () => fetch('/api/admin/users').then(res => res.json()),
  fetchProducts: () => fetch('/api/admin/products').then(res => res.json()),
  fetchItems: () => fetch('/api/admin/items').then(res => res.json()),
  fetchOrders: () => fetch('/api/admin/orders').then(res => res.json()),
  fetchAnalytics: () => fetch('/api/admin/analytics').then(res => res.json()),
  createItem: (itemData) => fetch('/api/admin/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData)
  }).then(res => res.json()),
  updateItem: (id, itemData) => fetch(`/api/admin/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData)
  }).then(res => res.json()),
  deleteItem: (id) => fetch(`/api/admin/items/${id}`, {
    method: 'DELETE'
  }).then(res => res.json()),
};

// Mock data fallback for development
const getMockData = () => ({
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'customer', status: 'active', joinDate: '2024-01-15' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'vendor', status: 'active', joinDate: '2024-01-20' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'customer', status: 'inactive', joinDate: '2024-01-25' }
  ],
  products: [
    { id: 1, name: 'Wireless Headphones', price: 99.99, stock: 50, category: 'Electronics', status: 'active' },
    { id: 2, name: 'Running Shoes', price: 129.99, stock: 30, category: 'Sports', status: 'active' },
    { id: 3, name: 'Coffee Maker', price: 79.99, stock: 0, category: 'Appliances', status: 'out_of_stock' }
  ],
  items: [
    { 
      id: 1, 
      name: 'Premium Coffee Beans', 
      description: 'High-quality arabica coffee beans from Colombia',
      price: 24.99, 
      count: 150, 
      category: 'Food & Beverages', 
      status: 'active',
      image: '/api/placeholder/100/100',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-30'
    },
    { 
      id: 2, 
      name: 'Organic Green Tea', 
      description: 'Premium organic green tea leaves',
      price: 18.99, 
      count: 75, 
      category: 'Food & Beverages', 
      status: 'active',
      image: '/api/placeholder/100/100',
      createdAt: '2024-01-20',
      updatedAt: '2024-01-28'
    },
    { 
      id: 3, 
      name: 'Artisan Chocolate', 
      description: 'Handcrafted dark chocolate with 70% cocoa',
      price: 12.99, 
      count: 0, 
      category: 'Food & Beverages', 
      status: 'out_of_stock',
      image: '/api/placeholder/100/100',
      createdAt: '2024-01-25',
      updatedAt: '2024-02-01'
    }
  ],
  orders: [
    { id: 1, customer: 'John Doe', total: 199.98, status: 'completed', date: '2024-01-30' },
    { id: 2, customer: 'Jane Smith', total: 99.99, status: 'pending', date: '2024-01-31' },
    { id: 3, customer: 'Bob Johnson', total: 259.97, status: 'shipped', date: '2024-02-01' }
  ],
  analytics: {
    totalUsers: 1250,
    totalProducts: 450,
    totalOrders: 850,
    totalRevenue: 125000,
    monthlyGrowth: 15.5,
    topSellingProducts: [
      { name: 'Wireless Headphones', sales: 156 },
      { name: 'Running Shoes', sales: 142 },
      { name: 'Coffee Maker', sales: 98 }
    ]
  }
});

// Notification types enum
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const AdminDashboard = () => {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Item management states
  const [itemSearch, setItemSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    count: '',
    category: '',
    image: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Error reporting service
  const reportError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    
    // In production, send to error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { tags: { context } });
    }
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        
        // Try to fetch from API first, fallback to mock data
        let data;
        try {
          const [usersRes, productsRes, itemsRes, ordersRes, analyticsRes] = await Promise.all([
            ApiService.fetchUsers(),
            ApiService.fetchProducts(), 
            ApiService.fetchItems(),
            ApiService.fetchOrders(),
            ApiService.fetchAnalytics()
          ]);
          
          data = {
            users: usersRes,
            products: productsRes,
            items: itemsRes,
            orders: ordersRes,
            analytics: analyticsRes
          };
        } catch (apiError) {
          console.warn('API not available, using mock data for development');
          data = getMockData();
        }

        if (isMountedRef.current) {
          setUsers(data.users);
          setProducts(data.products);
          setItems(data.items);
          setOrders(data.orders);
          setAnalytics(data.analytics);
          setLoading(false);
        }
      } catch (error) {
        reportError(error, 'fetchAdminData');
        if (isMountedRef.current) {
          showNotification('Failed to load admin data. Please try refreshing the page.', NOTIFICATION_TYPES.ERROR);
          setLoading(false);
        }
      }
    };

    fetchAdminData();
  }, []);

  // Notification system with cleanup
  const showNotification = useCallback((message, type = NOTIFICATION_TYPES.SUCCESS) => {
    if (!isMountedRef.current) return;
    
    // Clear existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    const sanitizedMessage = DOMPurify.sanitize(message);
    setNotification({ message: sanitizedMessage, type });
    
    notificationTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setNotification(null);
      }
    }, 4000);
  }, []);

  // Input sanitization helper
  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input.trim());
  };

  // Image validation and upload with error handling
  const validateImageFile = (file) => {
    const maxSize = 200 * 1024; // 200KB
    if (file.size > maxSize) {
      return 'Image file size must be less than 200KB';
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, and GIF images are allowed';
    }
    
    return null;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    const error = validateImageFile(file);
    if (error) {
      setFormErrors(prev => ({ ...prev, image: error }));
      return;
    }

    setFormErrors(prev => ({ ...prev, image: null }));
    setItemForm(prev => ({ ...prev, image: file }));
    
    // Create preview with error handling
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (isMountedRef.current) {
            setImagePreview(e.target.result);
          }
        } catch (previewError) {
          reportError(previewError, 'image preview');
          showNotification('Failed to generate image preview', NOTIFICATION_TYPES.ERROR);
        }
      };
      reader.onerror = (error) => {
        reportError(error, 'FileReader');
        showNotification('Failed to read image file', NOTIFICATION_TYPES.ERROR);
      };
      reader.readAsDataURL(file);
    } catch (readerError) {
      reportError(readerError, 'FileReader initialization');
      showNotification('Failed to process image file', NOTIFICATION_TYPES.ERROR);
    }
  };

  // Form validation with input sanitization
  const validateItemForm = () => {
    const errors = {};
    
    const sanitizedName = sanitizeInput(itemForm.name);
    const sanitizedDescription = sanitizeInput(itemForm.description);
    const sanitizedCategory = sanitizeInput(itemForm.category);
    
    if (!sanitizedName) errors.name = 'Name is required';
    if (!sanitizedDescription) errors.description = 'Description is required';
    if (!itemForm.price || parseFloat(itemForm.price) <= 0) errors.price = 'Valid price is required';
    if (!itemForm.count || parseInt(itemForm.count) < 0) errors.count = 'Valid count is required';
    if (!sanitizedCategory) errors.category = 'Category is required';
    
    return errors;
  };

  // Item CRUD operations with proper error handling
  const handleCreateItem = async () => {
    try {
      const errors = validateItemForm();
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const sanitizedItemData = {
        name: sanitizeInput(itemForm.name),
        description: sanitizeInput(itemForm.description),
        price: parseFloat(itemForm.price),
        count: parseInt(itemForm.count),
        category: sanitizeInput(itemForm.category),
        image: itemForm.image
      };

      // Note: Server-side validation is required for file uploads
      // The server should validate file type, size, and scan for malicious content
      
      try {
        const newItem = await ApiService.createItem(sanitizedItemData);
        if (isMountedRef.current) {
          setItems(prev => [newItem, ...prev]);
          resetItemForm();
          showNotification('Item created successfully', NOTIFICATION_TYPES.SUCCESS);
        }
      } catch (apiError) {
        // Fallback for development/mock
        const mockItem = {
          id: Date.now(),
          ...sanitizedItemData,
          status: sanitizedItemData.count > 0 ? 'active' : 'out_of_stock',
          image: imagePreview || '/api/placeholder/100/100',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0]
        };
        
        if (isMountedRef.current) {
          setItems(prev => [mockItem, ...prev]);
          resetItemForm();
          showNotification('Item created successfully (mock)', NOTIFICATION_TYPES.SUCCESS);
        }
      }
    } catch (error) {
      reportError(error, 'handleCreateItem');
      showNotification('Failed to create item. Please try again.', NOTIFICATION_TYPES.ERROR);
    }
  };

  const handleUpdateItem = async () => {
    try {
      const errors = validateItemForm();
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const sanitizedItemData = {
        name: sanitizeInput(itemForm.name),
        description: sanitizeInput(itemForm.description),
        price: parseFloat(itemForm.price),
        count: parseInt(itemForm.count),
        category: sanitizeInput(itemForm.category),
        image: itemForm.image
      };

      try {
        const updatedItem = await ApiService.updateItem(editingItem.id, sanitizedItemData);
        if (isMountedRef.current) {
          setItems(prev => prev.map(item => 
            item.id === editingItem.id ? updatedItem : item
          ));
          resetItemForm();
          showNotification('Item updated successfully', NOTIFICATION_TYPES.SUCCESS);
        }
      } catch (apiError) {
        // Fallback for development/mock
        const mockUpdatedItem = {
          ...editingItem,
          ...sanitizedItemData,
          status: sanitizedItemData.count > 0 ? 'active' : 'out_of_stock',
          image: imagePreview || editingItem.image,
          updatedAt: new Date().toISOString().split('T')[0]
        };

        if (isMountedRef.current) {
          setItems(prev => prev.map(item => 
            item.id === editingItem.id ? mockUpdatedItem : item
          ));
          resetItemForm();
          showNotification('Item updated successfully (mock)', NOTIFICATION_TYPES.SUCCESS);
        }
      }
    } catch (error) {
      reportError(error, 'handleUpdateItem');
      showNotification('Failed to update item. Please try again.', NOTIFICATION_TYPES.ERROR);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      try {
        await ApiService.deleteItem(itemId);
      } catch (apiError) {
        // Continue with mock deletion for development
      }
      
      if (isMountedRef.current) {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setShowDeleteConfirm(null);
        showNotification('Item deleted successfully', NOTIFICATION_TYPES.SUCCESS);
      }
    } catch (error) {
      reportError(error, 'handleDeleteItem');
      showNotification('Failed to delete item. Please try again.', NOTIFICATION_TYPES.ERROR);
    }
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      price: '',
      count: '',
      category: '',
      image: null
    });
    setFormErrors({});
    setImagePreview(null);
    setShowItemForm(false);
    setEditingItem(null);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      count: item.count.toString(),
      category: item.category,
      image: null
    });
    setImagePreview(item.image);
    setFormErrors({});
    setShowItemForm(true);
  };

  // Filter and search items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
                         item.description.toLowerCase().includes(itemSearch.toLowerCase());
    const matchesFilter = itemFilter === 'all' || item.status === itemFilter;
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }) => (
    <div className={`rounded-lg shadow-md p-6 border-l-4 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
          <Icon className={`h-6 w-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
        </div>
      </div>
    </div>
  );

  const Notification = () => {
    if (!notification) return null;

    const getNotificationStyle = (type) => {
      switch (type) {
        case NOTIFICATION_TYPES.SUCCESS:
          return 'bg-green-100 text-green-800 border-green-200';
        case NOTIFICATION_TYPES.ERROR:
          return 'bg-red-100 text-red-800 border-red-200';
        case NOTIFICATION_TYPES.WARNING:
          return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case NOTIFICATION_TYPES.INFO:
          return 'bg-blue-100 text-blue-800 border-blue-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const getNotificationIcon = (type) => {
      switch (type) {
        case NOTIFICATION_TYPES.SUCCESS:
          return <Check className="h-5 w-5" />;
        case NOTIFICATION_TYPES.ERROR:
        case NOTIFICATION_TYPES.WARNING:
          return <AlertCircle className="h-5 w-5" />;
        case NOTIFICATION_TYPES.INFO:
          return <AlertCircle className="h-5 w-5" />;
        default:
          return <AlertCircle className="h-5 w-5" />;
      }
    };

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 ${getNotificationStyle(notification.type)}`}>
        {getNotificationIcon(notification.type)}
        <span dangerouslySetInnerHTML={{ __html: notification.message }} />
        <button 
          onClick={() => setNotification(null)}
          className="ml-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const ItemForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingItem ? 'Edit Item' : 'Create New Item'}
            </h3>
            <button 
              onClick={resetItemForm}
              className={`p-2 rounded-lg hover:bg-gray-100 ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'text-gray-500'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Item Name *
              </label>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${formErrors.name ? 'border-red-500' : ''}`}
                placeholder="Enter item name"
              />
              {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Category *
              </label>
              <input
                type="text"
                value={itemForm.category}
                onChange={(e) => setItemForm(prev => ({ ...prev, category: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${formErrors.category ? 'border-red-500' : ''}`}
                placeholder="Enter category"
              />
              {formErrors.category && <p className="text-red-500 text-sm mt-1">{formErrors.category}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                value={itemForm.price}
                onChange={(e) => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${formErrors.price ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
              {formErrors.price && <p className="text-red-500 text-sm mt-1">{formErrors.price}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Available Count *
              </label>
              <input
                type="number"
                value={itemForm.count}
                onChange={(e) => setItemForm(prev => ({ ...prev, count: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${formErrors.count ? 'border-red-500' : ''}`}
                placeholder="0"
              />
              {formErrors.count && <p className="text-red-500 text-sm mt-1">{formErrors.count}</p>}
            </div>
          </div>

          <div className="mt-6">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description *
            </label>
            <textarea
              value={itemForm.description}
              onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } ${formErrors.description ? 'border-red-500' : ''}`}
              placeholder="Enter item description"
            />
            {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
          </div>

          <div className="mt-6">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Item Image (Max 200KB) - Server validation required
            </label>
            <div className="text-xs text-yellow-600 mb-2">
              Note: Client-side validation only. Server must validate file type, size, and scan for malicious content.
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${formErrors.image ? 'border-red-500' : ''}`}
                />
                {formErrors.image && <p className="text-red-500 text-sm mt-1">{formErrors.image}</p>}
              </div>
              {imagePreview && (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-16 h-16 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setItemForm(prev => ({ ...prev, image: null }));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={resetItemForm}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                isDark 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={editingItem ? handleUpdateItem : handleCreateItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingItem ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const DeleteConfirmDialog = () => {
    if (!showDeleteConfirm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className={`max-w-md w-full rounded-lg shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Confirm Delete
            </h3>
          </div>
          <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                isDark 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteItem(showDeleteConfirm.id)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ItemManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
        <button 
          onClick={() => setShowItemForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search items..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <select
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            isDark 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="all">All Items</option>
          <option value="active">Active</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Item</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Count</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="h-10 w-10 rounded-lg object-cover mr-3"
                      />
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`} title={item.description}>
                          {item.description.length > 30 ? `${item.description.substring(0, 30)}...` : item.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.category}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ${item.price.toFixed(2)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.count > 50 ? 'bg-green-100 text-green-800' :
                      item.count > 10 ? 'bg-yellow-100 text-yellow-800' :
                      item.count > 0 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.count}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'active' ? 'bg-green-100 text-green-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status === 'active' ? 'Active' : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => openEditForm(item)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Edit item"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(item)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-3 flex items-center justify-between border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                  currentPage === totalPages
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Showing{' '}
                  <span className="font-medium">{startIndex + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {Math.min(startIndex + itemsPerPage, filteredItems.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{filteredItems.length}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  
                  {[...Array(totalPages)].map((_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => setCurrentPage(index + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === index + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : isDark
                          ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredItems.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No items found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  );

  const UserManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>User Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search users..."
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <button className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
          isDark 
            ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>User</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Role</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Join Date</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.name}</div>
                    <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'vendor' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {user.joinDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-900 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-green-600 hover:text-green-900 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const ProductManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Product Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Product</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Stock</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {products.map((product) => (
              <tr key={product.id}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {product.name}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {product.category}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ${product.price}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {product.stock}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' : 
                    product.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {product.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-900 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-green-600 hover:text-green-900 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Analytics & Reports</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={analytics.totalUsers?.toLocaleString()}
          icon={Users}
          trend={12.5}
          color="blue"
        />
        <StatCard
          title="Total Products"
          value={analytics.totalProducts?.toLocaleString()}
          icon={Package}
          trend={8.2}
          color="green"
        />
        <StatCard
          title="Total Orders"
          value={analytics.totalOrders?.toLocaleString()}
          icon={ShoppingCart}
          trend={analytics.monthlyGrowth}
          color="purple"
        />
        <StatCard
          title="Total Revenue"
          value={`$${analytics.totalRevenue?.toLocaleString()}`}
          icon={DollarSign}
          trend={18.7}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-lg shadow p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topSellingProducts?.map((product, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{product.name}</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.sales} sales</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Orders</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>#{order.id} - {order.customer}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{order.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>${order.total}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify