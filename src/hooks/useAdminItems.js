import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const useAdminItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: ''
  });

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('adminToken');
  }, []);

  // API request helper with auth
  const apiRequest = useCallback(async (url, options = {}) => {
    const token = getAuthToken();
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, [getAuthToken]);

  // Fetch items with pagination and filters
  const fetchItems = useCallback(async (page = 1, newFilters = filters) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.itemsPerPage.toString(),
        ...Object.entries(newFilters).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {})
      });

      const data = await apiRequest(`/admin/items?${queryParams}`);
      
      setItems(data.items);
      setPagination({
        ...pagination,
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalItems: data.totalItems
      });
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to fetch items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.itemsPerPage, apiRequest]);

  // Create new item
  const createItem = useCallback(async (itemData) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Append regular fields
      Object.keys(itemData).forEach(key => {
        if (key !== 'images' && itemData[key] !== null && itemData[key] !== undefined) {
          formData.append(key, itemData[key]);
        }
      });

      // Append images
      if (itemData.images && itemData.images.length > 0) {
        itemData.images.forEach((image, index) => {
          formData.append('images', image);
        });
      }

      const data = await apiRequest('/admin/items', {
        method: 'POST',
        body: formData,
        headers: {} // Remove Content-Type header for FormData
      });

      setItems(prev => [data.item, ...prev]);
      toast.success('Item created successfully');
      return data.item;
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to create item: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Update existing item
  const updateItem = useCallback(async (itemId, itemData) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Append regular fields
      Object.keys(itemData).forEach(key => {
        if (key !== 'images' && itemData[key] !== null && itemData[key] !== undefined) {
          formData.append(key, itemData[key]);
        }
      });

      // Append new images
      if (itemData.images && itemData.images.length > 0) {
        itemData.images.forEach((image, index) => {
          if (image instanceof File) {
            formData.append('images', image);
          }
        });
      }

      const data = await apiRequest(`/admin/items/${itemId}`, {
        method: 'PUT',
        body: formData,
        headers: {} // Remove Content-Type header for FormData
      });

      setItems(prev => prev.map(item => 
        item.id === itemId ? data.item : item
      ));
      
      toast.success('Item updated successfully');
      return data.item;
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to update item: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Delete item
  const deleteItem = useCallback(async (itemId) => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/admin/items/${itemId}`, {
        method: 'DELETE'
      });

      setItems(prev => prev.filter(item => item.id !== itemId));
      toast.success('Item deleted successfully');
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to delete item: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Get single item
  const getItem = useCallback(async (itemId) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest(`/admin/items/${itemId}`);
      return data.item;
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to fetch item: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Update filters and refresh items
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    fetchItems(1, newFilters);
  }, [fetchItems]);

  // Change page
  const changePage = useCallback((page) => {
    fetchItems(page);
  }, [fetchItems]);

  // Bulk operations
  const bulkDelete = useCallback(async (itemIds) => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest('/admin/items/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ itemIds })
      });

      setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
      toast.success(`${itemIds.length} items deleted successfully`);
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to delete items: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  const bulkUpdateStatus = useCallback(async (itemIds, status) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest('/admin/items/bulk-update-status', {
        method: 'PUT',
        body: JSON.stringify({ itemIds, status })
      });

      setItems(prev => prev.map(item => 
        itemIds.includes(item.id) ? { ...item, status } : item
      ));
      
      toast.success(`${itemIds.length} items updated successfully`);
      return data.items;
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to update items: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Export items
  const exportItems = useCallback(async (format = 'csv') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/items/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export items');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `items-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Items exported successfully');
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to export items: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  // Initial load
  useEffect(() => {
    fetchItems();
  }, []);

  return {
    // State
    items,
    loading,
    error,
    pagination,
    filters,

    // Actions
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    getItem,
    updateFilters,
    changePage,
    bulkDelete,
    bulkUpdateStatus,
    exportItems,

    // Utilities
    setError,
    setLoading
  };
};

export default useAdminItems;