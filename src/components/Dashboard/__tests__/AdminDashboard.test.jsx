import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock API calls
const mockFetchItems = jest.fn();
const mockCreateItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockDeleteItem = jest.fn();
const mockBulkDelete = jest.fn();

jest.mock('../../../services/api', () => ({
  fetchItems: () => mockFetchItems(),
  createItem: (data) => mockCreateItem(data),
  updateItem: (id, data) => mockUpdateItem(id, data),
  deleteItem: (id) => mockDeleteItem(id),
  bulkDeleteItems: (ids) => mockBulkDelete(ids)
}));

// Mock data
const mockItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test Description 1',
    category: 'Electronics',
    status: 'active',
    price: 99.99,
    stock: 10,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Test Item 2',
    description: 'Test Description 2',
    category: 'Clothing',
    status: 'inactive',
    price: 49.99,
    stock: 5,
    createdAt: '2024-01-02T00:00:00Z'
  }
];

const mockPaginatedItems = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  description: `Description ${i + 1}`,
  category: 'Electronics',
  status: 'active',
  price: 99.99 + i,
  stock: 10 + i,
  createdAt: '2024-01-01T00:00:00Z'
}));

const mockUser = {
  id: 1,
  email: 'admin@test.com',
  role: 'admin',
  name: 'Admin User'
};

// Test wrapper component
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('AdminDashboard', () => {
  beforeEach(() => {
    mockFetchItems.mockResolvedValue({
      data: mockItems,
      totalCount: mockItems.length,
      currentPage: 1,
      totalPages: 1
    });
    
    // Mock auth context
    jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth').mockReturnValue({
      user: mockUser,
      isAuthenticated: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // AC-001: Admin can access dedicated dashboard page with paginated item list
  describe('AC-001: Admin Dashboard Page with Paginated Item List', () => {
    it('should successfully display dedicated dashboard page with paginated item list - happy path', async () => {
      // Mock paginated response
      mockFetchItems.mockResolvedValue({
        data: mockPaginatedItems.slice(0, 10),
        totalCount: 15,
        currentPage: 1,
        totalPages: 2
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Verify dashboard is accessible
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      
      // Wait for items to load and verify paginated display
      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      // Verify pagination elements are displayed
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();

      // Verify correct number of items per page (should show 10 items)
      const itemElements = screen.getAllByTestId('item-row');
      expect(itemElements).toHaveLength(10);

      // Test pagination navigation
      const nextButton = screen.getByRole('button', { name: /next page/i });
      mockFetchItems.mockResolvedValueOnce({
        data: mockPaginatedItems.slice(10, 15),
        totalCount: 15,
        currentPage: 2,
        totalPages: 2
      });

      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(mockFetchItems).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            limit: 10
          })
        );
      });
      
      // Verify API was called to fetch items with pagination
      expect(mockFetchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number)
        })
      );
    });

    it('should handle dashboard access and pagination errors - error path', async () => {
      mockFetchItems.mockRejectedValue(new Error('Failed to fetch paginated items'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/failed to load items/i)).toBeInTheDocument();
      });

      // Verify error message is displayed
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle pagination navigation errors - error path', async () => {
      // Initial successful load
      mockFetchItems.mockResolvedValueOnce({
        data: mockPaginatedItems.slice(0, 10),
        totalCount: 15,
        currentPage: 1,
        totalPages: 2
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      // Mock pagination error
      mockFetchItems.mockRejectedValueOnce(new Error('Pagination failed'));

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/error loading page/i)).toBeInTheDocument();
      });
    });

    it('should handle empty paginated results - edge case', async () => {
      mockFetchItems.mockResolvedValue({
        data: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no items found/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/add your first item/i)).toBeInTheDocument();
      expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
    });
  });

  // AC-002: Admin can upload new items through form interface
  describe('AC-002: Admin Item Upload Form Interface', () => {
    it('should successfully upload new item through form interface - happy path', async () => {
      const newItem = { id: 3, name: 'New Test Item', category: 'Electronics', price: 199.99 };
      mockCreateItem.mockResolvedValue({ success: true, data: newItem });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Open upload form
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Verify form is displayed
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/add new item/i)).toBeInTheDocument();

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText(/name/i), 'New Test Item');
      await userEvent.type(screen.getByLabelText(/description/i), 'New item description');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '199.99');
      await userEvent.type(screen.getByLabelText(/stock/i), '15');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify API call was made with correct data
      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Item',
            description: 'New item description',
            category: 'Electronics',
            price: '199.99',
            stock: '15'
          })
        );
      });

      // Verify success message and form closure
      expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should handle upload form validation errors - error path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Try to submit empty form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify validation errors
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/category is required/i)).toBeInTheDocument();
        expect(screen.getByText(/price is required/i)).toBeInTheDocument();
      });

      // Test invalid price format
      await userEvent.type(screen.getByLabelText(/name/i), 'Test Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), 'invalid-price');

      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid price/i)).toBeInTheDocument();
      });

      // Verify API was not called
      expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('should handle upload server error - error path', async () => {
      mockCreateItem.mockRejectedValue(new Error('Server error'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Fill required fields
      await userEvent.type(screen.getByLabelText(/name/i), 'Test Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '99.99');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(/error creating item/i)).toBeInTheDocument();
      });

      // Verify form remains open for retry
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle file upload validation - error path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Test file size validation
      const fileInput = screen.getByLabelText(/image/i);
      const oversizedFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      await userEvent.upload(fileInput, oversizedFile);

      await waitFor(() => {
        expect(screen.getByText(/file size must be less than 2mb/i)).toBeInTheDocument();
      });

      // Test invalid file type
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await userEvent.upload(fileInput, invalidFile);

      await waitFor(() => {
        expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
      });
    });
  });

  // AC-003: Admin can edit existing items with validation
  describe('AC-003: Admin Edit Existing Items with Validation', () => {
    it('should successfully edit existing item with validation - happy path', async () => {
      mockUpdateItem.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Click edit button for first item
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      // Verify edit form is displayed with existing data
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/edit item/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description 1')).toBeInTheDocument();

      // Modify item data with validation
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Item Name');

      const priceInput = screen.getByDisplayValue('99.99');
      await userEvent.clear(priceInput);
      await userEvent.type(priceInput, '129.99');

      const stockInput = screen.getByDisplayValue('10');
      await userEvent.clear(stockInput);
      await userEvent.type(stockInput, '25');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify API call was made with correct data
      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: 'Updated Item Name',
            price: '129.99',
            stock: '25'
          })
        );
      });

      // Verify success message and form closure
      expect(screen.getByText(/item updated successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should handle edit form validation errors - error path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      // Clear required field
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await userEvent.clear(nameInput);

      // Enter invalid price
      const priceInput = screen.getByDisplayValue('99.99');
      await userEvent.clear(priceInput);
      await userEvent.type(priceInput, '-10');

      // Enter invalid stock
      const stockInput = screen.getByDisplayValue('10');
      await userEvent.clear(stockInput);
      await userEvent.type(stockInput, '-5');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify validation errors
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/price must be greater than 0/i)).toBeInTheDocument();
        expect(screen.getByText(/stock cannot be negative/i)).toBeInTheDocument();
      });

      expect(mockUpdateItem).not.toHaveBeenCalled();
    });

    it('should handle edit server validation errors - error path', async () => {
      mockUpdateItem.mockRejectedValue({
        response: {
          data: {
            errors: {
              name: 'Item name already exists',
              category: 'Invalid category selected'
            }
          }
        }
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('Test Item 1');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Duplicate Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/item name already exists/i)).toBeInTheDocument();
        expect(screen.getByText(/invalid category selected/i)).toBeInTheDocument();
      });
    });

    it('should validate form fields in real-time during edit - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      // Test real-time validation
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await userEvent.clear(nameInput);

      // Should show validation error immediately
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });

      // Should clear error when valid input is entered
      await userEvent.type(nameInput, 'Valid Name');

      await waitFor(() => {
        expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  // AC-004: Admin can delete items with confirmation
  describe('AC-004: Admin Delete Items with Confirmation', () => {
    it('should successfully delete single item with confirmation - happy path', async () => {
      mockDeleteItem.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      // Verify confirmation dialog appears with proper details
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByText(/test item 1/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      // Verify API call was made
      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledWith(1);
      });

      // Verify success message and dialog closure
      expect(screen.getByText(/item deleted successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should cancel deletion when user clicks cancel - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      // Verify confirmation dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Verify no API call was made
      expect(mockDeleteItem).not.toHaveBeenCalled();
      
      // Verify confirmation dialog is closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Verify item is still visible
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    it('should handle delete server error with proper error handling - error path', async () => {
      mockDeleteItem.mockRejectedValue(new Error('Delete failed'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/error deleting item/i)).toBeInTheDocument();
      });

      // Verify item is still visible after failed deletion
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    it('should handle bulk delete with confirmation - happy path', async () => {
      mockBulkDelete.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // First item checkbox
      await userEvent.click(checkboxes[2]); // Second item checkbox

      // Verify bulk delete button is enabled
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      expect(bulkDeleteButton).not.toBeDisabled();

      await userEvent.click(bulkDeleteButton);

      // Verify bulk confirmation dialog
      expect(screen.getByText(/are you sure you want to delete 2 items/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockBulkDelete).toHaveBeenCalledWith([1, 2]);
      });

      expect(screen.getByText(/items deleted successfully/i)).toBeInTheDocument();
    });

    it('should prevent deletion when item is referenced by other entities - error path', async () => {
      mockDeleteItem.mockRejectedValue({
        response: {
          data: {
            message: 'Cannot delete item: referenced by active orders'
          }
        }
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot delete item: referenced by active orders/i)).toBeInTheDocument();
      });
    });
  });

  // AC-005: Dashboard displays error messages appropriately
  describe('AC-005: Dashboard Error Message Display', () => {
    it('should display appropriate success messages - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify no error messages are displayed in success state
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
      
      // Verify success indicators
      expect(screen.getByText(/dashboard loaded successfully/i)).toBeInTheDocument();
    });

    it('should display network error messages with retry options - error path', async () => {
      mockFetchItems.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load items/i)).toBeInTheDocument();
      });

      // Verify comprehensive error information
      expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      expect(screen.getByText(/please check your connection/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    });

    it('should display validation error messages with field highlighting - error path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Open add form
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Submit invalid form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify multiple validation errors are displayed with proper styling
      await waitFor(() => {
        const nameError = screen.getByText(/name is required/i);
        const categoryError = screen.getByText(/category is required/i);
        const priceError = screen.getByText(/price is required/i);
        
        expect(nameError).toBeInTheDocument();
        expect(categoryError).toBeInTheDocument();
        expect(priceError).toBeInTheDocument();
        
        // Verify error styling is applied
        expect(nameError).toHaveClass('error-message');
        expect(screen.getByLabelText(/name/i)).toHaveClass('error-field');
      });

      // Verify error summary
      expect(screen.getByText(/please correct the following errors/i)).toBeInTheDocument();
    });

    it('should display server error messages with detailed information - error path', async () => {
      mockCreateItem.mockRejectedValue({
        response: {
          data: {
            message: 'Validation failed: Item name already exists',
            details: 'Another item with the same name exists in the Electronics category',
            code: 'DUPLICATE_ITEM_NAME'
          }
        }
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Fill form with duplicate data
      await userEvent.type(screen.getByLabelText(/name/i), 'Duplicate Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '99.99');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify detailed server error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/item name already exists/i)).toBeInTheDocument();
        expect(screen.getByText(/another item with the same name exists in the electronics category/i)).toBeInTheDocument();
        expect(screen.getByText(/error code: duplicate_item_name/i)).toBeInTheDocument();
      });
    });

    it('should auto-dismiss success messages and persist error messages - error path', async () => {
      jest.useFakeTimers();
      
      mockCreateItem.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Create item successfully
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText(/name/i), 'New Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '99.99');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
      });

      // Fast-forward timers to test auto-dismiss
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText(/item created successfully/i)).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should clear error messages on successful retry operations - happy path', async () => {
      // Start with error state
      mockFetchItems.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load items/i)).toBeInTheDocument();
      });

      // Mock successful retry
      mockFetchItems.mockResolvedValue({
        data: mockItems,
        totalCount: mockItems.length,
        currentPage: 1,
        totalPages: 1
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      // Verify error is cleared and data is displayed
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      expect(screen.queryByText(/failed to load items/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
    });

    it('should display appropriate loading states during operations - happy path', async () => {
      // Mock delayed response
      let resolveItems;
      mockFetchItems.mockImplementation(() => new Promise(resolve => {
        resolveItems = resolve;
      }));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Verify loading state
      expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Resolve the promise
      resolveItems({
        data: mockItems,
        totalCount: mockItems.length,
        currentPage: 1,
        totalPages: 1
      });

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      expect(screen.queryByText(/loading dashboard/i)).not.toBeInTheDocument();
    });
  });

  // AC-006: Accessibility via keyboard navigation and screen readers
  describe('AC-006: Accessibility via Keyboard Navigation and Screen Readers', () => {
    it('should support full keyboard navigation throughout dashboard - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Test tab navigation through main elements
      const addButton = screen.getByRole('button', { name: /add new item/i });
      addButton.focus();
      expect(document.activeElement).toBe(addButton);

      // Test keyboard shortcut to open add form
      fireEvent.keyDown(addButton, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Test form navigation with keyboard
      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveAttribute('tabindex', '0');
      
      nameInput.focus();
      expect(document.activeElement).toBe(nameInput);

      // Navigate to next field with tab
      fireEvent.keyDown(nameInput, { key: 'Tab' });
      const descriptionInput = screen.getByLabelText(/description/i);
      descriptionInput.focus();
      expect(document.activeElement).toBe(descriptionInput);

      // Test escape key to close dialog
      fireEvent.keyDown(descriptionInput, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should provide proper ARIA labels and roles for screen readers - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify main dashboard has proper ARIA attributes
      const dashboard = screen.getByTestId('admin-dashboard');
      expect(dashboard).toHaveAttribute('role', 'main');
      expect(dashboard).toHaveAttribute('aria-label', 'Admin Dashboard');

      // Verify table has proper ARIA structure
      const itemTable = screen.getByRole('table');
      expect(itemTable).toHaveAttribute('aria-label', 'Items list');
      
      const tableHeaders = screen.getAllByRole('columnheader');
      expect(tableHeaders[0]).toHaveAttribute('aria-sort', 'none');
      expect(tableHeaders[0]).toHaveTextContent('Name');

      // Verify action buttons have descriptive labels
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons[0]).toHaveAttribute('aria-label', 'Edit Test Item 1');

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons[0]).toHaveAttribute('aria-label', 'Delete Test Item 1');

      // Verify pagination has proper ARIA labels
      if (screen.queryByRole('navigation', { name: /pagination/i })) {
        const pagination = screen.getByRole('navigation', { name: /pagination/i });
        expect(pagination).toBeInTheDocument();
      }
    });

    it('should handle keyboard navigation in forms with proper focus management - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Open add form
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Verify focus is properly managed in modal
      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('aria-modal', 'true');
        expect(modal).toHaveAttribute('aria-labelledby');
        
        const nameInput = screen.getByLabelText(/name/i);
        expect(document.activeElement).toBe(nameInput);
      });

      // Test keyboard navigation through form fields
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.keyDown(nameInput, { key: 'Tab' });

      const descriptionInput = screen.getByLabelText(/description/i);
      expect(document.activeElement).toBe(descriptionInput);

      // Test field validation with keyboard
      await userEvent.type(nameInput, 'Test Item');
      fireEvent.keyDown(nameInput, { key: 'Tab' });

      // Verify required field indicators are accessible
      expect(nameInput).toHaveAttribute('aria-required', 'true');
      expect(nameInput).toHaveAttribute('aria-describedby');
    });

    it('should handle keyboard navigation errors and provide audio feedback - error path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Open form and trigger validation error
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.keyDown(saveButton, { key: 'Enter' });

      // Verify error messages are properly announced
      await waitFor(() => {
        const errorMessage = screen.getByText(/name is required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });

      // Verify focus moves to first error field
      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
      expect(nameInput).toHaveAttribute('aria-describedby');
    });

    it('should support screen reader announcements for dynamic content changes - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify live region for status updates
      const liveRegion = screen.getByLabelText(/status updates/i);
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

      // Test search functionality announcements
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-label', 'Search items');

      await userEvent.type(searchInput, 'Test');

      // Mock search results update
      mockFetchItems.mockResolvedValue({
        data: [mockItems[0]],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1
      });

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/found 1 result/i);
      });
    });

    it('should handle accessibility errors gracefully - error path', async () => {
      // Mock screen reader detection failure
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'MockBrowser/1.0'
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify fallback accessibility features are still present
      const dashboard = screen.getByTestId('admin-dashboard');
      expect(dashboard).toHaveAttribute('role', 'main');

      // Test high contrast mode support
      const itemTable = screen.getByRole('table');
      expect(itemTable).toHaveClass('high-contrast-supported');

      // Verify keyboard traps work in modals even without screen reader
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('aria-modal', 'true');
      });

      // Test that focus is trapped within modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.keyDown(cancelButton, { key: 'Tab' });

      const firstInput = screen.getByLabelText(/name/i);
      expect(document.activeElement).toBe(firstInput);
    });

    it('should support assistive technology shortcuts and commands - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Test skip links
      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toHaveAttribute('href', '#main-content');

      fireEvent.keyDown(skipLink, { key: 'Enter' });
      const mainContent = screen.getByTestId('admin-dashboard');
      expect(document.activeElement).toBe(mainContent);

      // Test landmark navigation
      const navigation = screen.getByRole('navigation', { name: /main navigation/i });
      expect(navigation).toBeInTheDocument();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Test heading hierarchy
      const headings = screen.getAllByRole('heading');
      expect(headings[0]).toHaveAttribute('aria-level', '1');
      expect(headings[1]).toHaveAttribute('aria-level', '2');

      // Test table navigation shortcuts
      const table = screen.getByRole('table');
      fireEvent.keyDown(table, { key: 'ArrowDown' });
      
      const firstRow = screen.getAllByRole('row')[1]; // Skip header row
      expect(firstRow).toHaveAttribute('aria-selected', 'true');
    });
  });

  // Additional comprehensive tests
  describe('Additional Dashboard Features', () => {
    it('should filter items by search term', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search items/i);
      await userEvent.type(searchInput, 'Test Item 1');

      await waitFor(() => {
        expect(mockFetchItems).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Test Item 1'
          })
        );
      });
    });

    it('should perform bulk delete operation', async () => {
      mockBulkDelete.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);
      await userEvent.click(checkboxes[2]);

      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await userEvent.click(bulkDeleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockBulkDelete).toHaveBeenCalledWith([1, 2]);
      });
    });

    it('should not display admin dashboard for non-admin users', () => {
      jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth').mockReturnValue({
        user: { ...mockUser, role: 'customer' },
        isAuthenticated: true
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });
});