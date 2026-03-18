import { useState, useEffect, useCallback } from 'react';
import { itemsAPI } from '../services/api';
import { useNotification } from './useNotification';

export const useItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    availability: 'all'
  });
  
  const { showNotification } = useNotification();

  // Fetch items with pagination, search, and filters
  const fetchItems = useCallback(async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit,
        search: searchTerm,
        ...filters
      };

      const response = await itemsAPI.getItems(params);
      
      setItems(response.data.items);
      setTotalItems(response.data.total);
      setCurrentPage(page);
    } catch (err) {
      setError(err.message || 'Failed to fetch items');
      showNotification('Error fetching items', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filters, showNotification]);

  // Create new item
  const createItem = async (itemData) => {
    try {
      setLoading(true);
      const response = await itemsAPI.createItem(itemData);
      
      // Refresh the items list
      await fetchItems(currentPage);
      
      showNotification('Item created successfully', 'success');
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create item';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update existing item
  const updateItem = async (itemId, itemData) => {
    try {
      setLoading(true);
      const response = await itemsAPI.updateItem(itemId, itemData);
      
      // Update the item in the local state
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId ? { ...item, ...response.data } : item
        )
      );
      
      showNotification('Item updated successfully', 'success');
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update item';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const deleteItem = async (itemId) => {
    try {
      setLoading(true);
      await itemsAPI.deleteItem(itemId);
      
      // Remove the item from local state
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
      setTotalItems(prev => prev - 1);
      
      showNotification('Item deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete item';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Upload item image
  const uploadItemImage = async (file) => {
    // Validate file size (200KB limit)
    const maxSizeInBytes = 200 * 1024; // 200KB
    if (file.size > maxSizeInBytes) {
      const errorMessage = 'Image file size must be less than 200KB';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await itemsAPI.uploadImage(formData);
      return response.data.imageUrl;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to upload image';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get single item by ID
  const getItemById = async (itemId) => {
    try {
      setLoading(true);
      const response = await itemsAPI.getItemById(itemId);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch item';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update item count
  const updateItemCount = async (itemId, newCount) => {
    try {
      const response = await itemsAPI.updateItemCount(itemId, { count: newCount });
      
      // Update the item count in local state
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId ? { ...item, availableCount: newCount } : item
        )
      );
      
      showNotification('Item count updated successfully', 'success');
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update item count';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      throw err;
    }
  };

  // Search items
  const searchItems = useCallback((term) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  // Apply filters
  const applyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Reset filters and search
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setFilters({
      category: '',
      availability: 'all'
    });
    setCurrentPage(1);
  }, []);

  // Load initial data
  useEffect(() => {
    fetchItems(1);
  }, [fetchItems]);

  // Pagination helpers
  const totalPages = Math.ceil(totalItems / 10);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const goToNextPage = () => {
    if (hasNextPage) {
      fetchItems(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (hasPrevPage) {
      fetchItems(currentPage - 1);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchItems(page);
    }
  };

  return {
    // State
    items,
    loading,
    error,
    totalItems,
    currentPage,
    totalPages,
    searchTerm,
    filters,

    // CRUD operations
    createItem,
    updateItem,
    deleteItem,
    getItemById,
    uploadItemImage,
    updateItemCount,

    // Search and filtering
    searchItems,
    applyFilters,
    resetFilters,

    // Pagination
    hasNextPage,
    hasPrevPage,
    goToNextPage,
    goToPrevPage,
    goToPage,

    // Utilities
    fetchItems,
    refreshItems: () => fetchItems(currentPage),
    clearError: () => setError(null)
  };
};

export default useItems;