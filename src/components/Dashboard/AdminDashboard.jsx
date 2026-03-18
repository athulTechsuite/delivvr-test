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
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ITEM_STATUSES } from '../../constants/itemStatus';
import * as adminAPI from '../../services/adminAPI';

const AdminDashboard = () => {
  const { theme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('items');
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  
  // Item management state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    status: ITEM_STATUSES.ACTIVE,
    stock: '',
    image: null,
    version: null
  });
  const [formErrors, setFormErrors] = useState({});

  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Toys', 'Food & Drink'];

  // Authentication and authorization check
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      // Redirect to login or show unauthorized message
      setNotification({
        message: 'Unauthorized access. Admin role required.',
        type: 'error'
      });
      return;
    }
  }, [isAuthenticated, user]);

  // Show notification with error reporting
  const showNotification = useCallback((message, type = 'success', error = null) => {
    setNotification({ message, type });
    
    // Report errors to monitoring service
    if (type === 'error' && error) {
      console.error('Admin Dashboard Error:', error);
      // TODO: Integrate with error reporting service (e.g., Sentry)
      // errorReportingService.captureException(error);
    }
    
    setTimeout(() => setNotification(null), 5000);
  }, []);

  useEffect(() => {
    // Only fetch data if user is authenticated and authorized
    if (!isAuthenticated || user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const fetchAdminData = async () => {
      try {
        setLoading(true);
        
        const [usersData, itemsData, ordersData, analyticsData] = await Promise.all([
          adminAPI.getUsers(),
          adminAPI.getItems(),
          adminAPI.getOrders(),
          adminAPI.getAnalytics()
        ]);

        setUsers(usersData);
        setItems(itemsData);
        setOrders(ordersData);
        setAnalytics(analyticsData);
      } catch (error) {
        showNotification('Failed to load dashboard data. Please try again.', 'error', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [isAuthenticated, user, showNotification]);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.price || formData.price <= 0) errors.price = 'Valid price is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.stock || formData.stock < 0) errors.stock = 'Valid stock quantity is required';
    if (!Object.values(ITEM_STATUSES).includes(formData.status)) errors.status = 'Invalid status selected';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setOperationLoading(true);
      let result;

      const itemData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
      };

      if (editingItem) {
        result = await adminAPI.updateItem(editingItem.id, itemData);
        // Update local state with optimistic update
        setItems(prevItems => 
          prevItems.map(item => 
            item.id === editingItem.id ? { ...item, ...result } : item
          )
        );
        showNotification('Item updated successfully');
      } else {
        result = await adminAPI.createItem(itemData);
        // Add new item to local state
        setItems(prevItems => [...prevItems, result]);
        showNotification('Item created successfully');
      }
      
      handleCloseForm();
    } catch (error) {
      if (error.code === 'VERSION_CONFLICT') {
        showNotification('Item was modified by another user. Please refresh and try again.', 'error');
      } else {
        showNotification('Failed to save item. Please try again.', 'error', error);
      }
    } finally {
      setOperationLoading(false);
    }
  };

  const handleCloseForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      status: ITEM_STATUSES.ACTIVE,
      stock: '',
      image: null,
      version: null
    });
    setFormErrors({});
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      status: item.status,
      stock: item.stock.toString(),
      image: null,
      version: item.version
    });
    setShowItemForm(true);
  };

  const handleDelete = (item) => {
    setDeletingItem(item);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      setOperationLoading(true);
      await adminAPI.deleteItem(deletingItem.id, deletingItem.version);
      
      // Remove from local state
      setItems(prevItems => prevItems.filter(item => item.id !== deletingItem.id));
      showNotification('Item deleted successfully');
      setShowDeleteDialog(false);
      setDeletingItem(null);
    } catch (error) {
      if (error.code === 'VERSION_CONFLICT') {
        showNotification('Item was modified by another user. Please refresh and try again.', 'error');
      } else {
        showNotification('Failed to delete item. Please try again.', 'error', error);
      }
    } finally {
      setOperationLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      setOperationLoading(true);
      
      // Get items with version info for optimistic locking
      const itemsToDelete = items
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({ id: item.id, version: item.version }));

      const results = await adminAPI.bulkDeleteItems(itemsToDelete);
      
      // Handle partial failures
      const successfulDeletes = results.filter(r => r.success).map(r => r.id);
      const failures = results.filter(r => !r.success);
      
      if (successfulDeletes.length > 0) {
        // Remove successfully deleted items from local state
        setItems(prevItems => 
          prevItems.filter(item => !successfulDeletes.includes(item.id))
        );
        setSelectedItems(prevSelected => 
          prevSelected.filter(id => !successfulDeletes.includes(id))
        );
      }
      
      if (failures.length === 0) {
        showNotification(`${successfulDeletes.length} items deleted successfully`);
      } else {
        showNotification(
          `${successfulDeletes.length} items deleted, ${failures.length} failed due to conflicts. Please refresh and retry.`,
          'warning'
        );
      }
    } catch (error) {
      showNotification('Failed to delete items. Please try again.', 'error', error);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedItems.length === 0 || !Object.values(ITEM_STATUSES).includes(newStatus)) return;

    try {
      setOperationLoading(true);
      
      // Get items with version info for optimistic locking
      const itemsToUpdate = items
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({ 
          id: item.id, 
          version: item.version, 
          updates: { status: newStatus } 
        }));

      const results = await adminAPI.bulkUpdateItems(itemsToUpdate);
      
      // Handle partial failures
      const successfulUpdates = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);
      
      if (successfulUpdates.length > 0) {
        // Update local state with successful updates
        setItems(prevItems => 
          prevItems.map(item => {
            const update = successfulUpdates.find(u => u.id === item.id);
            return update ? { ...item, ...update.data } : item;
          })
        );
        setSelectedItems([]);
      }
      
      if (failures.length === 0) {
        showNotification(`${successfulUpdates.length} items updated to ${newStatus}`);
      } else {
        showNotification(
          `${successfulUpdates.length} items updated, ${failures.length} failed due to conflicts. Please refresh and retry.`,
          'warning'
        );
      }
    } catch (error) {
      showNotification('Failed to update items. Please try again.', 'error', error);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    const currentItems = getFilteredItems();
    if (selectedItems.length === currentItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentItems.map(item => item.id));
    }
  };

  const getFilteredItems = () => {
    let filtered = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesStatus = !selectedStatus || item.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    return filtered;
  };

  const getPaginatedItems = () => {
    const filtered = getFilteredItems();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredItems().length / itemsPerPage);
  };

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

  const ItemManagementTab = () => {
    const paginatedItems = getPaginatedItems();
    const totalPages = getTotalPages();

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
          <button 
            onClick={() => setShowItemForm(true)}
            disabled={operationLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add New Item
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
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
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
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
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">All Status</option>
            {Object.values(ITEM_STATUSES).map(status => (
              <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {selectedItems.length} items selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkStatusUpdate(ITEM_STATUSES.ACTIVE)}
                  disabled={operationLoading}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Mark Active
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate(ITEM_STATUSES.INACTIVE)}
                  disabled={operationLoading}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  Mark Inactive
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={operationLoading}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Name</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Stock</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Created</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:${isDark ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                        <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{item.description.substring(0, 50)}...</div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.category}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ${item.price.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <span className={item.stock === 0 ? 'text-red-600 font-medium' : ''}>{item.stock}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === ITEM_STATUSES.ACTIVE ? 'bg-green-100 text-green-800' : 
                        item.status === ITEM_STATUSES.OUT_OF_STOCK ? 'bg-red-100 text-red-800' :
                        item.status === ITEM_STATUSES.INACTIVE ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.createdDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEdit(item)}
                          disabled={operationLoading}
                          className="text-green-600 hover:text-green-900 transition-colors disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item)}
                          disabled={operationLoading}
                          className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                          title="Delete"
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
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, getFilteredItems().length)} of {getFilteredItems().length} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded border ${
                  currentPage === 1 
                    ? `${isDark ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'} cursor-not-allowed`
                    : `${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} transition-colors`
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className={`px-3 py-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded border ${
                  currentPage === totalPages
                    ? `${isDark ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'} cursor-not-allowed`
                    : `${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} transition-colors`
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
          title="Total Items"
          value={analytics.totalItems?.toLocaleString()}
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
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Selling Items</h3>
          <div className="space-y-3">
            {analytics.topSellingItems?.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{item.name}</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.sales} sales</span>
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

  // Show unauthorized message if user is not admin
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Access Denied
          </h2>
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            You must be an administrator to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
          <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Manage your eCommerce platform</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'items', name: 'Items', icon: Package },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
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
          <div className="p-6">
            {activeTab === 'items' && <ItemManagementTab />}
            {activeTab === 'users' && <UserManagementTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 
          notification.type === 'warning' ? 'bg-yellow-500 text-white' :
          'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notification.message}
          <button onClick={() => setNotification(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h3>
                <button onClick={handleCloseForm} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={operationLoading}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                      formErrors.name ? 'border-red-500' : isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                  {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    disabled={operationLoading}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                      formErrors.description ? 'border-red-500' : isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                  {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      disabled={operationLoading}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                        formErrors.price ? 'border-red-500' : isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    />
                    {formErrors.price && <p className="text-red-500 text-sm mt-1">{formErrors.price}</p>}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Stock *
                    </label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      disabled={operationLoading}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                        formErrors.stock ? 'border-red-500' : isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    />
                    {formErrors.stock && <p className="text-red-500 text-sm mt-1">{formErrors.stock}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      disabled={operationLoading}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                        formErrors.category ? 'border-red-500' : isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    {formErrors.category && <p className="text-red-500 text-sm mt-1">{formErrors.category}</p>}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      disabled={operationLoading}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                        isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    >
                      {Object.values(ITEM_STATUSES).map(status => (
                        <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    disabled={operationLoading}
                    className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
                      isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={operationLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {operationLoading ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Confirm Delete
                </h3>
              </div>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to delete "{deletingItem?.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {setShowDeleteDialog(false); setDeletingItem(null);}}
                  disabled={operationLoading}
                  className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
                    isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={operationLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {operationLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;