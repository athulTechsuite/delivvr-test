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

  // TC-001: Admin can access a dedicated dashboard page that displays all existing items
  describe('TC-001: Admin Dashboard Access and Item Display', () => {
    it('should successfully display dedicated dashboard page with all existing items - happy path', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Verify dashboard is accessible
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      
      // Wait for items to load and verify all items are displayed
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify all item information is displayed
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      
      // Verify API was called to fetch items
      expect(mockFetchItems).toHaveBeenCalledTimes(1);
    });

    it('should handle dashboard access error - error path', async () => {
      mockFetchItems.mockRejectedValue(new Error('Failed to fetch items'));

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
    });

    it('should handle empty items list - edge case', async () => {
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
    });
  });

  // TC-002: Admin can upload new items through a form interface
  describe('TC-002: Admin Item Upload Form Interface', () => {
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

      // Verify success message
      expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
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
    });
  });

  // TC-003: Admin can edit existing items
  describe('TC-003: Admin Edit Existing Items', () => {
    it('should successfully edit existing item - happy path', async () => {
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
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description 1')).toBeInTheDocument();

      // Modify item data
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Item Name');

      const priceInput = screen.getByDisplayValue('99.99');
      await userEvent.clear(priceInput);
      await userEvent.type(priceInput, '129.99');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify API call was made with correct data
      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: 'Updated Item Name',
            price: '129.99'
          })
        );
      });

      // Verify success message
      expect(screen.getByText(/item updated successfully/i)).toBeInTheDocument();
    });

    it('should handle edit validation errors - error path', async () => {
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

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });

      expect(mockUpdateItem).not.toHaveBeenCalled();
    });

    it('should handle edit server error - error path', async () => {
      mockUpdateItem.mockRejectedValue(new Error('Update failed'));

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
      await userEvent.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/error updating item/i)).toBeInTheDocument();
      });
    });
  });

  // TC-004: Admin can delete items with confirmation
  describe('TC-004: Admin Delete Items with Confirmation', () => {
    it('should successfully delete item with confirmation - happy path', async () => {
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

      // Verify confirmation dialog appears
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      // Verify API call was made
      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledWith(1);
      });

      // Verify success message
      expect(screen.getByText(/item deleted successfully/i)).toBeInTheDocument();
    });

    it('should cancel deletion when user cancels - happy path', async () => {
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

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Verify no API call was made
      expect(mockDeleteItem).not.toHaveBeenCalled();
      
      // Verify confirmation dialog is closed
      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    it('should handle delete server error - error path', async () => {
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

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/error deleting item/i)).toBeInTheDocument();
      });
    });
  });

  // TC-005: Dashboard displays appropriate error messages (enhanced coverage)
  describe('TC-005: Dashboard Error Message Display', () => {
    it('should display network error messages appropriately - happy path', async () => {
      // Test successful state first
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
    });

    it('should display fetch error messages - error path', async () => {
      mockFetchItems.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load items/i)).toBeInTheDocument();
      });

      // Verify retry option is available
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should display validation error messages - error path', async () => {
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

      // Verify multiple validation errors are displayed
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/category is required/i)).toBeInTheDocument();
        expect(screen.getByText(/price is required/i)).toBeInTheDocument();
      });
    });

    it('should display server error messages with proper formatting - error path', async () => {
      mockCreateItem.mockRejectedValue({
        response: {
          data: {
            message: 'Validation failed: Item name already exists'
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

      // Fill form
      await userEvent.type(screen.getByLabelText(/name/i), 'Duplicate Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '99.99');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Verify specific server error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/item name already exists/i)).toBeInTheDocument();
      });
    });

    it('should clear error messages on successful operations - happy path', async () => {
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
    });
  });

  // Additional existing tests for comprehensive coverage
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

      const bulkDeleteButton = screen.getByRole('button', { name: /bulk delete/i });
      await userEvent.click(bulkDeleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
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