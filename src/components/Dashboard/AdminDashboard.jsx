import React, { useState, useEffect, useCallback } from 'react';
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
  Download,
  CheckSquare,
  Square,
  MoreHorizontal,
  AlertCircle,
  X,
  Save,
  Image as ImageIcon
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ItemTable } from './components/ItemTable';
import { ItemFilters } from './components/ItemFilters';
import { ItemModal } from './components/ItemModal';
import { config } from '../../config/admin.config';
import { useWebSocket } from '../../hooks/useWebSocket';
import { validateForm, sanitizeInput } from '../../utils/validation';

const ITEM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock'
} as const;

const AdminDashboard = () => {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Item management states
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemFilters, setItemFilters] = useState({
    category: '',
    status: '',
    priceRange: { min: '', max: '' }
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showItemModal, setShowItemModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentItem, setCurrentItem] = useState(null);
  const [bulkActionMenu, setBulkActionMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [pendingOperations, setPendingOperations] = useState(new Set());

  // Form state for item modal
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    sku: '',
    status: ITEM_STATUS.ACTIVE,
    images: []
  });

  // WebSocket connection for real-time updates
  const { isConnected, lastMessage } = useWebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:8080');

  useEffect(() => {
    // Load categories from config
    const loadCategories = async () => {
      try {
        // Try to fetch from API first, fallback to config
        const response = await fetch('/api/categories');
        if (response.ok) {
          const apiCategories = await response.json();
          setCategories(apiCategories);
        } else {
          throw new Error('API not available');
        }
      } catch (error) {
        console.warn('Using fallback categories from config');
        setCategories(config.categories);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    // Handle real-time WebSocket updates
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        switch (data.type) {
          case 'PRODUCT_UPDATED':
            setProducts(prev => prev.map(product => 
              product.id === data.productId 
                ? { ...product, ...data.changes, updatedAt: data.timestamp }
                : product
            ));
            if (data.updatedBy !== 'current_user') {
              showMessage('info', `Product "${data.productName}" was updated by ${data.updatedBy}`);
            }
            break;
          case 'PRODUCT_CREATED':
            if (data.createdBy !== 'current_user') {
              setProducts(prev => [...prev, data.product]);
              showMessage('info', `New product "${data.product.name}" was added by ${data.createdBy}`);
            }
            break;
          case 'PRODUCT_DELETED':
            if (data.deletedBy !== 'current_user') {
              setProducts(prev => prev.filter(product => product.id !== data.productId));
              showMessage('info', `Product "${data.productName}" was deleted by ${data.deletedBy}`);
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    // Simulate API calls to fetch admin data
    const fetchAdminData = async () => {
      try {
        // Mock data - replace with actual API calls
        setUsers([
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'customer', status: 'active', joinDate: '2024-01-15' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'vendor', status: 'active', joinDate: '2024-01-20' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'customer', status: 'inactive', joinDate: '2024-01-25' }
        ]);

        setProducts([
          { 
            id: 1, 
            name: 'Wireless Headphones', 
            description: 'High-quality wireless headphones with noise cancellation',
            price: 99.99, 
            stock: 50, 
            category: 'Electronics', 
            status: ITEM_STATUS.ACTIVE,
            sku: 'WH-001',
            images: ['headphones1.jpg'],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-30',
            version: 1
          },
          { 
            id: 2, 
            name: 'Running Shoes', 
            description: 'Professional running shoes for athletes',
            price: 129.99, 
            stock: 30, 
            category: 'Sports', 
            status: ITEM_STATUS.ACTIVE,
            sku: 'RS-002',
            images: ['shoes1.jpg'],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-25',
            version: 1
          },
          { 
            id: 3, 
            name: 'Coffee Maker', 
            description: 'Automatic coffee maker with programmable settings',
            price: 79.99, 
            stock: 0, 
            category: 'Appliances', 
            status: ITEM_STATUS.OUT_OF_STOCK,
            sku: 'CM-003',
            images: ['coffee1.jpg'],
            createdAt: '2024-01-10',
            updatedAt: '2024-01-28',
            version: 1
          },
          { 
            id: 4, 
            name: 'Smartphone Case', 
            description: 'Protective case for smartphones',
            price: 24.99, 
            stock: 100, 
            category: 'Electronics', 
            status: ITEM_STATUS.ACTIVE,
            sku: 'SC-004',
            images: ['case1.jpg'],
            createdAt: '2024-01-12',
            updatedAt: '2024-01-22',
            version: 1
          }
        ]);

        setOrders([
          { id: 1, customer: 'John Doe', total: 199.98, status: 'completed', date: '2024-01-30' },
          { id: 2, customer: 'Jane Smith', total: 99.99, status: 'pending', date: '2024-01-31' },
          { id: 3, customer: 'Bob Johnson', total: 259.97, status: 'shipped', date: '2024-02-01' }
        ]);

        setAnalytics({
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
        });

        setAuditLog([
          { id: 1, action: 'Created', item: 'Wireless Headphones', user: 'Admin', timestamp: '2024-01-30 10:30:00' },
          { id: 2, action: 'Updated', item: 'Running Shoes', user: 'Admin', timestamp: '2024-01-29 15:45:00' },
          { id: 3, action: 'Deleted', item: 'Old Product', user: 'Admin', timestamp: '2024-01-28 09:15:00' }
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching admin data:', error);
        showMessage('error', 'Failed to load admin data');
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  // Filter and search items
  const filteredItems = products.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(itemSearchTerm.toLowerCase());
    
    const matchesCategory = !itemFilters.category || item.category === itemFilters.category;
    const matchesStatus = !itemFilters.status || item.status === itemFilters.status;
    
    const matchesPrice = (!itemFilters.priceRange.min || item.price >= parseFloat(itemFilters.priceRange.min)) &&
                        (!itemFilters.priceRange.max || item.price <= parseFloat(itemFilters.priceRange.max));

    return matchesSearch && matchesCategory && matchesStatus && matchesPrice;
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const validateItemForm = (formData) => {
    const errors = {};
    
    // Name validation
    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    }
    
    // SKU validation
    if (!formData.sku || !/^[A-Z]{2,3}-\d{3,}$/.test(formData.sku)) {
      errors.sku = 'SKU must follow format: ABC-123 (letters-numbers)';
    }
    
    // Price validation
    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      errors.price = 'Price must be a positive number';
    }
    
    // Stock validation
    const stock = parseInt(formData.stock);
    if (!formData.stock || isNaN(stock) || stock < 0) {
      errors.stock = 'Stock must be a non-negative integer';
    }
    
    // Category validation
    if (!formData.category) {
      errors.category = 'Please select a category';
    }
    
    // Status validation
    if (!Object.values(ITEM_STATUS).includes(formData.status)) {
      errors.status = 'Invalid status value';
    }
    
    return errors;
  };

  const showMessage = (type, message) => {
    if (type === 'success') {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 5000);
    } else if (type === 'error') {
      setError(message);
      setTimeout(() => setError(''), 5000);
    } else if (type === 'info') {
      // Could add info message state if needed
      console.info(message);
    }
  };

  const logAuditAction = (action, itemName) => {
    const newLogEntry = {
      id: auditLog.length + 1,
      action,
      item: itemName,
      user: 'Admin', // Replace with actual user
      timestamp: new Date().toLocaleString()
    };
    setAuditLog(prev => [newLogEntry, ...prev]);
  };

  const handleFileUpload = async (files) => {
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        
        const result = await response.json();
        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      return uploadedUrls;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Sanitize input data
      const sanitizedForm = {
        name: sanitizeInput(itemForm.name),
        description: sanitizeInput(itemForm.description),
        category: sanitizeInput(itemForm.category),
        price: sanitizeInput(itemForm.price),
        stock: sanitizeInput(itemForm.stock),
        sku: sanitizeInput(itemForm.sku),
        status: itemForm.status,
        images: itemForm.images
      };

      // Validate form
      const errors = validateItemForm(sanitizedForm);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        showMessage('error', 'Please fix the form errors before submitting');
        return;
      }

      setFormErrors({});
      
      // Handle file uploads if any
      if (itemForm.imageFiles && itemForm.imageFiles.length > 0) {
        try {
          const uploadedUrls = await handleFileUpload(itemForm.imageFiles);
          sanitizedForm.images = [...sanitizedForm.images, ...uploadedUrls];
        } catch (error) {
          showMessage('error', 'Failed to upload images');
          return;
        }
      }

      if (modalMode === 'add') {
        const operationId = Date.now().toString();
        setPendingOperations(prev => new Set([...prev, operationId]));
        
        try {
          const newItem = {
            ...sanitizedForm,
            id: products.length + 1,
            price: parseFloat(sanitizedForm.price),
            stock: parseInt(sanitizedForm.stock),
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            version: 1
          };
          
          setProducts(prev => [...prev, newItem]);
          logAuditAction('Created', sanitizedForm.name);
          showMessage('success', 'Item created successfully');
        } finally {
          setPendingOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
      } else if (modalMode === 'edit') {
        const operationId = `edit-${currentItem.id}`;
        setPendingOperations(prev => new Set([...prev, operationId]));
        
        try {
          // Check for version conflicts (optimistic locking)
          const currentProduct = products.find(p => p.id === currentItem.id);
          if (currentProduct && currentProduct.version !== currentItem.version) {
            showMessage('error', 'This item has been modified by another user. Please refresh and try again.');
            return;
          }
          
          setProducts(prev => prev.map(item => 
            item.id === currentItem.id 
              ? { 
                  ...item, 
                  ...sanitizedForm, 
                  price: parseFloat(sanitizedForm.price),
                  stock: parseInt(sanitizedForm.stock),
                  updatedAt: new Date().toISOString().split('T')[0],
                  version: item.version + 1
                }
              : item
          ));
          logAuditAction('Updated', sanitizedForm.name);
          showMessage('success', 'Item updated successfully');
        } finally {
          setPendingOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(operationId);
            return newSet;
          });
        }
      }
      
      setShowItemModal(false);
      resetItemForm();
    } catch (error) {
      console.error('Error saving item:', error);
      showMessage('error', 'Failed to save item. Please try again.');
    }
  };

  const handleDeleteItem = async () => {
    try {
      const operationId = `delete-${itemToDelete.id}`;
      setPendingOperations(prev => new Set([...prev, operationId]));
      
      try {
        setProducts(prev => prev.filter(item => item.id !== itemToDelete.id));
        logAuditAction('Deleted', itemToDelete.name);
        showMessage('success', 'Item deleted successfully');
        setShowDeleteConfirm(false);
        setItemToDelete(null);
      } finally {
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(operationId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showMessage('error', 'Failed to delete item. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const operationId = 'bulk-delete';
      setPendingOperations(prev => new Set([...prev, operationId]));
      
      try {
        const itemsToDelete = products.filter(item => selectedItems.has(item.id));
        
        // Check for concurrent modifications
        const conflictingItems = itemsToDelete.filter(item => 
          pendingOperations.has(`edit-${item.id}`)
        );
        
        if (conflictingItems.length > 0) {
          showMessage('error', 'Some items are being modified. Please wait and try again.');
          return;
        }
        
        setProducts(prev => prev.filter(item => !selectedItems.has(item.id)));
        
        itemsToDelete.forEach(item => {
          logAuditAction('Bulk Deleted', item.name);
        });
        
        showMessage('success', `${selectedItems.size} items deleted successfully`);
        setSelectedItems(new Set());
        setBulkActionMenu(false);
      } finally {
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(operationId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
      showMessage('error', 'Failed to delete items. Please try again.');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    try {
      if (!Object.values(ITEM_STATUS).includes(status)) {
        showMessage('error', 'Invalid status value');
        return;
      }

      const operationId = 'bulk-status-update';
      setPendingOperations(prev => new Set([...prev, operationId]));
      
      try {
        setProducts(prev => prev.map(item => 
          selectedItems.has(item.id) 
            ? { 
                ...item, 
                status, 
                updatedAt: new Date().toISOString().split('T')[0],
                version: item.version + 1 
              }
            : item
        ));
        
        showMessage('success', `${selectedItems.size} items updated successfully`);
        setSelectedItems(new Set());
        setBulkActionMenu(false);
      } finally {
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(operationId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error in bulk status update:', error);
      showMessage('error', 'Failed to update items. Please try again.');
    }
  };

  const openItemModal = (mode, item = null) => {
    setModalMode(mode);
    setCurrentItem(item);
    setFormErrors({});
    if (item) {
      setItemForm({
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price.toString(),
        stock: item.stock.toString(),
        sku: item.sku,
        status: item.status,
        images: item.images || [],
        imageFiles: []
      });
    } else {
      resetItemForm();
    }
    setShowItemModal(true);
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      category: '',
      price: '',
      stock: '',
      sku: '',
      status: ITEM_STATUS.ACTIVE,
      images: [],
      imageFiles: []
    });
    setFormErrors({});
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleAllItemsSelection = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.id)));
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }) => (
    <div className={`rounded-lg shadow-md p-4 lg:p-6 border-l-4 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={`text-xs sm:text-sm font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-lg sm:text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {trend && (
            <p className={`text-xs sm:text-sm ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
          <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
        </div>
      </div>
    </div>
  );

  const UserManagementTab = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>User Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center sm:justify-start">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
        <button className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors w-full sm:w-auto justify-center sm:justify-start ${
          isDark 
            ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>User</th>
                <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Role</th>
                <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Join Date</th>
                <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className={`text-sm font-medium truncate max-w-[120px] sm:max-w-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.name}</div>
                      <div className={`text-sm truncate max-w-[120px] sm:max-w-none ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{user.email}</div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'vendor' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={`px-3 sm:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {user.joinDate}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1 sm:space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors p-1">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900 transition-colors p-1">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 transition-colors p-1">
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
    </div>
  );

  const ProductManagementTab = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
          {!isConnected && (
            <p className="text-sm text-yellow-600 mt-1">Real-time updates disconnected</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {selectedItems.size > 0 && (
            <div className="relative">
              <button 
                onClick={() => setBulkActionMenu(!bulkActionMenu)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors w-full sm:w-auto justify-center"
              >
                <MoreHorizontal className="h-4 w-4" />
                Bulk Actions ({selectedItems.size})
              </button>
              {bulkActionMenu && (
                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-10 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
                  <div className="py-1">
                    <button 
                      onClick={() => handleBulkStatusUpdate(ITEM_STATUS.ACTIVE)}
                      disabled={pendingOperations.has('bulk-status-update')}
                      className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Mark as Active
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate(ITEM_STATUS.INACTIVE)}
                      disabled={pendingOperations.has('bulk-status-update')}
                      className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Mark as Inactive
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      disabled={pendingOperations.has('bulk-delete')}
                      className="block px-4 py-2 text-sm w-full text-left hover:bg-red-100 dark:hover:bg-red-900 text-red-600 disabled:opacity-50"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button 
            onClick={() => openItemModal('add')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <ItemFilters 
        searchTerm={itemSearchTerm}
        onSearchChange={setItemSearchTerm}
        filters={itemFilters}
        onFiltersChange={setItemFilters}
        categories={categories}
        statusOptions={Object.values(ITEM_STATUS)}
        isDark={isDark}
      />

      <ItemTable 
        items={paginatedItems}
        selectedItems={selectedItems}
        onItemSelect={toggleItemSelection}
        onSelectAll={toggleAllItemsSelection}
        onView={(item) => openItemModal('view', item)}
        onEdit={(item) => openItemModal('edit', item)}
        onDelete={(item) => {
          setItemToDelete(item);
          setShowDeleteConfirm(true);
        }}
        pendingOperations={pendingOperations}
        isDark={isDark}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className={`text-sm text-center sm:text-left ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} results
          </div>
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-2 border rounded-lg transition-colors text-sm whitespace-nowrap ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}
            >
              Previous
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const pageNum = currentPage <= 3 ? i + 1 : 
                            currentPage >= totalPages - 2 ? totalPages - 4 + i : 
                            currentPage - 2 + i;
              if (pageNum > totalPages || pageNum < 1) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 sm:px-3 py-2 border rounded-lg transition-colors text-sm ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : `hover:bg-gray-50 dark:hover:bg-gray-700 ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-2 sm:px-3 py-2 border rounded-lg transition-colors text-sm whitespace-nowrap ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-4 sm:space-y-6">
      <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Analytics & Reports</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className={`rounded-lg shadow p-4 sm:p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topSellingProducts?.map((product, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm truncate mr-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{product.name}</span>
                <span className={`text-sm font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.sales} sales</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-lg shadow p-4 sm:p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Orders</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center">
                <div className="min-w-0 flex-1 mr-2">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>#{order.id} - {order.customer}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{order.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
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

      {/* Audit Log */}
      <div className={`rounded-lg shadow p-4 sm:p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Audit Trail</h3>
        <div className="space-y-2">
          {auditLog.slice(0, 10).map((log) => (
            <div key={log.id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                  log.action === 'Created' ? 'bg-green-100 text-green-800' :
                  log.action === 'Updated' ? 'bg-blue-100 text-blue-800' :
                  log.action === 'Deleted' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {log.action}
                </span>
                <span className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{log.item}</span>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>by {log.user}</span>
              </div>
              <span className={`text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Delete Confirmation Modal
  const DeleteConfirmModal = () => (
    showDeleteConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-md w-full`}>
          <div className="p-4 sm:p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Delete Item
              </h3>
            </div>
            <p className={`mb-6 text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`px-4 py-2 border rounded-lg transition-colors w-full sm:w-auto ${
                  isDark 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={pendingOperations.has(`delete-${itemToDelete?.id}`)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                {pendingOperations.has(`delete-${itemToDelete?.id}`) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-16 sm:h-32 w-16 sm:w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
          <p className={`mt-2 text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Manage your eCommerce platform</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 sm:mb-8">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-2 sm:pb-0">
            {[
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'products', name: 'Items', icon: Package },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-2 px-3 sm:px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200 hover:border-gray-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }`}
              >
                <Icon className="h-4 w-4" />
                {name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className={`rounded-lg shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="p-4 sm:p-6">
            {activeTab === 'overview' && <AnalyticsTab />}
            {activeTab === 'users' && <UserManagementTab />}
            {activeTab === 'products' && <ProductManagementTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ItemModal 
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        mode={modalMode}
        item={currentItem}
        formData={itemForm}
        onFormChange={setItemForm}
        onSubmit={handleItemSubmit}
        onFileUpload={handleFileUpload}
        categories={categories}
        statusOptions={Object.values(ITEM_STATUS)}
        errors={formErrors}
        isDark={isDark}
        isLoading={pendingOperations.size > 0}
      />
      <DeleteConfirmModal />
    </div>
  );
};

export default AdminDashboard;