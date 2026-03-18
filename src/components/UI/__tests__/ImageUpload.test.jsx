import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUpload from '../ImageUpload';

describe('ImageUpload Component', () => {
  const mockOnUpload = jest.fn();
  
  beforeEach(() => {
    mockOnUpload.mockClear();
  });

  it('should render upload button', () => {
    render(<ImageUpload onUpload={mockOnUpload} />);
    expect(screen.getByText(/upload image/i)).toBeInTheDocument();
  });

  it('should handle valid image upload', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB
    
    render(<ImageUpload onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
    
    const input = screen.getByLabelText(/upload image/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });
  });

  describe('TC-005: Image upload size validation', () => {
    it('should reject file exceeding maximum size limit', async () => {
      const oversizedFile = new File(['test'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(oversizedFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB
      
      render(<ImageUpload onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
      
      const input = screen.getByLabelText(/upload image/i);
      fireEvent.change(input, { target: { files: [oversizedFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds maximum limit/i)).toBeInTheDocument();
      });
      
      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('should accept file within size limit', async () => {
      const validFile = new File(['test'], 'valid.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validFile, 'size', { value: 3 * 1024 * 1024 }); // 3MB
      
      render(<ImageUpload onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
      
      const input = screen.getByLabelText(/upload image/i);
      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(validFile);
      });
      
      expect(screen.queryByText(/file size exceeds maximum limit/i)).not.toBeInTheDocument();
    });

    it('should accept file exactly at size limit', async () => {
      const exactSizeFile = new File(['test'], 'exact.jpg', { type: 'image/jpeg' });
      Object.defineProperty(exactSizeFile, 'size', { value: 5 * 1024 * 1024 }); // Exactly 5MB
      
      render(<ImageUpload onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
      
      const input = screen.getByLabelText(/upload image/i);
      fireEvent.change(input, { target: { files: [exactSizeFile] } });

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(exactSizeFile);
      });
      
      expect(screen.queryByText(/file size exceeds maximum limit/i)).not.toBeInTheDocument();
    });

    it('should display appropriate error message with file size details', async () => {
      const oversizedFile = new File(['test'], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(oversizedFile, 'size', { value: 15 * 1024 * 1024 }); // 15MB
      
      render(<ImageUpload onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
      
      const input = screen.getByLabelText(/upload image/i);
      fireEvent.change(input, { target: { files: [oversizedFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds maximum limit/i)).toBeInTheDocument();
      });
    });

    it('should use default size limit when maxSize prop not provided', async () => {
      const largeFile = new File(['test'], 'default-test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 }); // 11MB
      
      render(<ImageUpload onUpload={mockOnUpload} />); // No maxSize prop
      
      const input = screen.getByLabelText(/upload image/i);
      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds maximum limit/i)).toBeInTheDocument();
      });
      
      expect(mockOnUpload).not.toHaveBeenCalled();
    });
  });

  it('should handle invalid file type', async () => {
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    render(<ImageUpload onUpload={mockOnUpload} />);
    
    const input = screen.getByLabelText(/upload image/i);
    fireEvent.change(input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
    
    expect(mockOnUpload).not.toHaveBeenCalled();
  });
});