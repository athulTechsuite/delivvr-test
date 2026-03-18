/**
 * Image Upload Service
 * Handles image upload functionality for item management
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

class ImageUploadService {
  /**
   * Upload a single image file
   * @param {File} file - The image file to upload
   * @param {string} folder - Optional folder path for organization
   * @returns {Promise<Object>} Upload response with image URL and metadata
   */
  async uploadImage(file, folder = 'items') {
    try {
      // Validate file
      this.validateImageFile(file);

      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', folder);

      const response = await fetch(`${API_BASE_URL}/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      return {
        success: true,
        imageUrl: data.imageUrl,
        publicId: data.publicId,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple images
   * @param {FileList|Array<File>} files - Array of image files
   * @param {string} folder - Optional folder path
   * @returns {Promise<Array>} Array of upload responses
   */
  async uploadMultipleImages(files, folder = 'items') {
    const uploadPromises = Array.from(files).map(file => 
      this.uploadImage(file, folder)
    );

    try {
      const results = await Promise.allSettled(uploadPromises);
      
      return results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null,
      }));
    } catch (error) {
      console.error('Multiple image upload error:', error);
      throw error;
    }
  }

  /**
   * Delete an uploaded image
   * @param {string} publicId - The public ID of the image to delete
   * @returns {Promise<Object>} Deletion response
   */
  async deleteImage(publicId) {
    try {
      const response = await fetch(`${API_BASE_URL}/upload/image/${publicId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete image');
      }

      return await response.json();
    } catch (error) {
      console.error('Image deletion error:', error);
      throw error;
    }
  }

  /**
   * Get optimized image URL with transformations
   * @param {string} imageUrl - Original image URL
   * @param {Object} options - Transformation options
   * @returns {string} Optimized image URL
   */
  getOptimizedImageUrl(imageUrl, options = {}) {
    const {
      width = null,
      height = null,
      quality = 'auto',
      format = 'auto',
      crop = 'fill',
    } = options;

    if (!imageUrl) return null;

    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // Build transformation parameters
    const transformations = [];
    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    if (quality) transformations.push(`q_${quality}`);
    if (format) transformations.push(`f_${format}`);
    if (crop) transformations.push(`c_${crop}`);

    const transformString = transformations.join(',');
    
    // Assuming cloudinary or similar service
    return transformString 
      ? `${imageUrl.replace('/upload/', `/upload/${transformString}/`)}`
      : imageUrl;
  }

  /**
   * Validate image file before upload
   * @param {File} file - File to validate
   * @throws {Error} If validation fails
   */
  validateImageFile(file) {
    // Check if file exists
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    // Check file name
    if (file.name.length > 255) {
      throw new Error('File name too long');
    }
  }

  /**
   * Create image preview URL for local display
   * @param {File} file - Image file
   * @returns {string} Object URL for preview
   */
  createPreviewUrl(file) {
    try {
      this.validateImageFile(file);
      return URL.createObjectURL(file);
    } catch (error) {
      console.error('Error creating preview URL:', error);
      return null;
    }
  }

  /**
   * Clean up preview URL to prevent memory leaks
   * @param {string} url - Object URL to revoke
   */
  revokePreviewUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Compress image before upload (client-side)
   * @param {File} file - Original image file
   * @param {Object} options - Compression options
   * @returns {Promise<File>} Compressed image file
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      type = file.type,
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          },
          type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get authentication token from storage
   * @returns {string|null} Auth token
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  /**
   * Generate thumbnail URL
   * @param {string} imageUrl - Original image URL
   * @returns {string} Thumbnail URL
   */
  getThumbnailUrl(imageUrl) {
    return this.getOptimizedImageUrl(imageUrl, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto',
    });
  }

  /**
   * Generate preview URL for item display
   * @param {string} imageUrl - Original image URL
   * @returns {string} Preview URL
   */
  getPreviewUrl(imageUrl) {
    return this.getOptimizedImageUrl(imageUrl, {
      width: 400,
      height: 300,
      crop: 'fit',
      quality: 'auto',
    });
  }
}

// Create and export singleton instance
const imageUploadService = new ImageUploadService();
export default imageUploadService;

// Export class for testing
export { ImageUploadService };