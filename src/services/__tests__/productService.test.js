import ProductService from '../productService';
import api from '../api';
import { auditLogger } from '../auditService';
import { handleApiError } from '../../utils/errorHandler';

// Mock dependencies
jest.mock('../api');
jest.mock('../auditService');
jest.mock('../../utils/errorHandler');

const mockApi = api;
const mockAuditLogger = auditLogger;
const mockHandleApiError = handleApiError;

describe('ProductService', () => {
  let productService;
  
  beforeEach(() => {
    productService = new ProductService();
    jest.clearAllMocks();
    
    // Clear cache
    productService.cache.clear();
  });

  // TC-001: Get all products with pagination
  describe('TC-001: Get All Products', () => {
    const mockProductsResponse = {
      data: {
        products: [
          {
            id: 1,
            name: 'Test Product 1',
            description: 'Test description',
            category: 'Electronics',
            price: 99.99,
            stock: 50
          },
          {
            id: 2,
            name: 'Test Product 2',
            description: 'Another description',
            category: 'Sports',
            price: 149.99,
            stock: 25
          }
        ],
        pagination: {
          page: 1,
          totalPages: 5,
          total: 50,
          limit: 10
        }
      }
    };

    it('should fetch all products with default parameters', async () => {
      mockApi.get.mockResolvedValue(mockProductsResponse);

      const result = await productService.getAllProducts();

      expect(mockApi.get).toHaveBeenCalledWith('/api/products?page=1&limit=20');
      expect(result).toEqual(mockProductsResponse.data);
    });

    it('should fetch products with custom pagination parameters', async () => {
      mockApi.get.mockResolvedValue(mockProductsResponse);

      const params = { page: 2, limit: 15 };
      await productService.getAllProducts(params);

      expect(mockApi.get).toHaveBeenCalledWith('/api/products?page=2&limit=15');
    });

    it('should fetch products with search and filter parameters', async () => {
      mockApi.get.mockResolvedValue(mockProductsResponse);

      const params = {
        page: 1,
        limit: 10,
        search: 'smartphone',
        category: 'Electronics',
        sortBy: 'name',
        sortOrder: 'asc'
      };
      
      await productService.getAllProducts(params);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/products?page=1&limit=10&search=smartphone&category=Electronics&sortBy=name&sortOrder=asc'
      );
    });

    it('should use cached results when available', async () => {
      mockApi.get.mockResolvedValue(mockProductsResponse);

      // First call should hit API
      const result1 = await productService.getAllProducts({ page: 1 });
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await productService.getAllProducts({ page: 1 });
      expect(mockApi.get).toHaveBeenCalledTimes(1); // Still 1 call
      expect(result1).toEqual(result2);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      mockApi.get.mockRejectedValue(error);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Failed to fetch products');
      });

      await expect(productService.getAllProducts()).rejects.toThrow('Failed to fetch products');
      expect(mockHandleApiError).toHaveBeenCalledWith(error, 'Failed to fetch products');
    });
  });

  // TC-002: Create new product
  describe('TC-002: Create Product', () => {
    const newProductData = {
      name: 'New Test Product',
      description: 'New product description',
      category: 'Electronics',
      price: 299.99,
      stock: 100,
      sku: 'NTP001'
    };

    const mockCreateResponse = {
      data: {
        success: true,
        product: { id: 3, ...newProductData }
      }
    };

    it('should create a new product successfully', async () => {
      mockApi.post.mockResolvedValue(mockCreateResponse);

      const result = await productService.createProduct(newProductData);

      expect(mockApi.post).toHaveBeenCalledWith('/api/products', newProductData);
      expect(result).toEqual(mockCreateResponse.data);
      
      // Verify cache is cleared
      expect(productService.cache.size).toBe(0);
    });

    it('should log audit trail for product creation', async () => {
      mockApi.post.mockResolvedValue(mockCreateResponse);
      
      await productService.createProduct(newProductData);

      expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
        'CREATE',
        undefined, // productId not available yet
        expect.any(String), // userId
        expect.any(String), // userEmail
        expect.objectContaining({
          action: 'Product created',
          productData: newProductData
        }),
        null, // oldValues
        newProductData // newValues
      );
    });

    it('should handle validation errors during creation', async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            errors: [
              { field: 'name', message: 'Name is required' },
              { field: 'price', message: 'Price must be positive' }
            ]
          }
        }
      };
      
      mockApi.post.mockRejectedValue(validationError);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(productService.createProduct({})).rejects.toThrow('Validation failed');
    });
  });

  // TC-003: Update existing product
  describe('TC-003: Update Product', () => {
    const productId = '1';
    const updateData = {
      name: 'Updated Product Name',
      price: 199.99
    };

    const oldProductData = {
      id: 1,
      name: 'Original Product Name',
      price: 99.99,
      description: 'Original description'
    };

    const mockUpdateResponse = {
      data: {
        success: true,
        product: { ...oldProductData, ...updateData }
      }
    };

    it('should update product successfully', async () => {
      mockApi.put.mockResolvedValue(mockUpdateResponse);

      const result = await productService.updateProduct(productId, updateData, oldProductData);

      expect(mockApi.put).toHaveBeenCalledWith(`/api/products/${productId}`, updateData);
      expect(result).toEqual(mockUpdateResponse.data);
      
      // Verify cache is cleared
      expect(productService.cache.size).toBe(0);
    });

    it('should log audit trail for product update', async () => {
      mockApi.put.mockResolvedValue(mockUpdateResponse);
      
      await productService.updateProduct(productId, updateData, oldProductData);

      expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
        'UPDATE',
        productId,
        expect.any(String), // userId
        expect.any(String), // userEmail
        expect.objectContaining({
          action: 'Product updated',
          changedFields: expect.arrayContaining(['name', 'price'])
        }),
        oldProductData,
        { ...oldProductData, ...updateData }
      );
    });

    it('should handle update conflicts', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: { message: 'Product was modified by another user' }
        }
      };
      
      mockApi.put.mockRejectedValue(conflictError);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Conflict: Product was modified by another user');
      });

      await expect(
        productService.updateProduct(productId, updateData, oldProductData)
      ).rejects.toThrow('Conflict: Product was modified by another user');
    });
  });

  // TC-004: Delete product with confirmation
  describe('TC-004: Delete Product', () => {
    const productId = '1';
    const productData = {
      id: 1,
      name: 'Product to Delete',
      description: 'Test product for deletion'
    };

    const mockDeleteResponse = {
      data: { success: true, message: 'Product deleted successfully' }
    };

    it('should delete product successfully', async () => {
      mockApi.delete.mockResolvedValue(mockDeleteResponse);

      const result = await productService.deleteProduct(productId, productData);

      expect(mockApi.delete).toHaveBeenCalledWith(`/api/products/${productId}`);
      expect(result).toEqual(mockDeleteResponse.data);
      
      // Verify cache is cleared
      expect(productService.cache.size).toBe(0);
    });

    it('should log audit trail for product deletion', async () => {
      mockApi.delete.mockResolvedValue(mockDeleteResponse);
      
      await productService.deleteProduct(productId, productData);

      expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
        'DELETE',
        productId,
        expect.any(String), // userId
        expect.any(String), // userEmail
        expect.objectContaining({
          action: 'Product deleted',
          productName: productData.name
        }),
        productData,
        null
      );
    });

    it('should handle delete errors gracefully', async () => {
      const deleteError = {
        response: {
          status: 404,
          data: { message: 'Product not found' }
        }
      };
      
      mockApi.delete.mockRejectedValue(deleteError);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Product not found');
      });

      await expect(productService.deleteProduct(productId, productData))
        .rejects.toThrow('Product not found');
    });
  });

  // TC-006: Bulk operations
  describe('TC-006: Bulk Operations', () => {
    const productIds = ['1', '2', '3'];
    const mockBulkDeleteResponse = {
      data: {
        success: true,
        deletedCount: 3,
        message: '3 products deleted successfully'
      }
    };

    it('should perform bulk delete operation', async () => {
      mockApi.delete.mockResolvedValue(mockBulkDeleteResponse);

      const result = await productService.bulkDeleteProducts(productIds);

      expect(mockApi.delete).toHaveBeenCalledWith('/api/products/bulk', {
        data: { productIds }
      });
      expect(result).toEqual(mockBulkDeleteResponse.data);
      
      // Verify cache is cleared
      expect(productService.cache.size).toBe(0);
    });

    it('should log audit trail for bulk operations', async () => {
      mockApi.delete.mockResolvedValue(mockBulkDeleteResponse);
      
      await productService.bulkDeleteProducts(productIds);

      expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
        'BULK_DELETE',
        productIds.join(','),
        expect.any(String), // userId
        expect.any(String), // userEmail
        expect.objectContaining({
          action: 'Bulk delete products',
          productIds: productIds,
          deletedCount: 3
        })
      );
    });

    it('should handle partial bulk operation failures', async () => {
      const partialFailureResponse = {
        data: {
          success: false,
          deletedCount: 1,
          failedIds: ['2', '3'],
          message: 'Some products could not be deleted'
        }
      };
      
      mockApi.delete.mockResolvedValue(partialFailureResponse);

      const result = await productService.bulkDeleteProducts(productIds);

      expect(result.success).toBe(false);
      expect(result.failedIds).toEqual(['2', '3']);
      expect(result.deletedCount).toBe(1);
    });
  });

  // TC-005: Search and filter
  describe('TC-005: Search and Filter', () => {
    it('should build correct query parameters for complex filters', async () => {
      const mockResponse = { data: { products: [], pagination: {} } };
      mockApi.get.mockResolvedValue(mockResponse);

      const complexParams = {
        search: 'smartphone',
        category: 'Electronics',
        minPrice: 100,
        maxPrice: 500,
        sortBy: 'price',
        sortOrder: 'desc',
        page: 2,
        limit: 25
      };

      await productService.getAllProducts(complexParams);

      const expectedUrl = '/api/products?page=2&limit=25&search=smartphone&category=Electronics&minPrice=100&maxPrice=500&sortBy=price&sortOrder=desc';
      expect(mockApi.get).toHaveBeenCalledWith(expectedUrl);
    });

    it('should handle empty search results', async () => {
      const emptyResponse = {
        data: {
          products: [],
          pagination: { page: 1, totalPages: 0, total: 0, limit: 20 }
        }
      };
      
      mockApi.get.mockResolvedValue(emptyResponse);

      const result = await productService.getAllProducts({ search: 'nonexistent' });

      expect(result.products).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  // TC-008: Error handling
  describe('TC-008: Error Handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      mockApi.get.mockRejectedValue(timeoutError);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Request timeout - please try again');
      });

      await expect(productService.getAllProducts())
        .rejects.toThrow('Request timeout - please try again');
    });

    it('should handle server errors with retry logic', async () => {
      const serverError = {
        response: { status: 500, data: { message: 'Internal server error' } }
      };
      
      mockApi.get.mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce({ data: { products: [], pagination: {} } });

      // Service should implement retry logic for 5xx errors
      const result = await productService.getAllProducts({ retryOnServerError: true });

      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should clear cache on authentication errors', async () => {
      const authError = {
        response: { status: 401, data: { message: 'Token expired' } }
      };
      
      // Add something to cache first
      productService.cache.set('test', { data: 'test', timestamp: Date.now() });
      expect(productService.cache.size).toBe(1);
      
      mockApi.get.mockRejectedValue(authError);
      mockHandleApiError.mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(productService.getAllProducts())
        .rejects.toThrow('Authentication required');
        
      // Cache should be cleared on auth errors
      expect(productService.cache.size).toBe(0);
    });
  });
});