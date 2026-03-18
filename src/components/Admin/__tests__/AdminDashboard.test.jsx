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

const mockPage2Data = {
  items: [
    {
      id: 3,
      name: 'Test Item 3',
      description: 'Test description 3',
      price: 19.99,
      category: 'books',
      status: 'active',
      imageUrl: 'test-image-3.jpg',
      createdAt: '2024-01-03T00:00:00Z'
    }
  ],
  pagination: {
    currentPage: 2,
    totalPages: 3,
    totalItems: 25,
    itemsPerPage: 10,
    hasNextPage: true,
    hasPrevPage: true
  }
};

// Mock drag and drop events
const createDragEvent = (type, dataTransfer) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer
  });
  return event;
};

const mockFile = new File(['test content'], 'test-image.jpg', { type: 'image/jpeg' });

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

  // TC-001: Dashboard displays item list with key details (ENHANCED)
  describe('TC-001: Dashboard displays item list with key details', () => {
    test('should display complete item list with all key details', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
        expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      });
      
      // Verify all key details are displayed
      expect(screen.getByText('Test description 1')).toBeInTheDocument();
      expect(screen.getByText('Test description 2')).toBeInTheDocument();
      expect(screen.getByText('$29.99')).toBeInTheDocument();
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('electronics')).toBeInTheDocument();
      expect(screen.getByText('clothing')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    test('should display item images with proper alt text', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        const image1 = screen.getByAltText('Test Item 1');
        const image2 = screen.getByAltText('Test Item 2');
        
        expect(image1).toBeInTheDocument();
        expect(image1).toHaveAttribute('src', expect.stringContaining('test-image-1.jpg'));
        expect(image2).toBeInTheDocument();
        expect(image2).toHaveAttribute('src', expect.stringContaining('test-image-2.jpg'));
      });
    });

    test('should display formatted creation dates', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 2, 2024/)).toBeInTheDocument();
      });
    });

    test('should display status badges with appropriate styling', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        const activeStatus = screen.getByText('active');
        const inactiveStatus = screen.getByText('inactive');
        
        expect(activeStatus).toHaveClass('status-active');
        expect(inactiveStatus).toHaveClass('status-inactive');
      });
    });

    test('should display pagination controls with correct state', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByText('25 total items')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to next page')).toBeEnabled();
        expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
      });
    });

    test('should handle empty item list gracefully', async () => {
      itemsAPI.getItems.mockResolvedValue({
        success: true,
        data: {
          items: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: 10,
            hasNextPage: false,
            hasPrevPage: false
          }
        }
      });

      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/No items found/)).toBeInTheDocument();
        expect(screen.getByText(/0 total items/)).toBeInTheDocument();
      });
    });
  });

  // TC-002: Upload functionality with drag-and-drop
  describe('TC-002: Upload functionality with drag-and-drop', () => {
    test('should handle drag-and-drop file upload', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      expect(dropZone).toBeInTheDocument();
      
      // Simulate drag enter
      const dragEnterEvent = createDragEvent('dragenter', {
        files: [mockFile]
      });
      fireEvent(dropZone, dragEnterEvent);
      
      expect(dropZone).toHaveClass('drag-active');
      
      // Simulate drop
      const dropEvent = createDragEvent('drop', {
        files: [mockFile]
      });
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
      });
    });

    test('should show drag-over styling during drag operation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      
      // Simulate drag over
      const dragOverEvent = createDragEvent('dragover', {
        files: [mockFile]
      });
      fireEvent(dropZone, dragOverEvent);
      
      expect(dropZone).toHaveClass('drag-over');
    });

    test('should validate file type during drag-and-drop', async () => {
      const user = userEvent.setup();
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      
      const dropEvent = createDragEvent('drop', {
        files: [invalidFile]
      });
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
      });
    });

    test('should validate file size during drag-and-drop', async () => {
      const user = userEvent.setup();
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large-image.jpg', { type: 'image/jpeg' });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      
      const dropEvent = createDragEvent('drop', {
        files: [largeFile]
      });
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText(/file size must be less than 5mb/i)).toBeInTheDocument();
      });
    });

    test('should handle multiple files with validation', async () => {
      const user = userEvent.setup();
      const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['test2'], 'test2.txt', { type: 'text/plain' });
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      
      const dropEvent = createDragEvent('drop', {
        files: [file1, file2]
      });
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText('test1.jpg')).toBeInTheDocument();
        expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
      });
    });

    test('should show upload progress indicator', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dropZone = screen.getByTestId('file-drop-zone');
      
      const dropEvent = createDragEvent('drop', {
        files: [mockFile]
      });
      fireEvent(dropZone, dropEvent);
      
      // Should show progress indicator briefly
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  // TC-003: Edit functionality through form interface
  describe('TC-003: Edit functionality through form interface', () => {
    test('should open edit form with pre-populated data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit Item')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('29.99')).toBeInTheDocument();
      
      const categorySelect = screen.getByDisplayValue('electronics');
      expect(categorySelect).toBeInTheDocument();
    });

    test('should validate form fields during edit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Item name is required')).toBeInTheDocument();
      });
    });

    test('should update item successfully through form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Item');
      
      const priceInput = screen.getByDisplayValue('29.99');
      await user.clear(priceInput);
      await user.type(priceInput, '39.99');
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(itemsAPI.updateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: 'Updated Test Item',
            price: 39.99
          })
        );
      });
      
      expect(toast.success).toHaveBeenCalledWith('Item updated successfully');
    });

    test('should handle form validation for price field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const priceInput = screen.getByDisplayValue('29.99');
      await user.clear(priceInput);
      await user.type(priceInput, '-10');
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Price must be greater than 0')).toBeInTheDocument();
      });
    });

    test('should close edit form when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    test('should handle edit form with image upload', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const imageInput = screen.getByLabelText(/upload image/i);
      await user.upload(imageInput, mockFile);
      
      await waitFor(() => {
        expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
      });
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(itemsAPI.updateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            image: expect.any(File)
          })
        );
      });
    });
  });

  // TC-004: Delete with confirmation dialog
  describe('TC-004: Delete with confirmation dialog', () => {
    test('should show confirmation dialog with item details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Confirm Delete')).toBeInTheDocument();
      expect(within(dialog).getByText(/are you sure you want to delete "Test Item 1"/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/this action cannot be undone/i)).toBeInTheDocument();
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

    test('should cancel deletion and close dialog', async () => {
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
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should handle bulk delete with confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First item
      await user.click(checkboxes[2]); // Second item
      
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(bulkDeleteButton);
      
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/delete 2 items/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(itemsAPI.deleteItem).toHaveBeenCalledWith(1);
        expect(itemsAPI.deleteItem).toHaveBeenCalledWith(2);
      });
    });

    test('should show delete confirmation with warning for active items', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/this item is currently active/i)).toBeInTheDocument();
    });

    test('should handle delete error gracefully', async () => {
      const user = userEvent.setup();
      itemsAPI.deleteItem.mockRejectedValueOnce(new Error('Delete failed'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete item');
      });
    });
  });

  // TC-005: Success/error message display
  describe('TC-005: Success/error message display', () => {
    test('should display success message after item creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      await user.type(screen.getByLabelText(/item name/i), 'New Test Item');
      await user.type(screen.getByLabelText(/description/i), 'New test description');
      await user.type(screen.getByLabelText(/price/i), '39.99');
      await user.selectOptions(screen.getByLabelText(/category/i), 'electronics');
      
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Item created successfully');
      });
    });

    test('should display error message when creation fails', async () => {
      const user = userEvent.setup();
      itemsAPI.createItem.mockRejectedValueOnce(new Error('Creation failed'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
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

    test('should display success message after item update', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Item');
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Item updated successfully');
      });
    });

    test('should display error message when update fails', async () => {
      const user = userEvent.setup();
      itemsAPI.updateItem.mockRejectedValueOnce(new Error('Update failed'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByLabelText('Edit item')[0];
      await user.click(editButton);
      
      const nameInput = screen.getByDisplayValue('Test Item 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Item');
      
      const submitButton = screen.getByRole('button', { name: /update item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update item');
      });
    });

    test('should display network error message', async () => {
      itemsAPI.getItems.mockRejectedValueOnce(new Error('Network Error'));
      
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    test('should display validation error messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Item name is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('Price is required')).toBeInTheDocument();
      });
    });
  });

  // TC-006: Accessibility compliance
  describe('TC-006: Accessibility compliance', () => {
    test('should have proper ARIA labels for buttons', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
      expect(screen.getAllByLabelText('Edit item')[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText('Delete item')[0]).toBeInTheDocument();
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    });

    test('should have proper form labels and fieldsets', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      addButton.focus();
      expect(document.activeElement).toBe(addButton);
      
      // Test tab navigation
      fireEvent.keyDown(addButton, { key: 'Tab' });
      expect(document.activeElement).not.toBe(addButton);
    });

    test('should have proper heading hierarchy', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/admin dashboard/i);
      });
    });

    test('should provide focus management in modals', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      // First focusable element should be focused
      const nameInput = screen.getByLabelText(/item name/i);
      expect(document.activeElement).toBe(nameInput);
    });

    test('should have proper color contrast and visual indicators', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const activeStatus = screen.getByText('active');
      expect(activeStatus).toHaveClass('status-active');
      expect(getComputedStyle(activeStatus).color).not.toBe('rgb(0, 0, 0)'); // Not default black
    });

    test('should provide screen reader accessible content', async () => {
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      // Check for proper table structure
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
      
      columnHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });

    test('should handle focus trap in confirmation dialogs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByLabelText('Delete item')[0];
      await user.click(deleteButton);
      
      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
      const confirmButton = within(dialog).getByRole('button', { name: /delete/i });
      
      // Focus should be trapped within dialog
      cancelButton.focus();
      expect(document.activeElement).toBe(cancelButton);
      
      // Tab to next element
      fireEvent.keyDown(cancelButton, { key: 'Tab' });
      expect(document.activeElement).toBe(confirmButton);
    });

    test('should provide proper error announcements', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const addButton = screen.getByRole('button', { name: /add item/i });
      await user.click(addButton);
      
      const submitButton = screen.getByRole('button', { name: /create item/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorMessage = screen.getByText('Item name is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });

  // Additional existing tests continue below...
  describe('TC-001: Admin can view paginated list of items', () => {
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
      
      // Mock page 2 response
      itemsAPI.getItems.mockImplementation((params) => {
        if (params?.page === 2) {
          return Promise.resolve({
            success: true,
            data: mockPage2Data
          });
        }
        return Promise.resolve({
          success: true,
          data: mockPaginationData
        });
      });

      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const nextButton = screen.getByLabelText('Go to next page');
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(itemsAPI.getItems).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            limit: 10
          })
        );
      });
    });

    test('should handle pagination when no items exist', async () => {
      itemsAPI.getItems.mockResolvedValue({
        success: true,
        data: {
          items: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: 10,
            hasNextPage: false,
            hasPrevPage: false
          }
        }
      });

      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/No items found/)).toBeInTheDocument();
      });

      expect(screen.getByText(/0 total items/)).toBeInTheDocument();
    });

    test('should display items per page selector', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      });
      
      const itemsPerPageSelect = screen.getByLabelText(/items per page/i);
      await user.selectOptions(itemsPerPageSelect, '25');
      
      await waitFor(() => {
        expect(itemsAPI.getItems).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            limit: 25
          })
        );
      });
    });
  });
});