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
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'view'
  const [currentItem, setCurrentItem] = useState(null);
  const [bulkActionMenu, setBulkActionMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for item modal
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    sku: '',
    status: 'active',
    images: []
  });

  const categories = ['Electronics', 'Sports', 'Appliances', 'Clothing', 'Books', 'Home & Garden'];

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
            status: 'active',
            sku: 'WH-001',
            images: ['headphones1.jpg'],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-30'
          },
          { 
            id: 2, 
            name: 'Running Shoes', 
            description: 'Professional running shoes for athletes',
            price: 129.99, 
            stock: 30, 
            category: 'Sports', 
            status: 'active',
            sku: 'RS-002',
            images: ['shoes1.jpg'],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-25'
          },
          { 
            id: 3, 
            name: 'Coffee Maker', 
            description: 'Automatic coffee maker with programmable settings',
            price: 79.99, 
            stock: 0, 
            category: 'Appliances', 
            status: 'out_of_stock',
            sku: 'CM-003',
            images: ['coffee1.jpg'],
            createdAt: '2024-01-10',
            updatedAt: '2024-01-28'
          },
          { 
            id: 4, 
            name: 'Smartphone Case', 
            description: 'Protective case for smartphones',
            price: 24.99, 
            stock: 100, 
            category: 'Electronics', 
            status: 'active',
            sku: 'SC-004',
            images: ['case1.jpg'],
            createdAt: '2024-01-12',
            updatedAt: '2024-01-22'
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
        setError('Failed to load admin data');
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  // Real-time updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      setProducts(prevProducts => 
        prevProducts.map(product => ({
          ...product,
          updatedAt: new Date().toISOString().split('T')[0]
        }))
      );
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
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

  const showMessage = (type, message) => {
    if (type === 'success') {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(message);
      setTimeout(() => setError(''), 3000);
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

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'add') {
        const newItem = {
          ...itemForm,
          id: products.length + 1,
          price: parseFloat(itemForm.price),
          stock: parseInt(itemForm.stock),
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0]
        };
        setProducts(prev => [...prev, newItem]);
        logAuditAction('Created', itemForm.name);
        showMessage('success', 'Item created successfully');
      } else if (modalMode === 'edit') {
        setProducts(prev => prev.map(item => 
          item.id === currentItem.id 
            ? { 
                ...item, 
                ...itemForm, 
                price: parseFloat(itemForm.price),
                stock: parseInt(itemForm.stock),
                updatedAt: new Date().toISOString().split('T')[0]
              }
            : item
        ));
        logAuditAction('Updated', itemForm.name);
        showMessage('success', 'Item updated successfully');
      }
      setShowItemModal(false);
      resetItemForm();
    } catch (error) {
      showMessage('error', 'Failed to save item');
    }
  };

  const handleDeleteItem = async () => {
    try {
      setProducts(prev => prev.filter(item => item.id !== itemToDelete.id));
      logAuditAction('Deleted', itemToDelete.name);
      showMessage('success', 'Item deleted successfully');
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error) {
      showMessage('error', 'Failed to delete item');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const itemsToDelete = products.filter(item => selectedItems.has(item.id));
      setProducts(prev => prev.filter(item => !selectedItems.has(item.id)));
      
      itemsToDelete.forEach(item => {
        logAuditAction('Bulk Deleted', item.name);
      });
      
      showMessage('success', `${selectedItems.size} items deleted successfully`);
      setSelectedItems(new Set());
      setBulkActionMenu(false);
    } catch (error) {
      showMessage('error', 'Failed to delete items');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    try {
      setProducts(prev => prev.map(item => 
        selectedItems.has(item.id) 
          ? { ...item, status, updatedAt: new Date().toISOString().split('T')[0] }
          : item
      ));
      
      showMessage('success', `${selectedItems.size} items updated successfully`);
      setSelectedItems(new Set());
      setBulkActionMenu(false);
    } catch (error) {
      showMessage('error', 'Failed to update items');
    }
  };

  const openItemModal = (mode, item = null) => {
    setModalMode(mode);
    setCurrentItem(item);
    if (item) {
      setItemForm({
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price.toString(),
        stock: item.stock.toString(),
        sku: item.sku,
        status: item.status,
        images: item.images || []
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
      status: 'active',
      images: []
    });
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
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Item Management</h2>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <div className="relative">
              <button 
                onClick={() => setBulkActionMenu(!bulkActionMenu)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
                Bulk Actions ({selectedItems.size})
              </button>
              {bulkActionMenu && (
                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-10 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
                  <div className="py-1">
                    <button 
                      onClick={() => handleBulkStatusUpdate('active')}
                      className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Mark as Active
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate('inactive')}
                      className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Mark as Inactive
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="block px-4 py-2 text-sm w-full text-left hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search items..."
            value={itemSearchTerm}
            onChange={(e) => setItemSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <select
          value={itemFilters.category}
          onChange={(e) => setItemFilters(prev => ({ ...prev, category: e.target.value }))}
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
          value={itemFilters.status}
          onChange={(e) => setItemFilters(prev => ({ ...prev, status: e.target.value }))}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            isDark 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min Price"
            value={itemFilters.priceRange.min}
            onChange={(e) => setItemFilters(prev => ({ 
              ...prev, 
              priceRange: { ...prev.priceRange, min: e.target.value } 
            }))}
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
          <input
            type="number"
            placeholder="Max Price"
            value={itemFilters.priceRange.max}
            onChange={(e) => setItemFilters(prev => ({ 
              ...prev, 
              priceRange: { ...prev.priceRange, max: e.target.value } 
            }))}
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      </div>

      {/* Items Table */}
      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-6 py-3">
                <button
                  onClick={toggleAllItemsSelection}
                  className={`${isDark ? 'text-gray-300' : 'text-gray-500'} hover:${isDark ? 'text-white' : 'text-gray-700'}`}
                >
                  {selectedItems.size === paginatedItems.length && paginatedItems.length > 0 ? 
                    <CheckSquare className="h-4 w-4" /> : 
                    <Square className="h-4 w-4" />
                  }
                </button>
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Item</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>SKU</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Category</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Price</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Stock</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Last Updated</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {paginatedItems.map((item) => (
              <tr key={item.id} className={selectedItems.has(item.id) ? (isDark ? 'bg-gray-700' : 'bg-blue-50') : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleItemSelection(item.id)}
                    className={`${isDark ? 'text-gray-300' : 'text-gray-500'} hover:${isDark ? 'text-white' : 'text-gray-700'}`}
                  >
                    {selectedItems.has(item.id) ? 
                      <CheckSquare className="h-4 w-4" /> : 
                      <Square className="h-4 w-4" />
                    }
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 flex-shrink-0 rounded-lg ${isDark ? 'bg-gray-600' : 'bg-gray-200'} flex items-center justify-center`}>
                      <ImageIcon className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                    <div className="ml-4">
                      <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                      <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'} truncate max-w-xs`}>{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {item.sku}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {item.category}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ${item.price.toFixed(2)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className={item.stock === 0 ? 'text-red-500 font-medium' : ''}>{item.stock}</span>
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
                  {item.updatedAt}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => openItemModal('view', item)}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => openItemModal('edit', item)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setItemToDelete(item);
                        setShowDeleteConfirm(true);
                      }}
                      className="text-red-600 hover:text-red-900 transition-colors"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 border rounded-lg transition-colors ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  currentPage === i + 1
                    ? 'bg-blue-600 text-white border-blue-600'
                    : `hover:bg-gray-50 dark:hover:bg-gray-700 ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 border rounded-lg transition-colors ${
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

      {/* Audit Log */}
      <div className={`rounded-lg shadow p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Audit Trail</h3>
        <div className="space-y-2">
          {auditLog.slice(0, 10).map((log) => (
            <div key={log.id} className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  log.action === 'Created' ? 'bg-green-100 text-green-800' :
                  log.action === 'Updated' ? 'bg-blue-100 text-blue-800' :
                  log.action === 'Deleted' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {log.action}
                </span>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{log.item}</span>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>by {log.user}</span>
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Item Modal Component
  const ItemModal = () => (
    showItemModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto`}>
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {modalMode === 'add' ? 'Add New Item' : 
               modalMode === 'edit' ? 'Edit Item' : 'View Item'}
            </h3>
            <button
              onClick={() => setShowItemModal(false)}
              className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleItemSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Name *
                </label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={modalMode === 'view'}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${modalMode === 'view' ? 'opacity-60' : ''}`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  SKU *
                </label>
                <input
                  type="text"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm(prev => ({ ...prev, sku: e.target.value }))}
                  disabled={modalMode === 'view'}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${modalMode === 'view' ? 'opacity-60' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description
              </label>
              <textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                disabled={modalMode === 'view'}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${modalMode === 'view' ? 'opacity-60' : ''}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Category *
                </label>
                <select
                  value={itemForm.category}
                  onChange={(e) => setItemForm(prev => ({ ...prev, category: e.target.value }))}
                  disabled={modalMode === 'view'}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${modalMode === 'view' ? 'opacity-60' : ''}`}
                >
                  <option value="">Select Category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
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
                  disabled={modalMode === 'view'}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${modalMode === 'view' ? 'opacity-60' : ''}`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Stock *
                </label>
                <input
                  type="number"
                  value={itemForm.stock}
                  onChange={(e) => setItemForm(prev => ({ ...prev, stock: e.target.value }))}
                  disabled={modalMode === 'view'}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } ${modalMode === 'view' ? 'opacity-60' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={itemForm.status}
                onChange={(e) => setItemForm(prev => ({ ...prev, status: e.target.value }))}
                disabled={modalMode === 'view'}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } ${modalMode === 'view' ? 'opacity-60' : ''}`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            {modalMode !== 'view' && (
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {modalMode === 'add' ? 'Create Item' : 'Update Item'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    )
  );

  // Delete Confirmation Modal
  const DeleteConfirmModal = () => (
    showDeleteConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-md w-full mx-4`}>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Delete Item
              </h3>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  isDark 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
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
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'products', name: 'Items', icon: Package },
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
            {activeTab === 'overview' && <AnalyticsTab />}
            {activeTab === 'users' && <UserManagementTab />}
            {activeTab === 'products' && <ProductManagementTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ItemModal />
      <DeleteConfirmModal />
    </div>
  );
};

export default AdminDashboard;