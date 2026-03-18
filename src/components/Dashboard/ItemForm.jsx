import React, { useState, useEffect } from 'react';
import { X, Upload, Image, FileText, AlertCircle } from 'lucide-react';

const ItemForm = ({ 
  item = null, 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    price: 0,
    status: 'active',
    sku: '',
    tags: '',
    images: [],
    files: []
  });

  const [errors, setErrors] = useState({});
  const [dragActive, setDragActive] = useState(false);

  // Initialize form data when item prop changes
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        status: item.status || 'active',
        sku: item.sku || '',
        tags: item.tags ? item.tags.join(', ') : '',
        images: item.images || [],
        files: item.files || []
      });
    } else {
      // Reset form for new item
      setFormData({
        name: '',
        description: '',
        category: '',
        quantity: 0,
        price: 0,
        status: 'active',
        sku: '',
        tags: '',
        images: [],
        files: []
      });
    }
    setErrors({});
  }, [item, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.quantity < 0) {
      newErrors.quantity = 'Quantity cannot be negative';
    }

    if (formData.price < 0) {
      newErrors.price = 'Price cannot be negative';
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileUpload = (files, type = 'images') => {
    const newFiles = Array.from(files);
    const validFiles = newFiles.filter(file => {
      if (type === 'images') {
        return file.type.startsWith('image/');
      }
      return true; // Allow all file types for general files
    });

    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], ...validFiles]
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files, 'images');
    }
  };

  const removeFile = (index, type) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Process tags
    const processedData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    };

    onSubmit(processedData);
  };

  const categories = [
    'Electronics',
    'Clothing',
    'Books',
    'Home & Garden',
    'Sports',
    'Toys',
    'Food & Beverage',
    'Health & Beauty',
    'Automotive',
    'Other'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {item ? 'Edit Item' : 'Create New Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter item name"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.sku ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter SKU"
                  disabled={isLoading}
                />
                {errors.sku && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.sku}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.category}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.quantity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={16} className="mr-1" />
                      {errors.quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.price && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={16} className="mr-1" />
                      {errors.price}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            {/* Description and Files */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Details & Media</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter item description"
                  disabled={isLoading}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. electronic, portable, battery-powered"
                  disabled={isLoading}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Images
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Image size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">
                    Drag & drop images here, or{' '}
                    <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                      browse
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e.target.files, 'images')}
                        className="hidden"
                        disabled={isLoading}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>

                {formData.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {formData.images.map((file, index) => (
                      <div key={index} className="relative">
                        <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate">
                            {typeof file === 'string' ? file.split('/').pop() : file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(index, 'images')}
                            className="text-red-500 hover:text-red-700 ml-2"
                            disabled={isLoading}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                    Upload files
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e.target.files, 'files')}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                </div>

                {formData.files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <span className="text-sm text-gray-700 truncate">
                          {typeof file === 'string' ? file.split('/').pop() : file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index, 'files')}
                          className="text-red-500 hover:text-red-700 ml-2"
                          disabled={isLoading}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {item ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                item ? 'Update Item' : 'Create Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemForm;