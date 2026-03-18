import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  Upload, 
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  MoreVertical,
  Package,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import LoadingSpinner from '../UI/LoadingSpinner';
import Modal from '../UI/Modal';
import ConfirmDialog from '../UI/ConfirmDialog';

const AdminItemManagement = () => {
  const { user, isAdmin } = useAuth();
  const { showNotification } = useNotification();
  
  // State management
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    price: '',
    status: 'active',
    images: [],
    files: []
  });

  // Categories and status options
  const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Other'];
  const statusOptions = [
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'gray' },
    { value: 'out_of_stock', label: 'Out of Stock', color: 'red' },
    { value: 'discontinued', label: 'Discontinued', color: 'orange' }
  ];

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      showNotification('Access denied. Admin privileges required.', 'error');
      return;
    }
  }, [isAdmin]);

  // Load items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load items');
      
      const data = await response.json();
      setItems(data.items || []);
      setFilteredItems(data.items || []);
    } catch (error) {
      console.error('Error loading items:', error);
      showNotification('Failed to load items', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Load audit trail
  const loadAuditTrail = async (itemId) => {
    try {
      const response = await fetch(`/api/admin/items/${itemId}/audit`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load audit trail');
      
      const data = await response.json();
      setAuditTrail(data.audit || []);
      setShowAuditModal(true);
    } catch (error) {
      console.error('Error loading audit trail:', error);
      showNotification('Failed to load audit trail', 'error');
    }
  };

  // Filter and search items
  useEffect(() => {
    let filtered = [...items];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredItems(filtered);
  }, [items, searchQuery, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isAdmin) {
      loadItems();
    }
  }, [isAdmin, loadItems]);

  // Handle form submission for create/edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'images' || key === 'files') {
          formData[key].forEach(file => {
            formDataToSend.append(key, file);
          });
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      const url = editingItem 
        ? `/api/admin/items/${editingItem.id}`
        : '/api/admin/items';
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      if (!response.ok) throw new Error(`Failed to ${editingItem ? 'update' : 'create'} item`);

      const data = await response.json();
      
      showNotification(
        `Item ${editingItem ? 'updated' : 'created'} successfully`,
        'success'
      );
      
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
      loadItems();
    } catch (error) {
      console.error('Error saving item:', error);
      showNotification(`Failed to ${editingItem ? 'update' : 'create'} item`, 'error');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      const response = await fetch(`/api/admin/items/${deletingItem.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete item');

      showNotification('Item deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setDeletingItem(null);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification('Failed to delete item', 'error');
    }
  };

  // Handle bulk operations
  const handleBulkAction = async (action) => {
    if (selectedItems.size === 0) return;

    try {
      const itemIds = Array.from(selectedItems);
      const response = await fetch('/api/admin/items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          action,
          itemIds
        })
      });

      if (!response.ok) throw new Error(`Failed to ${action} items`);

      showNotification(`Bulk ${action} completed successfully`, 'success');
      setSelectedItems(new Set());
      setShowBulkActions(false);
      loadItems();
    } catch (error) {
      console.error(`Error with bulk ${action}:`, error);
      showNotification(`Failed to ${action} items`, 'error');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      quantity: 0,
      price: '',
      status: 'active',
      images: [],
      files: []
    });
  };

  // Handle edit
  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      status: item.status,
      images: [],
      files: []
    });
    setShowEditModal(true);
  };

  // Handle file uploads
  const handleFileChange = (e, type) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], ...files]
    }));
  };

  // Toggle item selection
  const toggleItemSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Select all items
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Admin privileges required to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Item Management</h1>
              <p className="mt-2 text-gray-600">
                Manage your inventory with full CRUD operations
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </button>
              {selectedItems.size > 0 && (
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  Bulk Actions ({selectedItems.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Items
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {items.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Items
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {items.filter(item => item.status === 'active').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Out of Stock
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {items.filter(item => item.status === 'out_of_stock').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Quantity
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {items.reduce((sum, item) => sum + item.quantity, 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="quantity-asc">Quantity (Low-High)</option>
                <option value="quantity-desc">Quantity (High-Low)</option>
                <option value="price-asc">Price (Low-High)</option>
                <option value="price-desc">Price (High-Low)</option>
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {showBulkActions && selectedItems.size > 0 && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {selectedItems.size} items selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full hover:bg-green-200"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {item.images && item.images.length > 0 ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={item.images[0]}
                              alt={item.name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {item.name}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(item.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : item.status === 'out_of_stock'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {statusOptions.find(s => s.value === item.status)?.label || item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingItem(item);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => loadAuditTrail(item.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first item.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCreateModal || showEditModal}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setEditingItem(null);
            resetForm();
          }}
          title={editingItem ? 'Edit Item' : 'Create New Item'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select Category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {statusOptions.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Images
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'images')}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Files
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileChange(e, 'files')}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingItem(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Save className="w-4 h-4 mr-2 inline" />
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Item"
          message={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
          type="danger"
        />

        {/* Audit Trail Modal */}
        <Modal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          title="Audit Trail"
          size="lg"
        >
          <div className="space-y-4">
            {auditTrail.length > 0 ? (
              auditTrail.map((entry, index) => (
                <div key={index} className="border-l-4 border-indigo-400 bg-indigo-50 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-indigo-800">
                        {entry.action}
                      </p>
                      <p className="text-sm text-indigo-600">
                        by {entry.user?.name || 'Unknown User'}
                      </p>
                    </div>
                    <time className="text-xs text-indigo-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </time>
                  </div>
                  {entry.changes && (
                    <div className="mt-2 text-xs text-gray-600">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">
                No audit trail available for this item.
              </p>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminItemManagement;