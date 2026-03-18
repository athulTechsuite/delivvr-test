import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUpload from '../ImageUpload';

// Mock file reader
class MockFileReader {
  constructor() {
    this.result = null;
    this.error = null;
    this.readyState = 0;
    this.onload = null;
    this.onerror = null;
  }

  readAsDataURL(file) {
    this.readyState = 2;
    if (this.onload) {
      this.result = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD`;
      this.onload({ target: this });
    }
  }

  abort() {
    this.readyState = 0;
  }
}

global.FileReader = MockFileReader;

// Helper to create mock file
const createMockFile = (name, size, type) => {
  const file = new File(['dummy content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('ImageUpload Component', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    onChange: mockOnChange,
    maxSize: 200 * 1024, // 200KB
    accept: 'image/*'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-005: Image upload feature with 200KB file size limit enforcement
  it('TC-005: should accept valid image files under 200KB', async () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('test.jpg', 150 * 1024, 'image/jpeg'); // 150KB
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(file);
    });
    
    // Should show preview
    expect(screen.getByAltText(/preview/i)).toBeInTheDocument();
  });

  // TC-006: Image upload shows error message if file exceeds 200KB
  it('TC-006: should show error message for files exceeding 200KB', async () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('large.jpg', 250 * 1024, 'image/jpeg'); // 250KB
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/file size.*exceeds.*200kb/i)).toBeInTheDocument();
    });
    
    // Should not call onChange for invalid file
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should show error for invalid file types', async () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('document.pdf', 100 * 1024, 'application/pdf');
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/please select a valid image file/i)).toBeInTheDocument();
    });
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should handle drag and drop functionality', async () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('test.png', 100 * 1024, 'image/png');
    const dropZone = screen.getByText(/drag.*drop.*image/i).closest('div');
    
    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [file] }
    });
    
    expect(dropZone).toHaveClass('drag-active');
    
    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] }
    });
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(file);
    });
  });

  it('should show file size in error message', () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('large.jpg', 300 * 1024, 'image/jpeg'); // 300KB
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText(/current file size: 300kb/i)).toBeInTheDocument();
  });

  it('should remove uploaded image when remove button is clicked', async () => {
    render(<ImageUpload {...defaultProps} />);
    
    const file = createMockFile('test.jpg', 100 * 1024, 'image/jpeg');
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByAltText(/preview/i)).toBeInTheDocument();
    });
    
    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    
    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(screen.queryByAltText(/preview/i)).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ImageUpload {...defaultProps} disabled={true} />);
    
    const input = screen.getByRole('button', { name: /upload/i }).querySelector('input');
    expect(input).toBeDisabled();
  });

  it('should display existing image preview when value prop is provided', () => {
    const existingImageUrl = 'https://example.com/image.jpg';
    render(<ImageUpload {...defaultProps} value={existingImageUrl} />);
    
    expect(screen.getByAltText(/preview/i)).toHaveAttribute('src', existingImageUrl);
  });
});