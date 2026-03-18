/**
 * Image Upload Service
 * Handles image file validation, compression, and upload operations
 * Enforces 200KB file size limit as per requirements
 */

const MAX_FILE_SIZE = 200 * 1024; // 200KB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const COMPRESSION_QUALITY = 0.8;

class ImageUploadService {
  /**
   * Validates image file before upload
   * @param {File} file - The image file to validate
   * @returns {Object} - Validation result with success/error
   */
  validateImage(file) {
    if (!file) {
      return { success: false, error: 'No file selected' };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { 
        success: false, 
        error: 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF images only.' 
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { 
        success: false, 
        error: `File size exceeds 200KB limit. Current size: ${this.formatFileSize(file.size)}` 
      };
    }

    return { success: true };
  }

  /**
   * Compresses image if needed to meet size requirements
   * @param {File} file - The image file to compress
   * @param {number} quality - Compression quality (0-1)
   * @returns {Promise<File>} - Compressed image file
   */
  async compressImage(file, quality = COMPRESSION_QUALITY) {
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

        // Draw and compress image
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
              reject(new Error('Image compression failed'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Processes image file with validation and optional compression
   * @param {File} file - The image file to process
   * @param {boolean} autoCompress - Whether to auto-compress if file is too large
   * @returns {Promise<Object>} - Processing result
   */
  async processImage(file, autoCompress = true) {
    try {
      // Initial validation
      let validation = this.validateImage(file);
      
      if (!validation.success) {
        // If file is too large and auto-compression is enabled, try compressing
        if (validation.error.includes('exceeds 200KB') && autoCompress) {
          const compressedFile = await this.compressImage(file);
          validation = this.validateImage(compressedFile);
          
          if (validation.success) {
            return {
              success: true,
              file: compressedFile,
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressed: true
            };
          }
        }
        return validation;
      }

      return {
        success: true,
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressed: false
      };
    } catch (error) {
      return {
        success: false,
        error: `Image processing failed: ${error.message}`
      };
    }
  }

  /**
   * Uploads processed image to server
   * @param {File} file - The processed image file
   * @param {string} endpoint - Upload endpoint URL
   * @param {Object} additionalData - Additional form data
   * @returns {Promise<Object>} - Upload result
   */
  async uploadImage(file, endpoint = '/api/images/upload', additionalData = {}) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Add any additional data
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        url: result.url || result.imageUrl
      };
    } catch (error) {
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      };
    }
  }

  /**
   * Complete image upload process (validate, process, upload)
   * @param {File} file - The image file to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Complete upload result
   */
  async handleImageUpload(file, options = {}) {
    const {
      endpoint = '/api/images/upload',
      autoCompress = true,
      additionalData = {},
      onProgress = null
    } = options;

    try {
      // Process image (validate and compress if needed)
      const processResult = await this.processImage(file, autoCompress);
      
      if (!processResult.success) {
        return processResult;
      }

      if (onProgress) {
        onProgress({ stage: 'uploading', progress: 50 });
      }

      // Upload processed image
      const uploadResult = await this.uploadImage(
        processResult.file,
        endpoint,
        additionalData
      );

      if (onProgress) {
        onProgress({ stage: 'complete', progress: 100 });
      }

      return {
        ...uploadResult,
        processInfo: {
          originalSize: processResult.originalSize,
          finalSize: processResult.compressedSize,
          compressed: processResult.compressed
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Image upload failed: ${error.message}`
      };
    }
  }

  /**
   * Deletes image from server
   * @param {string} imageUrl - URL or ID of image to delete
   * @param {string} endpoint - Delete endpoint URL
   * @returns {Promise<Object>} - Delete result
   */
  async deleteImage(imageUrl, endpoint = '/api/images/delete') {
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Delete failed');
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Delete failed: ${error.message}`
      };
    }
  }

  /**
   * Creates image preview URL
   * @param {File} file - Image file
   * @returns {string} - Preview URL
   */
  createPreviewUrl(file) {
    return URL.createObjectURL(file);
  }

  /**
   * Revokes image preview URL to free memory
   * @param {string} url - Preview URL to revoke
   */
  revokePreviewUrl(url) {
    URL.revokeObjectURL(url);
  }

  /**
   * Formats file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Gets maximum allowed file size
   * @returns {number} - Max file size in bytes
   */
  getMaxFileSize() {
    return MAX_FILE_SIZE;
  }

  /**
   * Gets allowed file types
   * @returns {Array} - Array of allowed MIME types
   */
  getAllowedTypes() {
    return [...ALLOWED_TYPES];
  }
}

// Create and export singleton instance
const imageUploadService = new ImageUploadService();
export default imageUploadService;

// Also export the class for testing
export { ImageUploadService };