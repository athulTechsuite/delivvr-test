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

describe('AdminDashboard - Item Management', () => {
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

  // TC-001: Dashboard displays paginated list of items with key information
  describe('TC-001: Item List Display', () => {
    it('should display paginated list of items with key information', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Wait for items to load
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      // Verify item information is displayed
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
      
      // Verify pagination is present
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should handle empty item list', async () => {
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
    });
  });

  // TC-002: Search and filter functionality
  describe('TC-002: Search and Filter', () => {
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

    it('should filter items by category', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const categoryFilter = screen.getByLabelText(/category/i);
      fireEvent.change(categoryFilter, { target: { value: 'Electronics' } });

      await waitFor(() => {
        expect(mockFetchItems).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'Electronics'
          })
        );
      });
    });

    it('should filter items by status', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/status/i);
      fireEvent.change(statusFilter, { target: { value: 'active' } });

      await waitFor(() => {
        expect(mockFetchItems).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'active'
          })
        );
      });
    });
  });

  // TC-003: Add new item functionality
  describe('TC-003: Add New Item', () => {
    it('should open form when Add New Item button is clicked', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/add new item/i)).toBeInTheDocument();
    });

    it('should create new item with valid data', async () => {
      mockCreateItem.mockResolvedValue({ success: true, data: { id: 3 } });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      // Fill form
      await userEvent.type(screen.getByLabelText(/name/i), 'New Test Item');
      await userEvent.type(screen.getByLabelText(/description/i), 'New Description');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
      await userEvent.type(screen.getByLabelText(/price/i), '199.99');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Item',
            description: 'New Description',
            category: 'Electronics',
            price: '199.99'
          })
        );
      });
    });

    it('should show validation errors for required fields', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/category is required/i)).toBeInTheDocument();
      });
    });
  });

  // TC-004: Edit item functionality
  describe('TC-004: Edit Item', () => {
    it('should open edit form when edit button is clicked', async () => {
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

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
    });

    it('should update item with modified data', async () => {
      mockUpdateItem.mockResolvedValue({ success: true });

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
      await userEvent.type(nameInput, 'Updated Item Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: 'Updated Item Name'
          })
        );
      });
    });
  });

  // TC-005: Delete functionality with confirmation
  describe('TC-005: Delete Item', () => {
    it('should show confirmation dialog when delete is clicked', async () => {
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

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should delete item when confirmed', async () => {
      mockDeleteItem.mockResolvedValue({ success: true });

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
        expect(mockDeleteItem).toHaveBeenCalledWith(1);
      });
    });

    it('should not delete item when cancelled', async () => {
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

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockDeleteItem).not.toHaveBeenCalled();
    });
  });

  // TC-006: Bulk operations support
  describe('TC-006: Bulk Operations', () => {
    it('should select multiple items for bulk operations', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // First item checkbox
      await userEvent.click(checkboxes[2]); // Second item checkbox

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulk delete/i })).toBeInTheDocument();
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
  });

  // TC-008: Success/error notifications
  describe('TC-008: Notifications', () => {
    it('should show success notification on successful item creation', async () => {
      mockCreateItem.mockResolvedValue({ success: true, data: { id: 3 } });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText(/name/i), 'New Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
      });
    });

    it('should show error notification on failed operation', async () => {
      mockCreateItem.mockRejectedValue(new Error('Server error'));

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add new item/i });
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText(/name/i), 'New Item');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/error creating item/i)).toBeInTheDocument();
      });
    });
  });

  // TC-010: Role-based access control
  describe('TC-010: Role-based Access Control', () => {
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

    it('should display admin dashboard for admin users', async () => {
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/item management/i)).toBeInTheDocument();
      });
    });
  });
});