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
  });

  // TC-009: Responsive design
  describe('TC-009: Responsive Design', () => {
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
  });

  // TC-010: Audit trail logging
  describe('TC-010: Audit Trail Logging', () => {
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
  });
});