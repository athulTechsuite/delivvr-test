import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    priceRange: { min: '', max: '' },
    status: 'all'
  });

  // Fetch products with pagination and filters
  const fetchProducts = useCallback(async (page = 1, newFilters = filters) => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(newFilters.search && { search: newFilters.search }),
        ...(newFilters.category && { category: newFilters.category }),
        ...(newFilters.priceRange.min && { minPrice: newFilters.priceRange.min }),
        ...(newFilters.priceRange.max && { maxPrice: newFilters.priceRange.max }),
        ...(newFilters.status !== 'all' && { status: newFilters.status })
      });

      const response = await fetch(`${API_BASE_URL}/admin/products?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setProducts(data.products || []);
      setPagination(prev => ({
        ...prev,
        page: data.pagination?.page || page,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }));
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products');
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  // Create new product
  const createProduct = async (productData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      
      // Append all product fields
      Object.keys(productData).forEach(key => {
        if (key === 'images' && Array.isArray(productData[key])) {
          productData[key].forEach((file, index) => {
            formData.append(`images`, file);
          });
        } else if (productData[key] !== null && productData[key] !== undefined) {
          formData.append(key, productData[key]);
        }
      });

      const response = await fetch(`${API_BASE_URL}/admin/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create product');
      }

      const newProduct = await response.json();
      setProducts(prev => [newProduct, ...prev]);
      toast.success('Product created successfully');
      
      return newProduct;
    } catch (err) {
      console.error('Error creating product:', err);
      toast.error(err.message || 'Failed to create product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update existing product
  const updateProduct = async (productId, productData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      
      Object.keys(productData).forEach(key => {
        if (key === 'images' && Array.isArray(productData[key])) {
          productData[key].forEach((file) => {
            if (file instanceof File) {
              formData.append(`images`, file);
            }
          });
        } else if (productData[key] !== null && productData[key] !== undefined) {
          formData.append(key, productData[key]);
        }
      });

      const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update product');
      }

      const updatedProduct = await response.json();
      setProducts(prev => prev.map(product => 
        product.id === productId ? updatedProduct : product
      ));
      toast.success('Product updated successfully');
      
      return updatedProduct;
    } catch (err) {
      console.error('Error updating product:', err);
      toast.error(err.message || 'Failed to update product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete product
  const deleteProduct = async (productId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete product');
      }

      setProducts(prev => prev.filter(product => product.id !== productId));
      toast.success('Product deleted successfully');
      
      // Refresh the list if current page becomes empty
      if (products.length === 1 && pagination.page > 1) {
        fetchProducts(pagination.page - 1);
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error(err.message || 'Failed to delete product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Bulk delete products
  const bulkDeleteProducts = async (productIds) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/products/bulk-delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productIds })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete products');
      }

      setProducts(prev => prev.filter(product => !productIds.includes(product.id)));
      toast.success(`${productIds.length} products deleted successfully`);
      
      // Refresh the current page
      fetchProducts(pagination.page);
    } catch (err) {
      console.error('Error bulk deleting products:', err);
      toast.error(err.message || 'Failed to delete products');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update filters and fetch products
  const updateFilters = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchProducts(1, updatedFilters);
  };

  // Change page
  const changePage = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchProducts(newPage);
  };

  // Change page size
  const changePageSize = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    fetchProducts(1);
  };

  // Reset filters
  const resetFilters = () => {
    const defaultFilters = {
      search: '',
      category: '',
      priceRange: { min: '', max: '' },
      status: 'all'
    };
    setFilters(defaultFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchProducts(1, defaultFilters);
  };

  // Get single product
  const getProduct = async (productId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error fetching product:', err);
      toast.error('Failed to load product details');
      throw err;
    }
  };

  // Initial load
  useEffect(() => {
    fetchProducts();
  }, []); // Only run once on mount

  // Real-time updates via polling (can be replaced with WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if not currently loading
      if (!loading) {
        fetchProducts(pagination.page);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [pagination.page, loading]);

  return {
    // State
    products,
    loading,
    error,
    pagination,
    filters,
    
    // Actions
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    getProduct,
    updateFilters,
    resetFilters,
    changePage,
    changePageSize,
    
    // Computed values
    hasProducts: products.length > 0,
    hasNextPage: pagination.page < pagination.totalPages,
    hasPreviousPage: pagination.page > 1
  };
};

export default useProducts;