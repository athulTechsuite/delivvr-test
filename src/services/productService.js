import api from './api';
import { handleApiError } from '../utils/errorHandler';
import { auditLogger } from './auditService';

class ProductService {
  constructor() {
    this.baseUrl = '/api/products';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all products with pagination, search, and filters
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.search - Search query
   * @param {string} params.category - Category filter
   * @param {string} params.sortBy - Sort field
   * @param {string} params.sortOrder - Sort order (asc/desc)
   * @returns {Promise<Object>} Products with pagination info
   */
  async getAllProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.search && { search: params.search }),
        ...(params.category && { category: params.category }),
        ...(params.sortBy && { sortBy: params.sortBy }),
        ...(params.sortOrder && { sortOrder: params.sortOrder })
      });

      const cacheKey = `products_${queryParams.toString()}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      const response = await api.get(`${this.baseUrl}?${queryParams}`);
      
      // Cache the response
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to fetch products');
    }
  }

  /**
   * Get a single product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Product data
   */
  async getProductById(productId) {
    try {
      const cacheKey = `product_${productId}`;
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      const response = await api.get(`${this.baseUrl}/${productId}`);
      
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to fetch product');
    }
  }

  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @param {File[]} images - Product images
   * @returns {Promise<Object>} Created product
   */
  async createProduct(productData, images = []) {
    try {
      // Validate required fields
      this.validateProductData(productData);

      const formData = new FormData();
      
      // Add product data
      Object.keys(productData).forEach(key => {
        if (productData[key] !== null && productData[key] !== undefined) {
          formData.append(key, productData[key]);
        }
      });

      // Add images
      images.forEach((image, index) => {
        formData.append(`images`, image);
      });

      const response = await api.post(this.baseUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear cache
      this.clearCache();

      // Log audit trail
      await auditLogger.log({
        action: 'CREATE_PRODUCT',
        resourceType: 'PRODUCT',
        resourceId: response.data.id,
        details: {
          productName: productData.name,
          category: productData.category,
          price: productData.price
        }
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to create product');
    }
  }

  /**
   * Update an existing product
   * @param {string} productId - Product ID
   * @param {Object} productData - Updated product data
   * @param {File[]} newImages - New images to add
   * @param {string[]} imagesToDelete - Image IDs to delete
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(productId, productData, newImages = [], imagesToDelete = []) {
    try {
      this.validateProductData(productData, false);

      const formData = new FormData();
      
      // Add product data
      Object.keys(productData).forEach(key => {
        if (productData[key] !== null && productData[key] !== undefined) {
          formData.append(key, productData[key]);
        }
      });

      // Add new images
      newImages.forEach((image) => {
        formData.append('images', image);
      });

      // Add images to delete
      if (imagesToDelete.length > 0) {
        formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
      }

      const response = await api.put(`${this.baseUrl}/${productId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear cache
      this.clearCache();

      // Log audit trail
      await auditLogger.log({
        action: 'UPDATE_PRODUCT',
        resourceType: 'PRODUCT',
        resourceId: productId,
        details: {
          updatedFields: Object.keys(productData),
          newImagesCount: newImages.length,
          deletedImagesCount: imagesToDelete.length
        }
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to update product');
    }
  }

  /**
   * Delete a product
   * @param {string} productId - Product ID
   * @returns {Promise<void>}
   */
  async deleteProduct(productId) {
    try {
      // Get product details for audit log
      const product = await this.getProductById(productId);
      
      await api.delete(`${this.baseUrl}/${productId}`);

      // Clear cache
      this.clearCache();

      // Log audit trail
      await auditLogger.log({
        action: 'DELETE_PRODUCT',
        resourceType: 'PRODUCT',
        resourceId: productId,
        details: {
          productName: product.name,
          category: product.category,
          price: product.price
        }
      });
    } catch (error) {
      throw handleApiError(error, 'Failed to delete product');
    }
  }

  /**
   * Bulk delete products
   * @param {string[]} productIds - Array of product IDs
   * @returns {Promise<Object>} Deletion results
   */
  async bulkDeleteProducts(productIds) {
    try {
      const response = await api.delete(`${this.baseUrl}/bulk`, {
        data: { productIds }
      });

      // Clear cache
      this.clearCache();

      // Log audit trail
      await auditLogger.log({
        action: 'BULK_DELETE_PRODUCTS',
        resourceType: 'PRODUCT',
        details: {
          productIds,
          count: productIds.length,
          results: response.data
        }
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to bulk delete products');
    }
  }

  /**
   * Bulk update products
   * @param {Object[]} updates - Array of product updates
   * @returns {Promise<Object>} Update results
   */
  async bulkUpdateProducts(updates) {
    try {
      const response = await api.put(`${this.baseUrl}/bulk`, { updates });

      // Clear cache
      this.clearCache();

      // Log audit trail
      await auditLogger.log({
        action: 'BULK_UPDATE_PRODUCTS',
        resourceType: 'PRODUCT',
        details: {
          count: updates.length,
          productIds: updates.map(u => u.id),
          results: response.data
        }
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to bulk update products');
    }
  }

  /**
   * Get product categories
   * @returns {Promise<string[]>} List of categories
   */
  async getCategories() {
    try {
      const cacheKey = 'categories';
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      const response = await api.get(`${this.baseUrl}/categories`);
      
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to fetch categories');
    }
  }

  /**
   * Upload product image
   * @param {string} productId - Product ID
   * @param {File} image - Image file
   * @returns {Promise<Object>} Upload result
   */
  async uploadProductImage(productId, image) {
    try {
      const formData = new FormData();
      formData.append('image', image);

      const response = await api.post(`${this.baseUrl}/${productId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear cache for this product
      this.cache.delete(`product_${productId}`);

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to upload image');
    }
  }

  /**
   * Delete product image
   * @param {string} productId - Product ID
   * @param {string} imageId - Image ID
   * @returns {Promise<void>}
   */
  async deleteProductImage(productId, imageId) {
    try {
      await api.delete(`${this.baseUrl}/${productId}/images/${imageId}`);

      // Clear cache for this product
      this.cache.delete(`product_${productId}`);
    } catch (error) {
      throw handleApiError(error, 'Failed to delete image');
    }
  }

  /**
   * Get product statistics
   * @returns {Promise<Object>} Product statistics
   */
  async getProductStats() {
    try {
      const response = await api.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to fetch product statistics');
    }
  }

  /**
   * Validate product data
   * @param {Object} productData - Product data to validate
   * @param {boolean} isCreate - Whether this is for creation (all fields required)
   */
  validateProductData(productData, isCreate = true) {
    const requiredFields = ['name', 'description', 'price', 'category'];
    const errors = [];

    if (isCreate) {
      requiredFields.forEach(field => {
        if (!productData[field] || productData[field].toString().trim() === '') {
          errors.push(`${field} is required`);
        }
      });
    }

    // Validate price
    if (productData.price !== undefined && (isNaN(productData.price) || productData.price < 0)) {
      errors.push('Price must be a valid positive number');
    }

    // Validate name length
    if (productData.name && productData.name.length > 255) {
      errors.push('Name must be less than 255 characters');
    }

    // Validate description length
    if (productData.description && productData.description.length > 2000) {
      errors.push('Description must be less than 2000 characters');
    }

    // Validate stock quantity
    if (productData.stockQuantity !== undefined && (isNaN(productData.stockQuantity) || productData.stockQuantity < 0)) {
      errors.push('Stock quantity must be a valid non-negative number');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Subscribe to real-time product updates
   * @param {Function} callback - Callback function for updates
   * @returns {Function} Unsubscribe function
   */
  subscribeToUpdates(callback) {
    if (typeof window !== 'undefined' && window.WebSocket) {
      const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/products`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Clear relevant cache entries
        if (data.type === 'PRODUCT_UPDATED' || data.type === 'PRODUCT_DELETED') {
          this.cache.delete(`product_${data.productId}`);
        }
        
        if (data.type === 'PRODUCT_CREATED' || data.type === 'PRODUCT_DELETED') {
          // Clear list cache
          for (const key of this.cache.keys()) {
            if (key.startsWith('products_')) {
              this.cache.delete(key);
            }
          }
        }

        callback(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      // Return unsubscribe function
      return () => {
        ws.close();
      };
    }

    // Fallback to polling if WebSocket is not available
    const interval = setInterval(async () => {
      try {
        const lastUpdate = localStorage.getItem('lastProductUpdate');
        const response = await api.get(`${this.baseUrl}/updates?since=${lastUpdate || 0}`);
        
        if (response.data.updates.length > 0) {
          localStorage.setItem('lastProductUpdate', Date.now().toString());
          this.clearCache();
          callback({
            type: 'PRODUCTS_UPDATED',
            updates: response.data.updates
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }
}

export default new ProductService();