import { itemsAPI } from '../api';
import { validateImageFile } from '../../utils/imageValidation';

// Mock fetch
global.fetch = jest.fn();

// Mock image validation
jest.mock('../../utils/imageValidation', () => ({
  validateImageFile: jest.fn()
}));

const mockItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test description 1',
    price: 29.99,
    category: 'Electronics',
    availableCount: 15,
    imageUrl: 'test1.jpg'
  },
  {
    id: 2,
    name: 'Test Item 2', 
    description: 'Test description 2',
    price: 49.99,
    category: 'Clothing',
    availableCount: 8,
    imageUrl: 'test2.jpg'
  }
];

describe('Items API Service', () => {
  beforeEach(() => {
    fetch.mockClear();
    validateImageFile.mockClear();
  });

  describe('getItems', () => {
    // TC-001: Dashboard displays a list of all items with pagination
    it('TC-001: should fetch items with pagination parameters', async () => {
      const mockResponse = {
        items: mockItems,
        total: 25,
        totalPages: 3,
        currentPage: 1
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      });

      const params = {
        page: 1,
        limit: 10,
        search: '',
        category: 'all'
      };

      const result = await itemsAPI.getItems(params);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items?page=1&limit=10&search=&category=all'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result.data.items).toEqual(mockItems);
      expect(result.data.total).toBe(25);
      expect(result.data.totalPages).toBe(3);
    });

    // TC-009: Search and filter functionality for items
    it('TC-009: should include search and filter parameters in request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { items: [], total: 0 } })
      });

      await itemsAPI.getItems({
        page: 1,
        limit: 10,
        search: 'electronics',
        category: 'Electronics',
        availability: 'in-stock'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=electronics'),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=Electronics'),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('availability=in-stock'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(itemsAPI.getItems({ page: 1 })).rejects.toThrow('Network error');
    });
  });

  describe('createItem', () => {
    // TC-002: Create new item functionality with form validation
    it('TC-002: should create item with valid data and image', async () => {
      const itemData = {
        name: 'New Item',
        description: 'New item description',
        price: 39.99,
        category: 'Electronics',
        availableCount: 20
      };

      const imageFile = new File(['dummy'], 'image.jpg', { type: 'image/jpeg' });
      
      validateImageFile.mockReturnValue({ isValid: true });
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 3, ...itemData, imageUrl: 'new-image.jpg' }
        })
      });

      const result = await itemsAPI.createItem({ ...itemData, image: imageFile });

      expect(validateImageFile).toHaveBeenCalledWith(imageFile);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );

      expect(result.data.name).toBe('New Item');
      expect(result.data.id).toBe(3);
    });

    // TC-005 & TC-006: Image upload with size validation
    it('TC-005/TC-006: should reject items with invalid image files', async () => {
      const itemData = {
        name: 'New Item',
        description: 'Description',
        price: 39.99,
        category: 'Electronics',
        availableCount: 20
      };

      const oversizedImage = new File(['dummy'], 'large.jpg', { type: 'image/jpeg' });
      
      validateImageFile.mockReturnValue({
        isValid: false,
        error: 'File size exceeds 200KB limit'
      });

      await expect(itemsAPI.createItem({ ...itemData, image: oversizedImage }))
        .rejects.toThrow('File size exceeds 200KB limit');

      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-012: Form validation prevents submission of incomplete data
    it('TC-012: should validate required fields before API call', async () => {
      const incompleteData = {
        name: '', // Missing required field
        description: 'Description',
        price: 0, // Invalid price
        category: '',
        availableCount: -1 // Invalid count
      };

      await expect(itemsAPI.createItem(incompleteData))
        .rejects.toThrow(/validation/i);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    // TC-003: Edit existing item functionality with pre-populated data
    it('TC-003: should update existing item', async () => {
      const updatedData = {
        name: 'Updated Item Name',
        description: 'Updated description',
        price: 59.99,
        availableCount: 25
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 1, ...updatedData }
        })
      });

      const result = await itemsAPI.updateItem(1, updatedData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items/1'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(updatedData)
        })
      );

      expect(result.data.name).toBe('Updated Item Name');
    });

    it('should update item with new image', async () => {
      const updatedData = {
        name: 'Updated Item',
        availableCount: 30
      };
      
      const newImage = new File(['dummy'], 'new-image.jpg', { type: 'image/jpeg' });
      validateImageFile.mockReturnValue({ isValid: true });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 1, ...updatedData, imageUrl: 'new.jpg' } })
      });

      await itemsAPI.updateItem(1, { ...updatedData, image: newImage });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items/1'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('deleteItem', () => {
    // TC-004: Delete item functionality with confirmation dialog
    it('TC-004: should delete item by ID', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Item deleted successfully' })
      });

      const result = await itemsAPI.deleteItem(1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items/1'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Item not found' })
      });

      await expect(itemsAPI.deleteItem(999))
        .rejects.toThrow('Item not found');
    });
  });

  describe('Error Handling', () => {
    // TC-011: Success/error notifications for all CRUD operations
    it('TC-011: should handle network errors properly', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(itemsAPI.getItems({ page: 1 }))
        .rejects.toThrow('Network failure');
    });

    it('should handle HTTP error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error occurred' })
      });

      await expect(itemsAPI.getItems({ page: 1 }))
        .rejects.toThrow('Server error occurred');
    });

    it('should handle malformed JSON responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(itemsAPI.getItems({ page: 1 }))
        .rejects.toThrow('Invalid JSON');
    });
  });
});