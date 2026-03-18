import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import AdminDashboard from '../AdminDashboard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { NotificationProvider } from '../../../contexts/NotificationContext';

// Mock the hooks
jest.mock('../../../hooks/useProducts');
jest.mock('../../../services/imageUploadService');

const mockItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test description 1',
    category: 'electronics',
    price: 99.99,
    status: 'active',
    imageUrl: 'test1.jpg'
  },
  {
    id: 2,
    name: 'Test Item 2',
    description: 'Test description 2',
    category: 'clothing',
    price: 49.99,
    status: 'inactive',
    imageUrl: 'test2.jpg'
  }
];

const MockWrapper = ({ children }) => (
  <NotificationProvider>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </NotificationProvider>
);

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  // TC-001: Dashboard displays paginated item list
  test('TC-001: should display paginated item list with navigation controls', async () => {
    // Mock response with pagination data
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          products: mockItems,
          pagination: {
            currentPage: 1,
            totalPages: 3,
            totalItems: 45,
            itemsPerPage: 20
          }
        }
      })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    });

    // Verify pagination controls are displayed
    expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('45 items total')).toBeInTheDocument();

    // Test pagination navigation
    const nextButton = screen.getByLabelText(/next page/i);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });
  });

  // TC-002: Search functionality filters items correctly
  test('TC-002: should filter items by name, category, and status', async () => {
    // Initial load
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { products: mockItems, pagination: { currentPage: 1, totalPages: 1, totalItems: 2 } }
      })
    });

    // Search result
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { 
          products: [mockItems[0]], 
          pagination: { currentPage: 1, totalPages: 1, totalItems: 1 }
        }
      })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Test search by name
    const searchInput = screen.getByPlaceholderText(/search items/i);
    fireEvent.change(searchInput, { target: { value: 'Test Item 1' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=Test%20Item%201'),
        expect.any(Object)
      );
    });

    // Test category filter
    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: 'electronics' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('category=electronics'),
        expect.any(Object)
      );
    });

    // Test status filter
    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('status=active'),
        expect.any(Object)
      );
    });

    // Test clear search
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(categorySelect).toHaveValue('');
      expect(statusSelect).toHaveValue('');
    });
  });

  // TC-003: Create item form validation
  test('TC-003: should validate create item form fields', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { products: [], pagination: {} } })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
      expect(screen.getByText(/upload image/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save item/i });

    // Test validation with empty form
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
      expect(screen.getByText(/price is required/i)).toBeInTheDocument();
    });

    // Test price validation
    const priceInput = screen.getByLabelText(/price/i);
    fireEvent.change(priceInput, { target: { value: 'invalid' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/price must be a valid number/i)).toBeInTheDocument();
    });

    fireEvent.change(priceInput, { target: { value: '-10' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/price must be greater than 0/i)).toBeInTheDocument();
    });

    // Test name length validation
    const nameInput = screen.getByLabelText(/item name/i);
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/name must be less than 100 characters/i)).toBeInTheDocument();
    });

    // Test successful validation
    fireEvent.change(nameInput, { target: { value: 'Valid Item Name' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Valid description' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'electronics' } });
    fireEvent.change(priceInput, { target: { value: '99.99' } });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Item created successfully' })
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText(/is required/i)).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });
  });

  // TC-004: Image upload size limit enforcement
  test('TC-004: should enforce image upload size limits', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { products: [], pagination: {} } })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/upload image/i)).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('image-upload-input');

    // Test file size limit (assuming 5MB limit)
    const oversizedFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large-image.jpg', {
      type: 'image/jpeg'
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/file size must be less than 5MB/i)).toBeInTheDocument();
    });

    // Test invalid file type
    const invalidFile = new File(['test'], 'document.pdf', {
      type: 'application/pdf'
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
    });

    // Test valid file
    const validFile = new File(['image-content'], 'valid-image.jpg', {
      type: 'image/jpeg'
    });

    // Mock URL.createObjectURL for image preview
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.queryByText(/file size must be less than 5MB/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/only image files are allowed/i)).not.toBeInTheDocument();
      expect(screen.getByAltText(/image preview/i)).toBeInTheDocument();
    });

    // Test remove uploaded image
    const removeButton = screen.getByRole('button', { name: /remove image/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByAltText(/image preview/i)).not.toBeInTheDocument();
    });

    // Cleanup
    global.URL.createObjectURL.mockRestore();
  });

  // TC-001: Dashboard displays a list of all items with pagination (20 items per page)
  test('TC-001: should display list of items with pagination controls', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          products: mockItems,
          pagination: {
            currentPage: 1,
            totalPages: 3,
            totalItems: 45,
            itemsPerPage: 20
          }
        }
      })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    });

    // Check pagination controls
    expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  // TC-002: Search functionality allows filtering by item name, category, and status
  test('TC-002: should filter items by search criteria', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { products: [mockItems[0]], pagination: { currentPage: 1, totalPages: 1, totalItems: 1 } }
      })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/search items/i);
    const categorySelect = screen.getByLabelText(/category/i);
    const statusSelect = screen.getByLabelText(/status/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    fireEvent.change(searchInput, { target: { value: 'electronics' } });
    fireEvent.change(categorySelect, { target: { value: 'electronics' } });
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=electronics'),
        expect.any(Object)
      );
    });
  });

  // TC-003: Create new item form with fields for name, description, category, price, and image upload
  test('TC-003: should open create item form with required fields', async () => {
    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
      expect(screen.getByText(/upload image/i)).toBeInTheDocument();
    });
  });

  // TC-004: Edit existing items with pre-populated form data
  test('TC-004: should pre-populate edit form with existing item data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { products: mockItems, pagination: {} } })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByLabelText(/edit item/i);
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('99.99')).toBeInTheDocument();
    });
  });

  // TC-005: Delete items with confirmation dialog
  test('TC-005: should show confirmation dialog before deleting item', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { products: mockItems, pagination: {} } })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText(/delete item/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  // TC-008: Success/error notifications for all CRUD operations
  test('TC-008: should show success notification after creating item', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { products: [], pagination: {} } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, message: 'Item created successfully' }) });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'New Item' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New description' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'electronics' } });
      fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '199.99' } });
    });

    const saveButton = screen.getByRole('button', { name: /save item/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
    });
  });

  // TC-010: Loading states during API calls
  test('TC-010: should show loading state during API operations', async () => {
    // Create a promise that resolves after a delay
    let resolvePromise;
    const promise = new Promise(resolve => { resolvePromise = resolve; });
    
    global.fetch.mockReturnValueOnce(promise);

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise({
      ok: true,
      json: async () => ({ success: true, data: { products: [], pagination: {} } })
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  // TC-011: Bulk actions for deleting multiple items
  test('TC-011: should allow bulk deletion of selected items', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { products: mockItems, pagination: {} } })
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Select multiple items
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First item
    fireEvent.click(checkboxes[2]); // Second item

    const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
    expect(bulkDeleteButton).toBeEnabled();
    fireEvent.click(bulkDeleteButton);

    await waitFor(() => {
      expect(screen.getByText(/delete selected items/i)).toBeInTheDocument();
    });
  });

  // TC-009: Responsive design works on desktop and tablet devices
  test('TC-009: should adapt to different screen sizes', () => {
    // Mock window.matchMedia for responsive testing
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('768'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });

    render(
      <MockWrapper>
        <AdminDashboard />
      </MockWrapper>
    );

    // Check that responsive classes are applied
    const dashboard = screen.getByTestId('admin-dashboard');
    expect(dashboard).toHaveClass('responsive-layout');
  });
});