import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { itemsAPI } from '../../../services/api';

// Mock API service
jest.mock('../../../services/api', () => ({
  itemsAPI: {
    getItems: jest.fn(),
    createItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn()
  }
}));

// Mock theme context
const mockTheme = {
  theme: 'light',
  isDark: false
};

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
  ThemeProvider: ({ children }) => <div>{children}</div>
}));

const mockItems = [
  {
    id: 1,
    name: 'Test Item 1',
    description: 'Test description 1',
    price: 29.99,
    category: 'Electronics',
    availableCount: 15,
    imageUrl: 'test-image-1.jpg'
  },
  {
    id: 2,
    name: 'Test Item 2', 
    description: 'Test description 2',
    price: 49.99,
    category: 'Clothing',
    availableCount: 8,
    imageUrl: 'test-image-2.jpg'
  }
];

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AdminDashboard />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('AdminDashboard - Item Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    itemsAPI.getItems.mockResolvedValue({
      data: {
        items: mockItems,
        total: mockItems.length,
        totalPages: 1
      }
    });
  });

  // TC-001: Dashboard displays a list of all items with pagination
  it('TC-001: should display items list with pagination', async () => {
    itemsAPI.getItems.mockResolvedValue({
      data: {
        items: Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
          description: `Description ${i + 1}`,
          price: 29.99,
          category: 'Electronics',
          availableCount: 10
        })),
        total: 15,
        totalPages: 2
      }
    });

    renderComponent();
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    // Check pagination controls are present
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();

    // Verify API called with correct pagination params
    expect(itemsAPI.getItems).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: '',
      category: 'all'
    });
  });

  // TC-002: Create new item functionality with form validation
  it('TC-002: should open create item form and validate required fields', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    // Click add item button
    const addButton = screen.getByRole('button', { name: /add.*item/i });
    fireEvent.click(addButton);

    // Check form is displayed
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/available count/i)).toBeInTheDocument();
    });

    // Try to submit empty form
    const submitButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(submitButton);

    // Check validation errors appear
    await waitFor(() => {
      expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });

  // TC-003: Edit existing item functionality with pre-populated data
  it('TC-003: should open edit form with pre-populated data', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Click edit button for first item
    const editButtons = screen.getAllByLabelText(/edit.*item/i);
    fireEvent.click(editButtons[0]);

    // Check form is pre-populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('29.99')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    });
  });

  // TC-004: Delete item functionality with confirmation dialog
  it('TC-004: should show confirmation dialog before deleting item', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByLabelText(/delete.*item/i);
    fireEvent.click(deleteButtons[0]);

    // Check confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure.*delete.*test item 1/i)).toBeInTheDocument();
    });

    // Confirm delete
    itemsAPI.deleteItem.mockResolvedValue({ success: true });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(itemsAPI.deleteItem).toHaveBeenCalledWith(1);
    });
  });

  // TC-007: Available item count is displayed for each item
  it('TC-007: should display available count for each item', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Available: 15')).toBeInTheDocument();
      expect(screen.getByText('Available: 8')).toBeInTheDocument();
    });
  });

  // TC-008: Item count updates in real-time when items are modified
  it('TC-008: should update item count after successful edit', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Available: 15')).toBeInTheDocument();
    });

    // Edit item to change count
    const editButtons = screen.getAllByLabelText(/edit.*item/i);
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      const countInput = screen.getByDisplayValue('15');
      fireEvent.change(countInput, { target: { value: '20' } });
    });

    // Mock successful update
    itemsAPI.updateItem.mockResolvedValue({
      data: {
        ...mockItems[0],
        availableCount: 20
      }
    });

    const saveButton = screen.getByRole('button', { name: /save.*changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(itemsAPI.updateItem).toHaveBeenCalledWith(1, expect.objectContaining({
        availableCount: '20'
      }));
    });
  });

  // TC-009: Search and filter functionality for items
  it('TC-009: should filter items based on search and category', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Test search functionality
    const searchInput = screen.getByPlaceholderText(/search items/i);
    await user.type(searchInput, 'Electronics');

    await waitFor(() => {
      expect(itemsAPI.getItems).toHaveBeenCalledWith(expect.objectContaining({
        search: 'Electronics'
      }));
    });

    // Test category filter
    const categorySelect = screen.getByLabelText(/category/i);
    await user.selectOptions(categorySelect, 'Electronics');

    await waitFor(() => {
      expect(itemsAPI.getItems).toHaveBeenCalledWith(expect.objectContaining({
        category: 'Electronics'
      }));
    });
  });

  // TC-011: Success/error notifications for all CRUD operations
  it('TC-011: should show success notification after creating item', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Open create form
    const addButton = screen.getByRole('button', { name: /add.*item/i });
    fireEvent.click(addButton);

    // Fill form
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/item name/i);
      const descInput = screen.getByLabelText(/description/i);
      const priceInput = screen.getByLabelText(/price/i);
      const countInput = screen.getByLabelText(/available count/i);
      
      fireEvent.change(nameInput, { target: { value: 'New Test Item' } });
      fireEvent.change(descInput, { target: { value: 'New test description' } });
      fireEvent.change(priceInput, { target: { value: '39.99' } });
      fireEvent.change(countInput, { target: { value: '10' } });
    });

    // Mock successful creation
    itemsAPI.createItem.mockResolvedValue({
      data: {
        id: 3,
        name: 'New Test Item',
        description: 'New test description',
        price: 39.99,
        availableCount: 10
      }
    });

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/item created successfully/i)).toBeInTheDocument();
    });
  });

  // TC-012: Form validation prevents submission of incomplete data
  it('TC-012: should prevent form submission with invalid data', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });

    // Open create form
    const addButton = screen.getByRole('button', { name: /add.*item/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      // Fill form with invalid data
      const nameInput = screen.getByLabelText(/item name/i);
      const priceInput = screen.getByLabelText(/price/i);
      const countInput = screen.getByLabelText(/available count/i);
      
      fireEvent.change(nameInput, { target: { value: 'A' } }); // Too short
      fireEvent.change(priceInput, { target: { value: '-5' } }); // Negative price
      fireEvent.change(countInput, { target: { value: '-1' } }); // Negative count
    });

    const createButton = screen.getByRole('button', { name: /create item/i });
    fireEvent.click(createButton);

    // Should show validation errors without API call
    await waitFor(() => {
      expect(screen.getByText(/must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument();
      expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument();
    });

    expect(itemsAPI.createItem).not.toHaveBeenCalled();
  });

  // TC-010: Responsive design test (basic viewport change)
  it('TC-010: should be responsive on different screen sizes', () => {
    // Test mobile viewport
    global.innerWidth = 768;
    global.innerHeight = 1024;
    global.dispatchEvent(new Event('resize'));
    
    renderComponent();
    
    // Component should render without errors on mobile
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });
});