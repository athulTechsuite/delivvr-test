/**
 * Image Upload Service
 * Handles image upload functionality with validation and file processing
 */

const MAX_FILE_SIZE = 200 * 1024; // 200KB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Validates image file before upload
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 */
export const validateImageFile = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: 'No file selected'
    };
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload JPEG, PNG, or WebP images only.'
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024}KB. Current size: ${Math.round(file.size / 1024)}KB`
    };
  }

  return {
    isValid: true,
    error: null
  };
};

/**
 * Compresses image if needed to meet size requirements
 * @param {File} file - The image file to compress
 * @param {number} quality - Compression quality (0.1 to 1.0)
 * @returns {Promise<File>} - Compressed image file
 */
export const compressImage = (file, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      const maxWidth = 800;
      const maxHeight = 600;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
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

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Uploads image file to server
 * @param {File} file - The image file to upload
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} - Upload response with image URL
 */
export const uploadImage = async (file, onProgress = null) => {
  try {
    // Validate file first
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    let fileToUpload = file;

    // If file is too large, try compression
    if (file.size > MAX_FILE_SIZE * 0.8) {
      try {
        fileToUpload = await compressImage(file, 0.7);
        
        // Check if compressed file still exceeds limit
        if (fileToUpload.size > MAX_FILE_SIZE) {
          fileToUpload = await compressImage(file, 0.5);
        }
        
        // Final check
        if (fileToUpload.size > MAX_FILE_SIZE) {
          throw new Error('Unable to compress image to required size. Please choose a smaller image.');
        }
      } catch (compressionError) {
        console.warn('Image compression failed, using original file:', compressionError);
        // If compression fails, proceed with original if it's within limit
        if (file.size > MAX_FILE_SIZE) {
          throw new Error('Image size exceeds 200KB limit and compression failed');
        }
      }
    }

    // Create FormData for upload
    const formData = new FormData();
    formData.append('image', fileToUpload);
    formData.append('folder', 'items'); // Organize uploads by folder

    // Upload with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(Math.round(percentComplete));
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (parseError) {
            reject(new Error('Invalid server response'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.open('POST', '/api/upload/image');
      
      // Add auth header if available
      const token = localStorage.getItem('adminToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });

  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Deletes image from server
 * @param {string} imageUrl - URL or path of image to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteImage = async (imageUrl) => {
  try {
    const response = await fetch('/api/upload/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ imageUrl })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete image');
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Generates a preview URL for the uploaded file
 * @param {File} file - The image file
 * @returns {string} - Object URL for preview
 */
export const createImagePreview = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Revokes the preview URL to free memory
 * @param {string} previewUrl - The preview URL to revoke
 */
export const revokeImagePreview = (previewUrl) => {
  URL.revokeObjectURL(previewUrl);
};

/**
 * Gets file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Configuration object for image upload
 */
export const imageUploadConfig = {
  maxFileSize: MAX_FILE_SIZE,
  allowedTypes: ALLOWED_TYPES,
  maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE),
  allowedTypesDisplay: ALLOWED_TYPES.map(type => type.split('/')[1].toUpperCase()).join(', ')
};