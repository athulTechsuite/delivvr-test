import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';

// Mock the API service
jest.mock('../../../services/api', () => ({
  getItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  searchItems: jest.fn(),
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const mockApi = require('../../../services/api');

const mockItems = [
  { id: 1, name: 'Item 1', description: 'Description 1', status: 'active' },
  { id: 2, name: 'Item 2', description: 'Description 2', status: 'inactive' },
  { id: 3, name: 'Item 3', description: 'Description 3', status: 'active' },
];

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful API responses by default
    mockApi.getItems.mockResolvedValue({
      data: mockItems,
      total: 50,
      page: 1,
      totalPages: 5
    });
    mockApi.createItem.mockResolvedValue({ id: 4, name: 'New Item', description: 'New Description' });
    mockApi.updateItem.mockResolvedValue({ id: 1, name: 'Updated Item', description: 'Updated Description' });
    mockApi.deleteItem.mockResolvedValue({ success: true });
    mockApi.searchItems.mockResolvedValue({ data: mockItems.slice(0, 1) });

    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  // TC-001: Dashboard displays paginated item list
  describe('TC-001: Paginated item list display', () => {
    test('displays items in paginated list format', async () => {
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getByText('Item 3')).toBeInTheDocument();
      });

      expect(mockApi.getItems).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    test('handles pagination navigation', async () => {
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const nextPageButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextPageButton);

      await waitFor(() => {
        expect(mockApi.getItems).toHaveBeenCalledWith({ page: 2, limit: 10 });
      });
    });

    test('displays correct pagination info', async () => {
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
        expect(screen.getByText(/50 total items/i)).toBeInTheDocument();
      });
    });
  });

  // TC-002: Create item with validation
  describe('TC-002: Create item with validation', () => {
    test('opens create modal and creates new item with valid data', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create new item/i)).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const submitButton = screen.getByRole('button', { name: /create/i });

      await user.type(nameInput, 'New Test Item');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApi.createItem).toHaveBeenCalledWith({
          name: 'New Test Item',
          description: 'Test Description'
        });
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('validates required fields before submission', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(mockApi.createItem).not.toHaveBeenCalled();
    });
  });

  // TC-003: Edit item with pre-populated data
  describe('TC-003: Edit item with pre-populated data', () => {
    test('opens edit modal with pre-populated data', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await user.click(editButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Description 1')).toBeInTheDocument();
    });

    test('updates item with modified data', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await user.click(editButton);

      const nameInput = screen.getByDisplayValue('Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Item Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockApi.updateItem).toHaveBeenCalledWith(1, {
          name: 'Updated Item Name',
          description: 'Description 1',
          status: 'active'
        });
      });
    });
  });

  // TC-004: Delete item with confirmation
  describe('TC-004: Delete item with confirmation', () => {
    test('shows confirmation dialog before deleting', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    test('deletes item after confirmation', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApi.deleteItem).toHaveBeenCalledWith(1);
      });
    });

    test('cancels deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockApi.deleteItem).not.toHaveBeenCalled();
      expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument();
    });
  });

  // TC-006: Search and filter functionality
  describe('TC-006: Search and filter functionality', () => {
    test('performs search when search input is used', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const searchInput = screen.getByPlaceholderText(/search items/i);
      await user.type(searchInput, 'test search');

      await waitFor(() => {
        expect(mockApi.searchItems).toHaveBeenCalledWith('test search', {});
      }, { timeout: 1000 });
    });

    test('applies status filter', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(filterSelect, 'active');

      await waitFor(() => {
        expect(mockApi.getItems).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
          status: 'active'
        });
      });
    });

    test('combines search and filter', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const searchInput = screen.getByPlaceholderText(/search items/i);
      const filterSelect = screen.getByLabelText(/filter by status/i);

      await user.type(searchInput, 'test');
      await user.selectOptions(filterSelect, 'active');

      await waitFor(() => {
        expect(mockApi.searchItems).toHaveBeenCalledWith('test', { status: 'active' });
      });
    });
  });

  // TC-007: Form validation prevents invalid submission
  describe('TC-007: Form validation prevents invalid submission', () => {
    test('prevents submission with empty required fields', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(mockApi.createItem).not.toHaveBeenCalled();
    });

    test('validates field length constraints', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'a'.repeat(101)); // Assuming max length is 100

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      expect(screen.getByText(/name must be less than 100 characters/i)).toBeInTheDocument();
      expect(mockApi.createItem).not.toHaveBeenCalled();
    });

    test('shows real-time validation errors', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'valid name');
      await user.clear(nameInput);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  // TC-008: Real-time count updates
  describe('TC-008: Real-time count updates', () => {
    test('updates item count after creating new item', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/50 total items/i)).toBeInTheDocument();
      });

      // Mock updated response after creation
      mockApi.getItems.mockResolvedValueOnce({
        data: [...mockItems, { id: 4, name: 'New Item', description: 'New Description' }],
        total: 51,
        page: 1,
        totalPages: 6
      });

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'New Test Item');
      await user.type(descriptionInput, 'Test Description');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/51 total items/i)).toBeInTheDocument();
      });
    });

    test('updates item count after deleting item', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/50 total items/i)).toBeInTheDocument();
      });

      // Mock updated response after deletion
      mockApi.getItems.mockResolvedValueOnce({
        data: mockItems.slice(1),
        total: 49,
        page: 1,
        totalPages: 5
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/49 total items/i)).toBeInTheDocument();
      });
    });
  });

  // TC-009: Responsive design functionality
  describe('TC-009: Responsive design functionality', () => {
    test('adapts layout for mobile screens', () => {
      // Mock mobile screen
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderWithRouter(<AdminDashboard />);

      const container = screen.getByTestId('dashboard-container');
      expect(container).toHaveClass('mobile-layout');
    });

    test('shows desktop layout for large screens', () => {
      // Mock desktop screen
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderWithRouter(<AdminDashboard />);

      const container = screen.getByTestId('dashboard-container');
      expect(container).toHaveClass('desktop-layout');
    });

    test('adjusts table display on smaller screens', () => {
      // Mock tablet screen
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 1024px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderWithRouter(<AdminDashboard />);

      const itemsList = screen.getByTestId('items-list');
      expect(itemsList).toHaveClass('responsive-table');
    });
  });

  // TC-010: Success/error notifications
  describe('TC-010: Success/error notifications', () => {
    test('shows success notification after creating item', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'New Test Item');
      await user.type(descriptionInput, 'Test Description');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
      });

      // Notification should auto-dismiss
      await waitFor(() => {
        expect(screen.queryByText(/item created successfully/i)).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    test('shows error notification when API call fails', async () => {
      const user = userEvent.setup();
      mockApi.createItem.mockRejectedValueOnce(new Error('API Error'));
      
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'New Test Item');
      await user.type(descriptionInput, 'Test Description');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create item/i)).toBeInTheDocument();
      });
    });

    test('shows success notification after updating item', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await user.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/item updated successfully/i)).toBeInTheDocument();
      });
    });

    test('shows success notification after deleting item', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/item deleted successfully/i)).toBeInTheDocument();
      });
    });

    test('allows manual dismissal of notifications', async () => {
      const user = userEvent.setup();
      renderWithRouter(<AdminDashboard />);

      const createButton = screen.getByRole('button', { name: /create new item/i });
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'New Test Item');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(screen.queryByText(/item created successfully/i)).not.toBeInTheDocument();
    });
  });
});