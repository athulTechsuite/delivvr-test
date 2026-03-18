/**
 * Image validation utilities for file uploads
 */

// Maximum file size in bytes (200KB)
export const MAX_FILE_SIZE = 200 * 1024; // 200KB

// Allowed image types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

/**
 * Validates an image file for size and type constraints
 * @param {File} file - The file to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
export const validateImageFile = (file) => {
  const result = {
    isValid: true,
    error: null
  };

  // Check if file exists
  if (!file) {
    result.isValid = false;
    result.error = 'No file selected';
    return result;
  }

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    result.isValid = false;
    result.error = 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.';
    return result;
  }

  // Check file size (200KB limit)
  if (file.size > MAX_FILE_SIZE) {
    const fileSizeInKB = Math.round(file.size / 1024);
    const maxSizeInKB = Math.round(MAX_FILE_SIZE / 1024);
    result.isValid = false;
    result.error = `File size (${fileSizeInKB}KB) exceeds the maximum limit of ${maxSizeInKB}KB. Please choose a smaller image.`;
    return result;
  }

  return result;
};

/**
 * Formats file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Creates a preview URL for an image file
 * @param {File} file - The image file
 * @returns {Promise<string>} Promise that resolves to the preview URL
 */
export const createImagePreview = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Validates multiple image files
 * @param {FileList|Array} files - List of files to validate
 * @returns {Object} Validation result with valid files and errors
 */
export const validateMultipleImages = (files) => {
  const result = {
    validFiles: [],
    invalidFiles: [],
    errors: []
  };

  const fileArray = Array.from(files);
  
  fileArray.forEach((file, index) => {
    const validation = validateImageFile(file);
    if (validation.isValid) {
      result.validFiles.push(file);
    } else {
      result.invalidFiles.push(file);
      result.errors.push(`File ${index + 1} (${file.name}): ${validation.error}`);
    }
  });

  return result;
};

/**
 * Compresses an image file if it exceeds size limits
 * @param {File} file - The image file to compress
 * @param {number} maxSize - Maximum file size in bytes
 * @param {number} quality - Compression quality (0-1)
 * @returns {Promise<File>} Promise that resolves to compressed file
 */
export const compressImage = (file, maxSize = MAX_FILE_SIZE, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSize) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 600;
      
      let { width, height } = img;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
};