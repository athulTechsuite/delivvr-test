import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * File upload utility for admin dashboard
 * Handles image and file uploads for item management
 */

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Validates file type and size
 * @param {File} file - File to validate
 * @param {boolean} isImage - Whether file should be an image
 * @returns {Object} - Validation result with isValid and error
 */
export const validateFile = (file, isImage = false) => {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

  if (!allowedTypes.includes(file.type)) {
    const typeList = isImage ? 'JPEG, PNG, WebP, GIF' : 'JPEG, PNG, WebP, GIF, PDF, TXT, DOC, DOCX';
    return { 
      isValid: false, 
      error: `Invalid file type. Allowed types: ${typeList}` 
    };
  }

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return { 
      isValid: false, 
      error: `File size exceeds ${sizeMB}MB limit` 
    };
  }

  return { isValid: true, error: null };
};

/**
 * Uploads a file to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} path - Storage path
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} - Download URL
 */
export const uploadFile = async (file, path, onProgress = null) => {
  try {
    const storageRef = ref(storage, path);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Uploads multiple files
 * @param {FileList|Array} files - Files to upload
 * @param {string} basePath - Base storage path
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} - Array of download URLs
 */
export const uploadMultipleFiles = async (files, basePath, onProgress = null) => {
  try {
    const fileArray = Array.from(files);
    const uploadPromises = fileArray.map(async (file, index) => {
      const fileName = `${Date.now()}_${index}_${file.name}`;
      const filePath = `${basePath}/${fileName}`;
      
      if (onProgress) {
        onProgress({ fileIndex: index, fileName: file.name, status: 'uploading' });
      }
      
      try {
        const url = await uploadFile(file, filePath);
        
        if (onProgress) {
          onProgress({ fileIndex: index, fileName: file.name, status: 'completed', url });
        }
        
        return {
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          path: filePath
        };
      } catch (error) {
        if (onProgress) {
          onProgress({ fileIndex: index, fileName: file.name, status: 'error', error: error.message });
        }
        throw error;
      }
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple file upload error:', error);
    throw new Error(`Multiple upload failed: ${error.message}`);
  }
};

/**
 * Deletes a file from Firebase Storage
 * @param {string} path - Storage path
 * @returns {Promise<void>}
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('File deletion error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }
};

/**
 * Generates a unique file path for item uploads
 * @param {string} itemId - Item ID
 * @param {string} fileName - Original file name
 * @param {string} type - File type ('image' or 'file')
 * @returns {string} - Generated path
 */
export const generateFilePath = (itemId, fileName, type = 'image') => {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `items/${itemId}/${type}s/${timestamp}_${sanitizedFileName}`;
};

/**
 * Extracts file path from Firebase Storage URL
 * @param {string} url - Download URL
 * @returns {string} - File path
 */
export const extractPathFromUrl = (url) => {
  try {
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.*?)\?/);
    return match ? match[1] : '';
  } catch (error) {
    console.error('Error extracting path from URL:', error);
    return '';
  }
};

/**
 * Compresses an image file
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} - Compressed file
 */
export const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
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
};

/**
 * File upload helper for admin dashboard
 */
export class FileUploadHelper {
  constructor(itemId) {
    this.itemId = itemId;
    this.uploadQueue = [];
    this.isUploading = false;
  }

  /**
   * Add files to upload queue
   * @param {FileList|Array} files - Files to add
   * @param {string} type - Upload type ('image' or 'file')
   */
  addToQueue(files, type = 'image') {
    const fileArray = Array.from(files);
    fileArray.forEach(file => {
      const validation = validateFile(file, type === 'image');
      if (validation.isValid) {
        this.uploadQueue.push({
          file,
          type,
          id: Date.now() + Math.random(),
          status: 'pending'
        });
      } else {
        console.warn(`File ${file.name} validation failed:`, validation.error);
      }
    });
  }

  /**
   * Process upload queue
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} - Upload results
   */
  async processQueue(onProgress = null) {
    if (this.isUploading) {
      throw new Error('Upload already in progress');
    }

    this.isUploading = true;
    const results = [];

    try {
      for (const queueItem of this.uploadQueue) {
        if (onProgress) {
          onProgress({ ...queueItem, status: 'uploading' });
        }

        try {
          const filePath = generateFilePath(this.itemId, queueItem.file.name, queueItem.type);
          const url = await uploadFile(queueItem.file, filePath);
          
          const result = {
            id: queueItem.id,
            name: queueItem.file.name,
            url,
            type: queueItem.file.type,
            size: queueItem.file.size,
            path: filePath,
            uploadType: queueItem.type
          };

          results.push(result);

          if (onProgress) {
            onProgress({ ...queueItem, status: 'completed', result });
          }
        } catch (error) {
          if (onProgress) {
            onProgress({ ...queueItem, status: 'error', error: error.message });
          }
        }
      }

      return results;
    } finally {
      this.isUploading = false;
      this.uploadQueue = [];
    }
  }

  /**
   * Clear upload queue
   */
  clearQueue() {
    this.uploadQueue = [];
  }

  /**
   * Get queue status
   * @returns {Object} - Queue information
   */
  getQueueStatus() {
    return {
      total: this.uploadQueue.length,
      pending: this.uploadQueue.filter(item => item.status === 'pending').length,
      uploading: this.uploadQueue.filter(item => item.status === 'uploading').length,
      isUploading: this.isUploading
    };
  }
}

export default {
  validateFile,
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  generateFilePath,
  extractPathFromUrl,
  compressImage,
  FileUploadHelper
};