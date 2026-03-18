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
  X,
  Save,
  AlertTriangle,
  Check,
  Clock,
  FileText,
  Image,
  MoreHorizontal
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboard = () => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('items');
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [notification, setNotification] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      window.location.href = '/dashboard';
    }
  }, [user]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API calls
      setUsers([
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'customer', status: 'active', joinDate: '2024-01-15' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'vendor', status: 'active', joinDate: '2024-01-20' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'customer', status: 'inactive', joinDate: '2024-01-25' }
      ]);

      setItems([
        { 
          id: 1, 
          name: 'Wireless Headphones', 
          description: 'High-quality wireless headphones with noise cancellation',
          price: 99.99, 
          quantity: 50, 
          category: 'Electronics', 
          status: 'active',
          image: '/api/placeholder/150/150',
          files: ['manual.pdf', 'warranty.pdf'],
          createdAt: '2024-01-15',
          updatedAt: '2024-01-30',
          updatedBy: 'Admin'
        },
        { 
          id: 2, 
          name: 'Running Shoes', 
          description: 'Comfortable running shoes for all terrains',
          price: 129.99, 
          quantity: 30, 
          category: 'Sports', 
          status: 'active',
          image: '/api/placeholder/150/150',
          files: ['size_guide.pdf'],
          createdAt: '2024-01-20',
          updatedAt: '2024-01-28',
          updatedBy: 'Admin'
        },
        { 
          id: 3, 
          name: 'Coffee Maker', 
          description: 'Automatic drip coffee maker with timer',
          price: 79.99, 
          quantity: 0, 
          category: 'Appliances', 
          status: 'out_of_stock',
          image: '/api/placeholder/150/150',
          files: ['manual.pdf', 'recipes.pdf'],
          createdAt: '2024-01-25',
          updatedAt: '2024-02-01',
          updatedBy: 'Admin'
        }
      ]);

      setOrders([
        { id: 1, customer: 'John Doe', total: 199.98, status: 'completed', date: '2024-01-30' },
        { id: 2, customer: 'Jane Smith', total: 99.99, status: 'pending', date: '2024-01-31' },
        { id: 3, customer: 'Bob Johnson', total: 259.97, status: 'shipped', date: '2024-02-01' }
      ]);

      setAnalytics({
        totalUsers: 1250,
        totalItems: 450,
        totalOrders: 850,
        totalRevenue: 125000,
        monthlyGrowth: 15.5,
        lowStockItems: 12,
        outOfStockItems: 5,
        topSellingItems: [
          { name: 'Wireless Headphones', sales: 156 },
          { name: 'Running Shoes', sales: 142 },
          { name: 'Coffee Maker', sales: 98 }
        ]
      });

      setAuditLogs([
        { 
          id: 1, 
          action: 'Item Created', 
          itemName: 'Wireless Headphones', 
          user: 'Admin', 
          timestamp: '2024-02-01 10:30:00',
          details: 'New item added to inventory'
        },
        { 
          id: 2, 
          action: 'Item Updated', 
          itemName: 'Running Shoes', 
          user: 'Admin', 
          timestamp: '2024-02-01 09:15:00',
          details: 'Price updated from $119.99 to $129.99'
        },
        { 
          id: 3, 
          action: 'Item Deleted', 
          itemName: 'Old Product', 
          user: 'Admin', 
          timestamp: '2024-01-31 16:45:00',
          details: 'Item removed from inventory'
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      showNotification('Error loading data', 'error');
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateItem = () => {
    setEditingItem({
      name: '',
      description: '',
      price: '',
      quantity: '',
      category: '',
      status: 'active',
      image: null,
      files: []
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleSaveItem = async (itemData) => {
    try {
      if (editingItem.id) {
        // Update existing item
        setItems(items.map(item => 
          item.id === editingItem.id 
            ? { 
                ...item, 
                ...itemData, 
                updatedAt: new Date().toISOString().split('T')[0],
                updatedBy: user?.name || 'Admin'
              }
            : item
        ));
        showNotification('Item updated successfully');
        
        // Add audit log
        setAuditLogs([{
          id: Date.now(),
          action: 'Item Updated',
          itemName: itemData.name,
          user: user?.name || 'Admin',
          timestamp: new Date().toLocaleString(),
          details: 'Item details updated'
        }, ...auditLogs]);
      } else {
        // Create new item
        const newItem = {
          id: Date.now(),
          ...itemData,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          updatedBy: user?.name || 'Admin'
        };
        setItems([newItem, ...items]);
        showNotification('Item created successfully');
        
        // Add audit log
        setAuditLogs([{
          id: Date.now(),
          action: 'Item Created',
          itemName: itemData.name,
          user: user?.name || 'Admin',
          timestamp: new Date().toLocaleString(),
          details: 'New item added to inventory'
        }, ...auditLogs]);
      }
      
      setShowItemModal(false);
      setEditingItem(null);
    } catch (error) {
      showNotification('Error saving item', 'error');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const item = items.find(i => i.id === itemId);
      setItems(items.filter(i => i.id !== itemId));
      showNotification('Item deleted successfully');
      
      // Add audit log
      setAuditLogs([{
        id: Date.now(),
        action: 'Item Deleted',
        itemName: item?.name || 'Unknown',
        user: user?.name || 'Admin',
        timestamp: new Date().toLocaleString(),
        details: 'Item removed from inventory'
      }, ...auditLogs]);
      
      setShowDeleteConfirm(null);
    } catch (error) {
      showNotification('Error deleting item', 'error');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const deletedItems = items.filter(item => selectedItems.includes(item.id));
      setItems(items.filter(item => !selectedItems.includes(item.id)));
      showNotification(`${selectedItems.length} items deleted successfully`);
      
      // Add bulk audit logs
      deletedItems.forEach(item => {
        setAuditLogs(prev => [{
          id: Date.now() + Math.random(),
          action: 'Item Deleted',
          itemName: item.name,
          user: user?.name || 'Admin',
          timestamp: new Date().toLocaleString(),
          details: 'Bulk delete operation'
        }, ...prev]);
      });
      
      setSelectedItems([]);
    } catch (error) {
      showNotification('Error deleting items', 'error');
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllItems = () => {
    const filteredItems = getFilteredItems();
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const getFilteredItems = useCallback(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, filterStatus]);

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

  const ItemModal = ({ item, onSave, onClose }) => {
    const [formData, setFormData] = useState(item || {
      name: '',
      description: '',
      price: '',
      quantity: '',
      category: '',
      status: 'active',
      image: null,
      files: []
    });
    const [errors, setErrors] = useState({});

    const validateForm = () => {
      const newErrors = {};
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
      if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price is required';
      if (!formData.quantity || formData.quantity < 0) newErrors.quantity = 'Valid quantity is required';
      if (!formData.category.trim()) newErrors.category = 'Category is required';
      
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (validateForm()) {
        onSave(formData);
      }
    };

    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        setFormData({ ...formData, image: file });
      }
    };

    const handleFileUpload = (e) => {
      const files = Array.from(e.target.files);
      setFormData({ ...formData, files: [...formData.files, ...files] });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={`rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {item?.id ? 'Edit Item' : 'Create New Item'}
              </h2>
              <button onClick={onClose} className={`text-gray-500 hover:text-gray-700 ${isDark ? 'hover:text-gray-300' : ''}`}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name ? 'border-red-500' : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                    }`}
                    placeholder="Enter item name"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Category *
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.category ? 'border-red-500' : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                    }`}
                    placeholder="Enter category"
                  />
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.price ? 'border-red-500' : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.quantity ? 'border-red-500' : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description *
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.description ? 'border-red-500' : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                  }`}
                  placeholder="Enter item description"
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                  }`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Item Image
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      <Image className="h-4 w-4" />
                      Upload Image
                    </label>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Associated Files
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="files-upload"
                    />
                    <label
                      htmlFor="files-upload"
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      Upload Files
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {item?.id ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const DeleteConfirmModal = ({ item, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-xl max-w-md w-full mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Confirm Deletion
            </h2>
          </div>
          <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Are you sure you want to delete "<strong>{item?.name}</strong>"? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                isDark 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ItemManagementTab = () => {
    const filteredItems = getFilteredItems();

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
          <div className="flex gap-3">
            {selectedItems.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedItems.length})
              </button>
            )}
            <button
              onClick={handleCreateItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search items by name or description..."
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>

        {/* Items Table */}
        <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                    onChange={handleSelectAllItems}
                    className="rounded"
                  />
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Item</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Quantity</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Updated</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {filteredItems.map((item) => (
                <tr key={item.id} className={selectedItems.includes(item.id) ? (isDark ? 'bg-gray-700' : 'bg-blue-50') : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-12 w-12">
                        <img
                          className="h-12 w-12 rounded-lg object-cover"
                          src={item.image || '/api/placeholder/48/48'}
                          alt={item.name}
                        />
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.name}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                          {item.description.length > 50 
                            ? `${item.description.substring(0, 50)}...` 
                            : item.description
                          }
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
                    <span className={item.quantity < 10 && item.quantity > 0 ? 'text-yellow-600' : item.quantity === 0 ? 'text-red-600' : ''}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'active' ? 'bg-green-100 text-green-800' : 
                      item.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    <div>{item.updatedAt}</div>
                    <div className="text-xs">by {item.updatedBy}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditItem(item)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Edit Item"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(item)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredItems.length === 0 && (
            <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No items found matching your search criteria.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AuditLogTab = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Audit Trail</h2>
      
      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Action</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Item</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>User</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Timestamp</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Details</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${
                      log.action.includes('Created') ? 'bg-green-100 text-green-600' :
                      log.action.includes('Updated') ? 'bg-blue-100 text-blue-600' :
                      log.action.includes('Deleted') ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {log.action.includes('Created') ? <Plus className="h-3 w-3" /> :
                       log.action.includes('Updated') ? <Edit className="h-3 w-3" /> :
                       log.action.includes('Deleted') ? <Trash2 className="h-3 w-3" /> :
                       <Clock className="h-3 w-3" />}
                    </div>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {log.action}
                    </span>
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {log.itemName}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {log.user}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {log.timestamp}
                </td>
                <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {log.details}
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
          title="Total Items"
          value={analytics.totalItems?.toLocaleString()}
          icon={Package}
          trend={8.2}
        />
        <StatCard
          title="Low Stock Items"
          value={analytics.lowStockItems}
          icon={AlertTriangle}
          trend={-5.3}
        />
        <StatCard
          title="Out of Stock"
          value={analytics.outOfStockItems}
          icon={X}
          trend={-12.1}
        />
        <StatCard
          title="Total Revenue"
          value={`$${analytics.totalRevenue?.toLocaleString()}`}
          icon={DollarSign}
          trend={18.7}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-lg shadow p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Selling Items</h3>
          <div className="space-y-3">
            {analytics.topSellingItems?.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{item.name}</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.sales} sold</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Activity</h3>
          <div className="space-y-3">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center gap-3">
                <div className={`p-1 rounded-full ${
                  log.action.includes('Created') ? 'bg-green-100 text-green-600' :
                  log.action.includes('Updated') ? 'bg-blue-100 text-blue-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {log.action.includes('Created') ? <Plus className="h-3 w-3" /> :
                   log.action.includes('Updated') ? <Edit className="h-3 w-3" /> :
                   <Trash2 className="h-3 w-3" />}
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {log.action} - {log.itemName}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {log.timestamp}
                  </p>
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
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-green-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {notification.message}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
          <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Manage your inventory and track performance</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'items', name: 'Item Management', icon: Package },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp },
              { id: 'audit', name: 'Audit Trail', icon: FileText }
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
        <div>
          {activeTab === 'items' && <ItemManagementTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'audit' && <AuditLogTab />}
        </div>
      </div>

      {/* Modals */}
      {showItemModal && (
        <ItemModal
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          item={showDeleteConfirm}
          onConfirm={() => handleDeleteItem(showDeleteConfirm.id)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;