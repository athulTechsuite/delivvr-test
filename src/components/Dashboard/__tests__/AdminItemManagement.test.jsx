import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminItemManagement from '../AdminItemManagement';
import * as authHooks from '../../../hooks/useAuth';
import * as notificationHooks from '../../../hooks/useNotification';

// Mock dependencies
jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useNotification');
jest.mock('../../UI/LoadingSpinner', () => () => <div data-testid="loading-spinner">Loading...</div>);
jest.mock('../../UI/Modal', () => ({ children, isOpen, onClose, title }) => 
  isOpen ? (
    <div data-testid="modal" role="dialog">
      <h2>{title}</h2>
      <button onClick={onClose} data-testid="modal-close">×</button>
      {children}
    </div>
  ) : null
);
jest.mock('../../UI/ConfirmDialog', () => ({ isOpen, onConfirm, onCancel, message }) => 
  isOpen ? (
    <div data-testid="confirm-dialog" role="dialog">
      <p>{message}</p>
      <button onClick={onConfirm} data-testid="confirm-yes">Yes</button>
      <button onClick={onCancel} data-testid="confirm-no">No</button>
    </div>
  ) : null
);

// Mock fetch globally
global.fetch = jest.fn();

// Mock auth context
const mockUseAuth = {
  user: { id: 1, name: 'Admin User', role: 'admin' },
  isAdmin: true
};

const mockUseNotification = {
  showNotification: jest.fn()
};

// Sample test data
const sampleItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test description 1',
    category: 'Electronics',
    quantity: 10,
    price: 99.99,
    status: 'active',
    images: ['image1.jpg'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Test Item 2',
    description: 'Test description 2',
    category: 'Clothing',
    quantity: 0,
    price: 49.99,
    status: 'inactive',
    images: [],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

const renderAdminItemManagement = () => {
  return render(
    <BrowserRouter>
      <AdminItemManagement />
    </BrowserRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  authHooks.useAuth.mockReturnValue(mockUseAuth);
  notificationHooks.useNotification.mockReturnValue(mockUseNotification);
  
  // Default successful fetch response
  fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: { items: sampleItems, totalPages: 1, totalItems: 2 }
    })
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AdminItemManagement Component', () => {
  // TC-001: Dashboard displays a list of all items with key information
  describe('TC-001: Item List Display', () => {
    it('should display all items with key information (name, description, quantity, status)', async () => {
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Check that items are displayed
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      expect(screen.getByText('Test description 1')).toBeInTheDocument();
      expect(screen.getByText('Test description 2')).toBeInTheDocument();
      
      // Check quantity display
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      
      // Check status display
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    it('should show real-time available item count for each item', async () => {
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Verify quantity is displayed for each item
      const quantityElements = screen.getAllByText(/^\d+$/);
      expect(quantityElements).toHaveLength(2);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  // TC-002: Create new items functionality
  describe('TC-002: Create New Items', () => {
    it('should open create modal when clicking add button', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await user.click(addButton);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText(/create new item/i)).toBeInTheDocument();
    });

    it('should create new item with all required fields', async () => {
      const user = userEvent.setup();
      
      // Mock successful create response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { id: 3, name: 'New Item', description: 'New Description' }
        })
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Open create modal
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await user.click(addButton);
      
      // Fill form fields
      const nameInput = screen.getByLabelText(/item name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const categorySelect = screen.getByLabelText(/category/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      
      await user.type(nameInput, 'New Test Item');
      await user.type(descriptionInput, 'This is a new test item description');
      await user.selectOptions(categorySelect, 'Electronics');
      await user.clear(quantityInput);
      await user.type(quantityInput, '5');
      
      // Submit form
      const saveButton = screen.getByRole('button', { name: /save item/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/items', expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Bearer /)
          }),
          body: expect.stringContaining('New Test Item')
        }));
      });
      
      expect(mockUseNotification.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
        'success'
      );
    });
  });

  // TC-004: Edit existing items functionality 
  describe('TC-004: Edit Existing Items', () => {
    it('should open edit modal when clicking edit button', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByLabelText(/edit item/i);
      await user.click(editButtons[0]);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
    });

    it('should update item details successfully', async () => {
      const user = userEvent.setup();
      
      // Mock successful update response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { id: 1, name: 'Updated Item', description: 'Updated Description' }
        })
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Open edit modal
      const editButtons = screen.getAllByLabelText(/edit item/i);
      await user.click(editButtons[0]);
      
      // Update item name
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Item');
      
      // Submit form
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/items/1', expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('Updated Test Item')
        }));
      });
    });
  });

  // TC-005: Delete items with confirmation
  describe('TC-005: Delete Items', () => {
    it('should show confirmation dialog when clicking delete button', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByLabelText(/delete item/i);
      await user.click(deleteButtons[0]);
      
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    it('should delete item when confirmed', async () => {
      const user = userEvent.setup();
      
      // Mock successful delete response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/delete item/i);
      await user.click(deleteButtons[0]);
      
      // Confirm deletion
      const confirmButton = screen.getByTestId('confirm-yes');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/items/1', expect.objectContaining({
          method: 'DELETE'
        }));
      });
      
      expect(mockUseNotification.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('deleted successfully'),
        'success'
      );
    });
  });

  // TC-007: Search and filter functionality
  describe('TC-007: Search and Filter Functionality', () => {
    it('should filter items by search query', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/search items/i);
      await user.type(searchInput, 'Test Item 1');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=Test%20Item%201'),
          expect.any(Object)
        );
      });
    });

    it('should filter items by status', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(statusFilter, 'active');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=active'),
          expect.any(Object)
        );
      });
    });

    it('should filter items by category', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'Electronics');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('category=Electronics'),
          expect.any(Object)
        );
      });
    });
  });

  // TC-008: Error handling and success feedback
  describe('TC-008: Error Handling and Success Feedback', () => {
    it('should show error message when API call fails', async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'));
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.getByText(/error loading items/i)).toBeInTheDocument();
      });
    });

    it('should show success notification on successful operations', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { id: 3, name: 'New Item' }
        })
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Trigger a successful operation (create item)
      const addButton = screen.getByRole('button', { name: /add new item/i });
      await user.click(addButton);
      
      // Fill minimum required fields
      const nameInput = screen.getByLabelText(/item name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Item');
      await user.type(descriptionInput, 'Test Description');
      
      const saveButton = screen.getByRole('button', { name: /save item/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockUseNotification.showNotification).toHaveBeenCalledWith(
          expect.stringContaining('successfully'),
          'success'
        );
      });
    });
  });

  // TC-010: Admin authentication check
  describe('TC-010: Admin Authentication', () => {
    it('should not render for non-admin users', () => {
      authHooks.useAuth.mockReturnValue({
        user: { id: 1, name: 'Regular User', role: 'user' },
        isAdmin: false
      });
      
      renderAdminItemManagement();
      
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.queryByText(/item management/i)).not.toBeInTheDocument();
    });

    it('should render normally for admin users', async () => {
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      expect(screen.getByText(/item management/i)).toBeInTheDocument();
    });
  });

  // TC-011: Bulk operations functionality
  describe('TC-011: Bulk Operations', () => {
    it('should allow selecting multiple items', async () => {
      const user = userEvent.setup();
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select first two items (skip header checkbox)
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      
      // Bulk actions should be visible
      expect(screen.getByText(/bulk actions/i)).toBeInTheDocument();
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it('should perform bulk delete operation', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select items
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      
      // Click bulk delete
      const bulkDeleteButton = screen.getByRole('button', { name: /bulk delete/i });
      await user.click(bulkDeleteButton);
      
      // Confirm bulk delete
      const confirmButton = screen.getByTestId('confirm-yes');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/items/bulk-delete', expect.objectContaining({
          method: 'DELETE',
          body: expect.stringContaining('"ids":[1,2]')
        }));
      });
    });
  });

  // TC-009: Responsive design
  describe('TC-009: Responsive Design', () => {
    it('should adapt layout for tablet/desktop screens', async () => {
      // Mock window.matchMedia for responsive tests
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('768px'), // Simulate tablet size
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      renderAdminItemManagement();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
      
      // Check that desktop/tablet layout elements are present
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(7); // Expected number of columns
    });
  });
});