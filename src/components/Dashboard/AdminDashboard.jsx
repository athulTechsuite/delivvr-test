import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader,
  MoreHorizontal
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Complete status enum definition
const ITEM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  OUT_OF_STOCK: 'out_of_stock'
};

const AdminDashboard = () => {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('items');
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Item management states
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState(null);
  
  // Operation queue for CRUD operations
  const [operationQueue, setOperationQueue] = useState([]);
  const [isProcessingOperation, setIsProcessingOperation] = useState(false);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    image: null,
    status: ITEM_STATUS.ACTIVE
  });
  const [formErrors, setFormErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);

  const ITEMS_PER_PAGE = 20;
  const MAX_IMAGE_SIZE = 200 * 1024; // 200kb

  // Advanced file validation with content checking
  const validateFileContent = useCallback(async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const uint8Array = new Uint8Array(buffer);
        
        // Check for common image file signatures
        const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF;
        const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
        const isGIF = uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46;
        const isWebP = uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50;
        
        const isValidImage = isJPEG || isPNG || isGIF || isWebP;
        resolve(isValidImage);
      };
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // API integration functions
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      const response = await fetch(`/api/admin/${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  }, []);

  // Operation queue processor
  const processOperationQueue = useCallback(async () => {
    if (isProcessingOperation || operationQueue.length === 0) return;
    
    setIsProcessingOperation(true);
    const operation = operationQueue[0];
    
    try {
      await operation.execute();
      setOperationQueue(prev => prev.slice(1));
    } catch (error) {
      console.error('Operation failed:', error);
      showNotification(operation.errorMessage || 'Operation failed', 'error');
    } finally {
      setIsProcessingOperation(false);
    }
  }, [isProcessingOperation, operationQueue]);

  // Process queue when operations are added
  useEffect(() => {
    processOperationQueue();
  }, [operationQueue, processOperationQueue]);

  // Memoized filtered items for performance optimization
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // In production, replace with actual API calls
        const usersData = await apiCall('users').catch(() => [
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'customer', status: 'active', joinDate: '2024-01-15' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'vendor', status: 'active', joinDate: '2024-01-20' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'customer', status: 'inactive', joinDate: '2024-01-25' }
        ]);

        const itemsData = await apiCall('items').catch(() => [
          { id: 1, name: 'Wireless Headphones', description: 'Premium noise-canceling headphones', price: 99.99, category: 'Electronics', status: ITEM_STATUS.ACTIVE, image: '/images/headphones.jpg', createdAt: '2024-01-15', stock: 50 },
          { id: 2, name: 'Running Shoes', description: 'Comfortable athletic shoes for running', price: 129.99, category: 'Sports', status: ITEM_STATUS.ACTIVE, image: '/images/shoes.jpg', createdAt: '2024-01-20', stock: 30 },
          { id: 3, name: 'Coffee Maker', description: 'Automatic drip coffee maker', price: 79.99, category: 'Appliances', status: ITEM_STATUS.INACTIVE, image: '/images/coffee.jpg', createdAt: '2024-01-25', stock: 0 },
          { id: 4, name: 'Gaming Mouse', description: 'High-precision gaming mouse', price: 59.99, category: 'Electronics', status: ITEM_STATUS.ACTIVE, image: '/images/mouse.jpg', createdAt: '2024-01-28', stock: 75 },
          { id: 5, name: 'Yoga Mat', description: 'Non-slip exercise mat', price: 29.99, category: 'Sports', status: ITEM_STATUS.ACTIVE, image: '/images/yoga.jpg', createdAt: '2024-01-30', stock: 100 }
        ]);

        const ordersData = await apiCall('orders').catch(() => [
          { id: 1, customer: 'John Doe', total: 199.98, status: 'completed', date: '2024-01-30' },
          { id: 2, customer: 'Jane Smith', total: 99.99, status: 'pending', date: '2024-01-31' },
          { id: 3, customer: 'Bob Johnson', total: 259.97, status: 'shipped', date: '2024-02-01' }
        ]);

        const analyticsData = await apiCall('analytics').catch(() => ({
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
        }));

        setUsers(usersData);
        setItems(itemsData);
        setOrders(ordersData);
        setAnalytics(analyticsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching admin data:', error);
        showNotification('Error fetching data', 'error');
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [apiCall]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!itemForm.name.trim()) errors.name = 'Name is required';
    if (!itemForm.description.trim()) errors.description = 'Description is required';
    if (!itemForm.category.trim()) errors.category = 'Category is required';
    if (!itemForm.price || parseFloat(itemForm.price) <= 0) errors.price = 'Valid price is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [itemForm]);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Enhanced file validation
    if (file.size > MAX_IMAGE_SIZE) {
      showNotification('Image size must be less than 200KB', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file', 'error');
      return;
    }

    // Validate actual file content
    const isValidContent = await validateFileContent(file);
    if (!isValidContent) {
      showNotification('Invalid image file format or corrupted file', 'error');
      return;
    }

    setItemForm(prev => ({ ...prev, image: file }));
    
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }, [showNotification, validateFileContent]);

  const resetForm = useCallback(() => {
    setItemForm({
      name: '',
      description: '',
      category: '',
      price: '',
      image: null,
      status: ITEM_STATUS.ACTIVE
    });
    setFormErrors({});
    setImagePreview(null);
    setEditingItem(null);
  }, []);

  const queueOperation = useCallback((operation) => {
    setOperationQueue(prev => [...prev, operation]);
  }, []);

  const handleSubmitItem = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const operation = {
      execute: async () => {
        setItemsLoading(true);
        
        try {
          const formData = new FormData();
          Object.keys(itemForm).forEach(key => {
            if (itemForm[key] !== null) {
              formData.append(key, itemForm[key]);
            }
          });
          
          const endpoint = editingItem ? `items/${editingItem.id}` : 'items';
          const method = editingItem ? 'PUT' : 'POST';
          
          const result = await apiCall(endpoint, {
            method,
            body: formData,
            headers: {} // Don't set Content-Type for FormData
          }).catch(async () => {
            // Fallback to mock behavior for development
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              id: editingItem ? editingItem.id : Date.now(),
              ...itemForm,
              price: parseFloat(itemForm.price),
              createdAt: editingItem ? editingItem.createdAt : new Date().toISOString().split('T')[0],
              stock: editingItem ? editingItem.stock : 0,
              image: imagePreview || (editingItem && editingItem.image) || '/images/placeholder.jpg'
            };
          });

          if (editingItem) {
            setItems(prev => prev.map(item => item.id === editingItem.id ? result : item));
            showNotification('Item updated successfully');
          } else {
            setItems(prev => [result, ...prev]);
            showNotification('Item created successfully');
          }

          setShowItemForm(false);
          resetForm();
        } catch (error) {
          showNotification('Error saving item', 'error');
        } finally {
          setItemsLoading(false);
        }
      },
      errorMessage: 'Failed to save item'
    };

    queueOperation(operation);
  }, [itemForm, editingItem, validateForm, imagePreview, showNotification, resetForm, apiCall, queueOperation]);

  const handleEditItem = useCallback((item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price.toString(),
      image: null,
      status: item.status
    });
    setImagePreview(item.image);
    setShowItemForm(true);
  }, []);

  const handleDeleteItem = useCallback(async (itemId) => {
    const operation = {
      execute: async () => {
        setItemsLoading(true);
        
        try {
          await apiCall(`items/${itemId}`, { method: 'DELETE' }).catch(async () => {
            // Fallback for development
            await new Promise(resolve => setTimeout(resolve, 500));
          });
          
          setItems(prev => prev.filter(item => item.id !== itemId));
          showNotification('Item deleted successfully');
        } catch (error) {
          showNotification('Error deleting item', 'error');
        } finally {
          setItemsLoading(false);
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }
      },
      errorMessage: 'Failed to delete item'
    };

    queueOperation(operation);
  }, [showNotification, apiCall, queueOperation]);

  const handleBulkDelete = useCallback(async () => {
    const operation = {
      execute: async () => {
        setItemsLoading(true);
        
        try {
          await apiCall('items/bulk-delete', {
            method: 'DELETE',
            body: JSON.stringify({ ids: selectedItems })
          }).catch(async () => {
            // Fallback for development
            await new Promise(resolve => setTimeout(resolve, 1000));
          });
          
          setItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
          showNotification(`${selectedItems.length} items deleted successfully`);
          setSelectedItems([]);
        } catch (error) {
          showNotification('Error deleting items', 'error');
        } finally {
          setItemsLoading(false);
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }
      },
      errorMessage: 'Failed to delete items'
    };

    queueOperation(operation);
  }, [selectedItems, showNotification, apiCall, queueOperation]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredItems, currentPage]);

  const categories = useMemo(() => [...new Set(items.map(item => item.category))], [items]);
  const statuses = Object.values(ITEM_STATUS);

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }) => (
    <div className={`rounded-lg shadow-md p-4 md:p-6 border-l-4 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`p-2 md:p-3 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
          <Icon className={`h-5 w-5 md:h-6 md:w-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
        </div>
      </div>
    </div>
  );

  const ItemFormModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className={`text-lg md:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {editingItem ? 'Edit Item' : 'Create New Item'}
          </h2>
          <button
            onClick={() => { setShowItemForm(false); resetForm(); }}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmitItem} className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Name *
              </label>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  formErrors.name ? 'border-red-500' : 
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  formErrors.category ? 'border-red-500' : 
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Enter category"
              />
              {formErrors.category && <p className="text-red-500 text-sm mt-1">{formErrors.category}</p>}
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description *
            </label>
            <textarea
              value={itemForm.description}
              onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                formErrors.description ? 'border-red-500' : 
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="Enter item description"
            />
            {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={itemForm.price}
                onChange={(e) => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  formErrors.price ? 'border-red-500' : 
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="0.00"
              />
              {formErrors.price && <p className="text-red-500 text-sm mt-1">{formErrors.price}</p>}
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={itemForm.status}
                onChange={(e) => setItemForm(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={ITEM_STATUS.ACTIVE}>Active</option>
                <option value={ITEM_STATUS.INACTIVE}>Inactive</option>
                <option value={ITEM_STATUS.DRAFT}>Draft</option>
                <option value={ITEM_STATUS.ARCHIVED}>Archived</option>
                <option value={ITEM_STATUS.OUT_OF_STOCK}>Out of Stock</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Image (max 200KB)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className={`flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'
                }`}
              >
                <Upload className="h-4 w-4" />
                Upload Image
              </label>
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setItemForm(prev => ({ ...prev, image: null })); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { setShowItemForm(false); resetForm(); }}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                isDark 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={itemsLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
            >
              {itemsLoading && <Loader className="h-4 w-4 animate-spin" />}
              {editingItem ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const DeleteConfirmModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-md w-full rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Confirm Deletion
            </h2>
          </div>
          <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {deleteTarget === 'bulk' 
              ? `Are you sure you want to delete ${selectedItems.length} selected items?`
              : 'Are you sure you want to delete this item?'
            } This action cannot be undone.
          </p>
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                isDark 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={deleteTarget === 'bulk' ? handleBulkDelete : () => handleDeleteItem(deleteTarget)}
              disabled={itemsLoading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
            >
              {itemsLoading && <Loader className="h-4 w-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const Notification = () => {
    if (!notification) return null;
    
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-green-500 text-white'
        }`}>
          {notification.type === 'error' ? 
            <AlertCircle className="h-4 w-4" /> : 
            <CheckCircle className="h-4 w-4" />
          }
          {notification.message}
        </div>
      </div>
    );
  };

  const ItemManagementTab = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {selectedItems.length > 0 && (
            <button
              onClick={() => { setDeleteTarget('bulk'); setShowDeleteConfirm(true); }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors justify-center sm:justify-start"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedItems.length})
            </button>
          )}
          <button
            onClick={() => setShowItemForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors justify-center sm:justify-start"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Search and Filters - Enhanced responsive design */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Table - Enhanced responsive design */}
      <div className={`rounded-lg shadow overflow-hidden relative ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {itemsLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className="px-3 md:px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(paginatedItems.map(item => item.id));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Item</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(prev => [...prev, item.id]);
                        } else {
                          setSelectedItems(prev => prev.filter(id => id !== item.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img src={item.image} alt={item.name} className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-cover mr-2 md:mr-4" />
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                        <div className={`text-xs md:text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-500'} sm:hidden md:block`}>{item.description}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} sm:table-cell md:hidden`}>{item.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 md:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.category}
                  </td>
                  <td className={`px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ${item.price}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === ITEM_STATUS.ACTIVE ? 'bg-green-100 text-green-800' : 
                      item.status === ITEM_STATUS.INACTIVE ? 'bg-red-100 text-red-800' :
                      item.status === ITEM_STATUS.DRAFT ? 'bg-yellow-100 text-yellow-800' :
                      item.status === ITEM_STATUS.ARCHIVED ? 'bg-gray-100 text-gray-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1 md:space-x-2">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-green-600 hover:text-green-900 transition-colors p-1"
                        title="Edit"
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(item.id); setShowDeleteConfirm(true); }}
                        className="text-red-600 hover:text-red-900 transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination - Enhanced responsive design */}
        {totalPages > 1 && (
          <div className={`px-3 md:px-6 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
              <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    isDark 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className={`px-2 md:px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    isDark 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const UserManagementTab = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>User Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center">
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
        <button className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors justify-center ${
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
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>User</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Role</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Join Date</th>
                <th className={`px-3 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.name}</div>
                      <div className={`text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{user.email}</div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} sm:hidden`}>
                        {user.role} • {user.status}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'vendor' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={`px-3 md:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {user.joinDate}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1 md:space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors p-1" title="View">
                        <Eye className="h-3 w-3 md:h-4 md:w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900 transition-colors p-1" title="Edit">
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 transition-colors p-1" title="Delete">
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
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

  const AnalyticsTab = () => (
    <div className="space-y-4 md:space-y-6">
      <h2 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Analytics & Reports</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <div className={`rounded-lg shadow p-4 md:p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topSellingProducts?.map((product, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} truncate mr-2`}>{product.name}</span>
                <span className={`text-sm font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.sales} sales</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-lg shadow p-4 md:p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Orders</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>#{order.id} - {order.customer}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{order.date}</p>
                </div>
                <div className="text-right ml-2">
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
          <p className={`mt-1 md:mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Manage your eCommerce platform</p>
        </div>

        {/* Navigation Tabs - Enhanced responsive design */}
        <div className="mb-6 md:mb-8">
          <nav className="flex space-x-4 md:space-x-8 overflow-x-auto scrollbar-hide">
            {[
              { id: 'items', name: 'Items', icon: Package },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-2 px-3 md:px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200 hover:border-gray-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className={`rounded-lg shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="p-4 md:p-6">
            {activeTab === 'items' && <ItemManagementTab />}
            {activeTab === 'users' && <UserManagementTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showItemForm && <ItemFormModal />}
      {showDeleteConfirm && <DeleteConfirmModal />}
      
      {/* Notification */}
      <Notification />
    </div>
  );
};

export default AdminDashboard;