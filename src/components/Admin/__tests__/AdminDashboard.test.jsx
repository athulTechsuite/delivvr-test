import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AdminDashboard from '../AdminDashboard';
import { useAuth } from '../../../hooks/useAuth';
import { itemsAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('../../../hooks/useAuth');
jest.mock('../../../services/api');
jest.mock('react-hot-toast');

const theme = createTheme();

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

const mockUser = {
  id: 1,
  email: 'admin@test.com',
  role: 'admin'
};

const mockItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test description 1',
    price: 29.99,
    category: 'electronics',
    status: 'active',
    imageUrl: 'test-image-1.jpg',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Test Item 2',
    description: 'Test description 2',
    price: 49.99,
    category: 'clothing',
    status: 'inactive',
    imageUrl: 'test-image-2.jpg',
    createdAt: '2024-01-02T00:00:00Z'
  }
];

const mockPaginationData = {
  items: mockItems,
  pagination: {
    currentPage: 1,
    totalPages: 3,
    totalItems: 25,
    itemsPerPage: 10,
    hasNextPage: true,
    hasPrevPage: false
  }
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: mockUser,
      isAdmin: true,
      isAuthenticated: true
    });
    
    itemsAPI.getItems = jest.fn().mockResolvedValue({
      success: true,
      data: mockPaginationData
    });
    
    itemsAPI.deleteItem = jest.fn().mockResolvedValue({ success: true });
    itemsAPI.createItem = jest.fn().mockResolvedValue({ success: true, data: { id: 3, ...mockItems[0] } });
    itemsAPI.updateItem = jest.fn().mockResolvedValue({ success: true, data: mockItems[0] });
    
    toast.success = jest.fn();
    toast.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // TC-001: Admin can view a list of all items with pagination
  describe('TC-001: Item List View with Pagination', () => {
    test('should display list of items with pagination controls', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
        expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      });
      
      // Check pagination info
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      expect(screen.getByText(/25 total items/)).toBeInTheDocument();
      
      // Check pagination controls
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    });

    test('should navigate between pages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const nextButton = screen.getByLabelText('Go to next page');
      await user.click(nextButton);
      
      expect(itemsAPI.getItems).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10
        })
      );
    });
  });

  // TC-002: Admin can create new items with all required fields
  describe('TC-002: Item Creation', () => {
    test('should open create item form and create new item', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Form should open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Item')).toBeInTheDocument();
      
      // Fill form
      await user.type(screen.getByLabelText(/item name/i), 'New Test Item');
      await user.type(screen.getByLabelText(/description/i), 'New test description for the item');
      await user.type(screen.getByLabelText(/price/i), '39.99');
      await user.selectOptions(screen.getByLabelText(/category/i), 'electronics');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(itemsAPI.createItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Item',
            description: 'New test description for the item',
            price: 39.99,
            category: 'electronics'
          })
        );
      });
      
      expect(toast.success).toHaveBeenCalledWith('Item created successfully');
    });

    test('should show validation errors for invalid form data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Item name is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('Price is required')).toBeInTheDocument();
      });
    });
  });

  // TC-003: Admin can upload item images during creation
  describe('TC-003: Image Upload', () => {
    test('should handle image upload during item creation', async () => {
      const user = userEvent.setup();
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Upload image
      const imageInput = screen.getByLabelText(/upload image/i);
      await user.upload(imageInput, mockFile);
      
      await waitFor(() => {
        expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
      });
    });

    test('should validate image file type and size', async () => {
      const user = userEvent.setup();
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const imageInput = screen.getByLabelText(/upload image/i);
      await user.upload(imageInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
      });
    });
  });

  // TC-004: Admin can edit existing item details
  describe('TC-004: Item Editing', () => {
    test('should open edit form with existing item data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      // Form should open with existing data
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit Item')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('29.99')).toBeInTheDocument();
    });

    test('should update item successfully', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      // Update name
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Item');
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(itemsAPI.updateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: 'Updated Test Item'
          })
        );
      });
      
      expect(toast.success).toHaveBeenCalledWith('Item updated successfully');
    });
  });

  // TC-005: Admin can delete items with confirmation prompt
  describe('TC-005: Item Deletion', () => {
    test('should show confirmation dialog before deleting item', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      // Confirmation dialog should appear
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete "Test Item 1"/i)).toBeInTheDocument();
    });

    test('should delete item after confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(itemsAPI.deleteItem).toHaveBeenCalledWith(1);
      });
      
      expect(toast.success).toHaveBeenCalledWith('Item deleted successfully');
    });

    test('should cancel deletion when user clicks cancel', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(itemsAPI.deleteItem).not.toHaveBeenCalled();
      expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
    });
  });

  // TC-006: Admin can search and filter items
  describe('TC-006: Search and Filter Functionality', () => {
    test('should filter items by search query', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/search items/i);
      await user.type(searchInput, 'Test Item 1');
      
      // Debounced search should trigger
      await waitFor(() => {
        expect(itemsAPI.getItems).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Test Item 1'
          })
        );
      }, { timeout: 1000 });
    });

    test('should filter items by category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'electronics');
      
      expect(itemsAPI.getItems).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'electronics'
        })
      );
    });

    test('should filter items by status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(statusFilter, 'active');
      
      expect(itemsAPI.getItems).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active'
        })
      );
    });
  });

  // TC-007: Error handling for CRUD operations
  describe('TC-007: Error Handling', () => {
    test('should handle API errors during item fetching', async () => {
      itemsAPI.getItems.mockRejectedValueOnce(new Error('Failed to fetch items'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch items/i)).toBeInTheDocument();
      });
    });

    test('should handle API errors during item creation', async () => {
      const user = userEvent.setup();
      itemsAPI.createItem.mockRejectedValueOnce(new Error('Failed to create item'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      // Fill and submit form
      await user.type(screen.getByLabelText(/item name/i), 'New Test Item');
      await user.type(screen.getByLabelText(/description/i), 'New test description');
      await user.type(screen.getByLabelText(/price/i), '39.99');
      await user.selectOptions(screen.getByLabelText(/category/i), 'electronics');
      
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create item');
      });
    });
  });

  // TC-008: Only authenticated administrators can access
  describe('TC-008: Authentication and Authorization', () => {
    test('should redirect non-admin users', async () => {
      useAuth.mockReturnValue({
        user: { ...mockUser, role: 'user' },
        isAdmin: false,
        isAuthenticated: true
      });
      
      renderWithProviders(<AdminDashboard />);
      
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });

    test('should redirect unauthenticated users', async () => {
      useAuth.mockReturnValue({
        user: null,
        isAdmin: false,
        isAuthenticated: false
      });
      
      renderWithProviders(<AdminDashboard />);
      
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });
  });

  // TC-009: Responsive design
  describe('TC-009: Responsive Design', () => {
    test('should adapt layout for tablet screens', async () => {
      // Mock window.matchMedia for tablet size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      // Check that mobile menu toggle is visible
      const mobileMenuToggle = screen.queryByLabelText('Toggle menu');
      expect(mobileMenuToggle).toBeInTheDocument();
    });
  });
});