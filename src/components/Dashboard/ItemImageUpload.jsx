import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';

const ItemImageUpload = ({ 
  images = [], 
  onImagesChange, 
  maxFiles = 5, 
  maxSizeMB = 5,
  className = '' 
}) => {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setErrors([]);
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const newErrors = rejectedFiles.map(rejection => 
        `${rejection.file.name}: ${rejection.errors.map(e => e.message).join(', ')}`
      );
      setErrors(newErrors);
    }

    // Process accepted files
    if (acceptedFiles.length > 0) {
      setUploading(true);
      
      try {
        const newImages = [];
        
        for (const file of acceptedFiles) {
          // Check if adding this file would exceed the limit
          if (images.length + newImages.length >= maxFiles) {
            setErrors(prev => [...prev, `Maximum ${maxFiles} images allowed`]);
            break;
          }

          // Create preview URL
          const previewUrl = URL.createObjectURL(file);
          
          // Create image object
          const imageObj = {
            id: Date.now() + Math.random(), // Temporary ID
            file,
            preview: previewUrl,
            name: file.name,
            size: file.size,
            uploading: true
          };
          
          newImages.push(imageObj);
        }

        // Update images with new files
        onImagesChange([...images, ...newImages]);

        // Simulate upload process (replace with actual upload logic)
        setTimeout(() => {
          const updatedImages = [...images, ...newImages.map(img => ({
            ...img,
            uploading: false,
            uploaded: true
          }))];
          onImagesChange(updatedImages);
          setUploading(false);
        }, 1000);

      } catch (error) {
        console.error('Upload error:', error);
        setErrors(prev => [...prev, 'Failed to upload images']);
        setUploading(false);
      }
    }
  }, [images, onImagesChange, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: maxFiles - images.length,
    maxSize: maxSizeMB * 1024 * 1024,
    disabled: uploading || images.length >= maxFiles
  });

  const removeImage = (imageId) => {
    const updatedImages = images.filter(img => img.id !== imageId);
    onImagesChange(updatedImages);
    
    // Clean up preview URL if it exists
    const imageToRemove = images.find(img => img.id === imageId);
    if (imageToRemove?.preview) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {images.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          {isDragActive ? (
            <p className="text-sm text-blue-600">Drop images here...</p>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-1">
                Drag & drop images here, or click to select
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, GIF up to {maxSizeMB}MB ({maxFiles - images.length} remaining)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-800 mb-1">Upload errors:</p>
              <ul className="text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-xs">• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            Uploaded Images ({images.length}/{maxFiles})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group bg-gray-50 rounded-lg overflow-hidden border"
              >
                {/* Image Preview */}
                <div className="aspect-square">
                  {image.preview || image.url ? (
                    <img
                      src={image.preview || image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      onLoad={() => {
                        // Clean up preview URL after image loads
                        if (image.preview && image.uploaded) {
                          URL.revokeObjectURL(image.preview);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Upload Progress Overlay */}
                  {image.uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                {/* Image Info */}
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(image.size)}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  disabled={image.uploading}
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Primary Image Indicator */}
                {image.isPrimary && (
                  <div className="absolute top-1 left-1 px-1 py-0.5 bg-blue-500 text-white text-xs rounded">
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Instructions */}
      {images.length === 0 && (
        <div className="text-center py-4">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No images uploaded yet</p>
        </div>
      )}
    </div>
  );
};

export default ItemImageUpload;