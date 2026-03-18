import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import ItemForm from '../ItemForm';
import * as imageService from '../../../services/imageUploadService';

// Mock image service
jest.mock('../../../services/imageUploadService');

const mockCategories = ['electronics', 'clothing', 'books', 'home'];

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const defaultProps = {
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  categories: mockCategories
};

describe('ItemForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    imageService.validateImageFile.mockReturnValue({ isValid: true, error: null });
  });

  // TC-007: Form validation prevents submission with missing required fields
  test('TC-007: should prevent form submission with missing required fields', async () => {
    render(<ItemForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /save item/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
      expect(screen.getByText(/price must be greater than 0/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // TC-007: Form validation - valid form submission
  test('TC-007: should submit form with valid data', async () => {
    render(<ItemForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Test Item' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'electronics' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '99.99' } });

    const submitButton = screen.getByRole('button', { name: /save item/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Item',
        description: 'Test description',
        category: 'electronics',
        price: '99.99',
        status: 'active',
        image: null
      });
    });
  });

  // TC-006: Image upload validation enforces 200kb size limit
  test('TC-006: should validate image file size limit', async () => {
    const oversizedFile = new File([''], 'large-image.jpg', {
      type: 'image/jpeg',
      size: 300 * 1024 // 300KB - over the limit
    });

    imageService.validateImageFile.mockReturnValue({
      isValid: false,
      error: 'File size must be less than 200KB. Current size: 300KB'
    });

    render(<ItemForm {...defaultProps} />);

    const fileInput = screen.getByLabelText(/upload image/i);
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/file size must be less than 200kb/i)).toBeInTheDocument();
    });

    expect(imageService.validateImageFile).toHaveBeenCalledWith(oversizedFile);
  });

  // TC-006: Image upload validation - valid file types
  test('TC-006: should accept valid image file types', async () => {
    const validFile = new File([''], 'test-image.jpg', {
      type: 'image/jpeg',
      size: 100 * 1024 // 100KB - within limit
    });

    imageService.validateImageFile.mockReturnValue({ isValid: true, error: null });

    render(<ItemForm {...defaultProps} />);

    const fileInput = screen.getByLabelText(/upload image/i);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.queryByText(/file size must be less than/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
    });
  });

  // TC-006: Image upload validation - invalid file types
  test('TC-006: should reject invalid file types', async () => {
    const invalidFile = new File([''], 'document.pdf', {
      type: 'application/pdf',
      size: 50 * 1024
    });

    imageService.validateImageFile.mockReturnValue({
      isValid: false,
      error: 'Invalid file type. Please upload JPEG, PNG, or WebP images only.'
    });

    render(<ItemForm {...defaultProps} />);

    const fileInput = screen.getByLabelText(/upload image/i);
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  // TC-004: Edit existing items with pre-populated form data
  test('TC-004: should pre-populate form when editing existing item', () => {
    const existingItem = {
      id: 1,
      name: 'Existing Item',
      description: 'Existing description',
      category: 'electronics',
      price: 149.99,
      status: 'active',
      imageUrl: 'existing-image.jpg'
    };

    render(<ItemForm {...defaultProps} item={existingItem} />);

    expect(screen.getByDisplayValue('Existing Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('electronics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('149.99')).toBeInTheDocument();
  });

  // Form input validation edge cases
  test('should validate price input correctly', async () => {
    render(<ItemForm {...defaultProps} />);

    const priceInput = screen.getByLabelText(/price/i);
    
    // Test negative price
    fireEvent.change(priceInput, { target: { value: '-10' } });
    fireEvent.blur(priceInput);
    
    await waitFor(() => {
      expect(screen.getByText(/price must be greater than 0/i)).toBeInTheDocument();
    });

    // Test non-numeric price
    fireEvent.change(priceInput, { target: { value: 'abc' } });
    fireEvent.blur(priceInput);
    
    await waitFor(() => {
      expect(screen.getByText(/price must be greater than 0/i)).toBeInTheDocument();
    });
  });

  test('should handle form cancellation', () => {
    render(<ItemForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('should show loading state during form submission', async () => {
    render(<ItemForm {...defaultProps} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /saving/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('form-loading-spinner')).toBeInTheDocument();
  });

  test('should clear errors when user starts typing', async () => {
    render(<ItemForm {...defaultProps} />);

    // Trigger validation error
    const submitButton = screen.getByRole('button', { name: /save item/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
    });

    // Start typing in name field
    const nameInput = screen.getByLabelText(/item name/i);
    fireEvent.change(nameInput, { target: { value: 'T' } });

    await waitFor(() => {
      expect(screen.queryByText(/item name is required/i)).not.toBeInTheDocument();
    });
  });
});