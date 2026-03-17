import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('react-toastify');
jest.mock('../../../services/productService');
jest.mock('../../../utils/auditLogger');

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock WebSocket for real-time updates
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN
}));

// Test wrapper component
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

// Mock data
const mockProducts = [
  {
    id: 1,
    name: 'Test Product 1',
    description: 'Test description 1',
    category: 'Electronics',
    price: 99.99,
    stock: 50,
    status: 'active',
    sku: 'TEST001',
    images: ['/test-image1.jpg']
  },
  {
    id: 2,
    name: 'Test Product 2',
    description: 'Test description 2',
    category: 'Sports',
    price: 149.99,
    stock: 25,
    status: 'inactive',
    sku: 'TEST002',
    images: ['/test-image2.jpg']
  }
];

const mockApiResponse = {
  products: mockProducts,
  pagination: {
    page: 1,
    totalPages: 1,
    total: 2,
    limit: 10
  }
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    fetch.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    
    // Mock successful API response by default
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    });
  });

  // TC-001: Dashboard displays a list view of all existing items with pagination
  describe('TC-001: List View with Pagination', () => {
    it('should display list of items with pagination controls', async () => {
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Wait for items to load
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        expect(screen.getByText('Test Product 2')).toBeInTheDocument();
      });
      
      // Check pagination controls are present
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByText(/Showing \d+ of \d+ items/)).toBeInTheDocument();
    });

    it('should handle pagination navigation', async () => {
      const user = userEvent.setup();
      
      // Mock multi-page response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          products: mockProducts,
          pagination: { page: 1, totalPages: 3, total: 30, limit: 10 }
        })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Click next page
      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);
      
      // Verify API called with correct page parameter
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        );
      });
    });

    it('should display correct pagination info', async () => {
      const mockPaginatedResponse = {
        products: mockProducts,
        pagination: {
          page: 2,
          totalPages: 5,
          total: 50,
          limit: 10
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPaginatedResponse)
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 5/)).toBeInTheDocument();
        expect(screen.getByText(/Showing 11-20 of 50 items/)).toBeInTheDocument();
      });
    });
  });

  // TC-002: Upload functionality allows admins to add new items
  describe('TC-002: Upload/Add New Items', () => {
    it('should open add item modal when clicking add button', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/add new item/i)).toBeInTheDocument();
    });

    it('should validate required fields when adding new item', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Open add modal
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Try to submit without required fields
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      // Check validation errors appear
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
        expect(screen.getByText(/category is required/i)).toBeInTheDocument();
        expect(screen.getByText(/price is required/i)).toBeInTheDocument();
      });
    });

    it('should successfully create new item with valid data', async () => {
      const user = userEvent.setup();
      
      // Mock successful create API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, product: { id: 3, ...mockProducts[0] } })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Open add modal
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Fill in form fields
      await user.type(screen.getByLabelText(/name/i), 'New Test Product');
      await user.type(screen.getByLabelText(/description/i), 'New test description');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await user.type(screen.getByLabelText(/price/i), '199.99');
      await user.type(screen.getByLabelText(/stock/i), '100');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      // Verify API call and success message
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/products'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('New Test Product')
          })
        );
        expect(toast.success).toHaveBeenCalledWith('Item created successfully');
      });
    });

    it('should handle file upload validation', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Try to upload invalid file type
      const fileInput = screen.getByLabelText(/upload image/i);
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
      });
    });

    it('should handle file upload size limit', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Create large file (5MB)
      const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/upload image/i);
      
      await user.upload(fileInput, largeFile);
      
      await waitFor(() => {
        expect(screen.getByText(/file size must be less than 2MB/i)).toBeInTheDocument();
      });
    });
  });

  // TC-003: Edit functionality enables modification of any item property
  describe('TC-003: Edit Item Functionality', () => {
    it('should open edit modal with pre-populated data', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Click edit button for first product
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);
      
      // Verify modal opens with existing data
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Product 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
    });

    it('should successfully update item with validation', async () => {
      const user = userEvent.setup();
      
      // Mock successful update API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Open edit modal
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);
      
      // Modify the name field
      const nameField = screen.getByDisplayValue('Test Product 1');
      await user.clear(nameField);
      await user.type(nameField, 'Updated Product Name');
      
      // Submit changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      // Verify update API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/products/1'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Product Name')
          })
        );
        expect(toast.success).toHaveBeenCalledWith('Item updated successfully');
      });
    });

    it('should validate edit form fields', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Open edit modal
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);
      
      // Clear required field
      const nameField = screen.getByDisplayValue('Test Product 1');
      await user.clear(nameField);
      
      // Try to submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });
  });

  // TC-004: Delete functionality with confirmation dialog
  describe('TC-004: Delete Item with Confirmation', () => {
    it('should show confirmation dialog when deleting item', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);
      
      // Verify confirmation dialog appears
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should cancel delete when clicking cancel', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Open delete confirmation
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);
      
      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Verify dialog closes and no API call made
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/products/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should successfully delete item when confirmed', async () => {
      const user = userEvent.setup();
      
      // Mock successful delete API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Open delete confirmation
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);
      
      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      // Verify delete API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/products/1'),
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(toast.success).toHaveBeenCalledWith('Item deleted successfully');
      });
    });

    it('should show item details in confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);
      
      // Verify item name appears in confirmation
      expect(screen.getByText(/delete "Test Product 1"/i)).toBeInTheDocument();
    });
  });

  // TC-005: Search and filter capabilities
  describe('TC-005: Search and Filter Functionality', () => {
    it('should filter items by search term', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Type in search input
      const searchInput = screen.getByPlaceholderText(/search items/i);
      await user.type(searchInput, 'Electronics');
      
      // Verify API called with search parameter
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=Electronics'),
          expect.any(Object)
        );
      });
    });

    it('should filter items by category', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Select category filter
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'Electronics');
      
      // Verify API called with category filter
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('category=Electronics'),
          expect.any(Object)
        );
      });
    });

    it('should combine multiple filters', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Apply search and category filter
      const searchInput = screen.getByPlaceholderText(/search items/i);
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      
      await user.type(searchInput, 'Test');
      await user.selectOptions(categoryFilter, 'Electronics');
      
      // Verify API called with combined filters
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=Test.*category=Electronics|category=Electronics.*search=Test/),
          expect.any(Object)
        );
      });
    });

    it('should filter by status', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      const statusFilter = screen.getByRole('combobox', { name: /status/i });
      await user.selectOptions(statusFilter, 'active');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=active'),
          expect.any(Object)
        );
      });
    });

    it('should clear all filters', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Apply some filters
      const searchInput = screen.getByPlaceholderText(/search items/i);
      await user.type(searchInput, 'Test');
      
      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);
      
      // Verify filters are cleared
      expect(searchInput).toHaveValue('');
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.not.stringContaining('search='),
          expect.any(Object)
        );
      });
    });
  });

  // TC-006: Bulk operations support
  describe('TC-006: Bulk Operations', () => {
    it('should allow selecting multiple items', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First item checkbox (index 0 is "select all")
      await user.click(checkboxes[2]); // Second item checkbox
      
      // Verify bulk actions become available
      expect(screen.getByText(/2 items selected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulk actions/i })).toBeInTheDocument();
    });

    it('should support bulk delete operation', async () => {
      const user = userEvent.setup();
      
      // Mock successful bulk delete API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, deletedCount: 2 })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Select items
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      
      // Open bulk actions menu
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);
      
      // Click bulk delete
      const bulkDeleteOption = screen.getByRole('menuitem', { name: /delete selected/i });
      await user.click(bulkDeleteOption);
      
      // Confirm bulk delete
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      // Verify bulk delete API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/products/bulk-delete'),
          expect.objectContaining({
            method: 'DELETE',
            body: expect.stringContaining('[1,2]')
          })
        );
        expect(toast.success).toHaveBeenCalledWith('2 items deleted successfully');
      });
    });

    it('should support select all functionality', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Click select all checkbox
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);
      
      // Verify all items are selected
      const allCheckboxes = screen.getAllByRole('checkbox');
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
      
      expect(screen.getByText(/2 items selected/i)).toBeInTheDocument();
    });

    it('should support bulk status update', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, updatedCount: 2 })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Select items
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      
      // Open bulk actions
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);
      
      // Select status update
      const statusUpdateOption = screen.getByRole('menuitem', { name: /update status/i });
      await user.click(statusUpdateOption);
      
      // Select new status
      const statusSelect = screen.getByRole('combobox', { name: /new status/i });
      await user.selectOptions(statusSelect, 'inactive');
      
      const confirmButton = screen.getByRole('button', { name: /update/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/products/bulk-update'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"status":"inactive"')
          })
        );
      });
    });
  });

  // TC-007: Real-time updates
  describe('TC-007: Real-time Updates', () => {
    it('should establish WebSocket connection for real-time updates', async () => {
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('/ws/dashboard')
        );
      });
    });

    it('should handle real-time item creation updates', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      WebSocket.mockImplementationOnce(() => mockWebSocket);
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Simulate WebSocket message for new item
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      act(() => {
        messageHandler({
          data: JSON.stringify({
            type: 'ITEM_CREATED',
            data: {
              id: 3,
              name: 'Real-time Product',
              description: 'Added via WebSocket'
            }
          })
        });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Real-time Product')).toBeInTheDocument();
      });
    });

    it('should handle real-time item updates', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      WebSocket.mockImplementationOnce(() => mockWebSocket);
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Simulate WebSocket message for item update
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      act(() => {
        messageHandler({
          data: JSON.stringify({
            type: 'ITEM_UPDATED',
            data: {
              id: 1,
              name: 'Updated Product Name',
              description: 'Updated description'
            }
          })
        });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Updated Product Name')).toBeInTheDocument();
      });
    });

    it('should handle real-time item deletion', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      WebSocket.mockImplementationOnce(() => mockWebSocket);
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Simulate WebSocket message for item deletion
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      act(() => {
        messageHandler({
          data: JSON.stringify({
            type: 'ITEM_DELETED',
            data: { id: 1 }
          })
        });
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Test Product 1')).not.toBeInTheDocument();
      });
    });
  });

  // TC-008: Error handling and user feedback
  describe('TC-008: Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load items')
        );
      });
    });

    it('should show loading states during operations', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      fetch.mockImplementationOnce(() => new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse)
        }), 100)
      ));
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Verify loading indicator appears
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('should validate form input and show appropriate errors', async () => {
      const user = userEvent.setup();
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Open add item modal
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Enter invalid price
      await user.type(screen.getByLabelText(/price/i), '-10');
      
      // Try to submit
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/price must be positive/i)).toBeInTheDocument();
      });
    });

    it('should handle server validation errors', async () => {
      const user = userEvent.setup();
      
      // Mock server validation error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'SKU already exists',
          field: 'sku'
        })
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Fill form
      await user.type(screen.getByLabelText(/name/i), 'Test Product');
      await user.type(screen.getByLabelText(/sku/i), 'EXISTING001');
      
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/sku already exists/i)).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Network error')
        );
      });
      
      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // TC-009: Responsive design
  describe('TC-009: Responsive Design', () => {
    beforeEach(() => {
      // Reset window size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 768,
      });
    });

    it('should adapt layout for tablet viewport', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Verify responsive classes are applied
      const dashboard = screen.getByTestId('admin-dashboard');
      expect(dashboard).toHaveClass('responsive-layout');
    });

    it('should adapt layout for mobile viewport', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Mobile layout should stack items vertically
      const dashboard = screen.getByTestId('admin-dashboard');
      expect(dashboard).toHaveClass('mobile-layout');
      
      // Should have hamburger menu for filters
      expect(screen.getByLabelText(/open filters menu/i)).toBeInTheDocument();
    });

    it('should make modals responsive', async () => {
      const user = userEvent.setup();
      
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Open add modal
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Modal should be full-screen on mobile
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('mobile-fullscreen');
    });

    it('should handle touch interactions on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Should have touch-friendly button sizes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight);
        expect(minHeight).toBeGreaterThanOrEqual(44); // 44px minimum touch target
      });
    });
  });

  // TC-010: Audit trail logging
  describe('TC-010: Audit Trail Logging', () => {
    beforeEach(() => {
      const mockAuditLogger = require('../../../utils/auditLogger');
      mockAuditLogger.logItemAction = jest.fn();
      mockAuditLogger.logBulkAction = jest.fn();
      mockAuditLogger.logUserAction = jest.fn();
    });

    it('should log item creation actions', async () => {
      const user = userEvent.setup();
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      // Perform item creation
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Fill and submit form
      await user.type(screen.getByLabelText(/name/i), 'Audit Test Product');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await user.type(screen.getByLabelText(/price/i), '99.99');
      
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      // Verify audit logging was called
      await waitFor(() => {
        expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
          'CREATE',
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            itemName: 'Audit Test Product',
            action: 'Item created'
          })
        );
      });
    });

    it('should log item update actions', async () => {
      const user = userEvent.setup();
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Edit item
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);
      
      const nameField = screen.getByDisplayValue('Test Product 1');
      await user.clear(nameField);
      await user.type(nameField, 'Updated Name');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
          'UPDATE',
          expect.any(String),
          expect.any(String),
          '1',
          expect.objectContaining({
            previousData: expect.objectContaining({ name: 'Test Product 1' }),
            newData: expect.objectContaining({ name: 'Updated Name' }),
            action: 'Item updated'
          })
        );
      });
    });

    it('should log item deletion actions', async () => {
      const user = userEvent.setup();
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Delete item
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
          'DELETE',
          expect.any(String),
          expect.any(String),
          '1',
          expect.objectContaining({
            itemName: 'Test Product 1',
            action: 'Item deleted'
          })
        );
      });
    });

    it('should log bulk operations', async () => {
      const user = userEvent.setup();
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });
      
      // Select items for bulk operation
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      
      // Perform bulk delete
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);
      
      const bulkDeleteOption = screen.getByRole('menuitem', { name: /delete selected/i });
      await user.click(bulkDeleteOption);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockAuditLogger.logBulkAction).toHaveBeenCalledWith(
          'BULK_DELETE',
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            itemIds: [1, 2],
            itemCount: 2,
            action: 'Bulk delete performed'
          })
        );
      });
    });

    it('should log user session actions', async () => {
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(mockAuditLogger.logUserAction).toHaveBeenCalledWith(
          'DASHBOARD_ACCESS',
          expect.any(String),
          expect.objectContaining({
            page: 'admin-dashboard',
            action: 'User accessed admin dashboard'
          })
        );
      });
    });

    it('should include comprehensive audit metadata', async () => {
      const user = userEvent.setup();
      const mockAuditLogger = require('../../../utils/auditLogger');
      
      render(<AdminDashboard />, { wrapper: TestWrapper });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      await user.type(screen.getByLabelText(/name/i), 'Audit Product');
      await user.type(screen.getByLabelText(/description/i), 'Test');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await user.type(screen.getByLabelText(/price/i), '50.00');
      
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockAuditLogger.logItemAction).toHaveBeenCalledWith(
          'CREATE',
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            timestamp: expect.any(String),
            userAgent: expect.any(String),
            ipAddress: expect.any(String),
            sessionId: expect.any(String),
            itemName: 'Audit Product',
            action: 'Item created'
          })
        );
      });
    });
  });
});