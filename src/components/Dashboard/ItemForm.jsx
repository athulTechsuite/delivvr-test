import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { validateItemForm } from '../../utils/validation';

const ItemForm = ({ item = null, onSubmit, onCancel, isLoading = false }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    sku: '',
    status: 'active',
    stock_quantity: '',
    weight: '',
    dimensions: '',
    tags: ''
  });
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const categories = [
    'Electronics',
    'Clothing',
    'Home & Garden',
    'Sports & Outdoors',
    'Books',
    'Health & Beauty',
    'Food & Beverages',
    'Automotive',
    'Other'
  ];

  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'draft', label: 'Draft' },
    { value: 'out_of_stock', label: 'Out of Stock' }
  ];

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || '',
        price: item.price ? item.price.toString() : '',
        sku: item.sku || '',
        status: item.status || 'active',
        stock_quantity: item.stock_quantity ? item.stock_quantity.toString() : '',
        weight: item.weight ? item.weight.toString() : '',
        dimensions: item.dimensions || '',
        tags: item.tags ? (Array.isArray(item.tags) ? item.tags.join(', ') : item.tags) : ''
      });
    }
  }, [item]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsDirty(true);

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateItemForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Process form data
    const processedData = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
    };

    onSubmit(processedData);
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const inputClasses = `
    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${theme === 'dark' 
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
    }
  `;

  const labelClasses = `
    block text-sm font-medium mb-1
    ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
  `;

  const errorClasses = 'text-red-500 text-sm mt-1';

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg max-w-4xl mx-auto`}>
      <div className="mb-6">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {item ? 'Edit Item' : 'Add New Item'}
        </h2>
        <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {item ? 'Update item information below' : 'Fill in the details to create a new item'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="md:col-span-2">
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Basic Information
            </h3>
          </div>

          <div>
            <label htmlFor="name" className={labelClasses}>
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={inputClasses}
              placeholder="Enter item name"
              disabled={isLoading}
            />
            {errors.name && <p className={errorClasses}>{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="sku" className={labelClasses}>
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className={inputClasses}
              placeholder="Enter SKU"
              disabled={isLoading}
            />
            {errors.sku && <p className={errorClasses}>{errors.sku}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className={inputClasses}
              placeholder="Enter item description"
              disabled={isLoading}
            />
            {errors.description && <p className={errorClasses}>{errors.description}</p>}
          </div>

          <div>
            <label htmlFor="category" className={labelClasses}>
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={inputClasses}
              disabled={isLoading}
            >
              <option value="">Select a category</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && <p className={errorClasses}>{errors.category}</p>}
          </div>

          <div>
            <label htmlFor="status" className={labelClasses}>
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className={inputClasses}
              disabled={isLoading}
            >
              {statuses.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {errors.status && <p className={errorClasses}>{errors.status}</p>}
          </div>

          {/* Pricing and Inventory */}
          <div className="md:col-span-2">
            <h3 className={`text-lg font-semibold mb-4 mt-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Pricing & Inventory
            </h3>
          </div>

          <div>
            <label htmlFor="price" className={labelClasses}>
              Price ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className={inputClasses}
              placeholder="0.00"
              disabled={isLoading}
            />
            {errors.price && <p className={errorClasses}>{errors.price}</p>}
          </div>

          <div>
            <label htmlFor="stock_quantity" className={labelClasses}>
              Stock Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="stock_quantity"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleInputChange}
              min="0"
              className={inputClasses}
              placeholder="0"
              disabled={isLoading}
            />
            {errors.stock_quantity && <p className={errorClasses}>{errors.stock_quantity}</p>}
          </div>

          {/* Physical Properties */}
          <div className="md:col-span-2">
            <h3 className={`text-lg font-semibold mb-4 mt-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Physical Properties
            </h3>
          </div>

          <div>
            <label htmlFor="weight" className={labelClasses}>
              Weight (lbs)
            </label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className={inputClasses}
              placeholder="0.00"
              disabled={isLoading}
            />
            {errors.weight && <p className={errorClasses}>{errors.weight}</p>}
          </div>

          <div>
            <label htmlFor="dimensions" className={labelClasses}>
              Dimensions (L x W x H)
            </label>
            <input
              type="text"
              id="dimensions"
              name="dimensions"
              value={formData.dimensions}
              onChange={handleInputChange}
              className={inputClasses}
              placeholder="e.g., 10 x 8 x 6 inches"
              disabled={isLoading}
            />
            {errors.dimensions && <p className={errorClasses}>{errors.dimensions}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="tags" className={labelClasses}>
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className={inputClasses}
              placeholder="Enter tags separated by commas"
              disabled={isLoading}
            />
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Separate multiple tags with commas (e.g., electronics, gadget, portable)
            </p>
            {errors.tags && <p className={errorClasses}>{errors.tags}</p>}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className={`
              px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2
              ${theme === 'dark'
                ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-gray-500'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`
              px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
              bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {item ? 'Updating...' : 'Creating...'}
              </span>
            ) : (
              item ? 'Update Item' : 'Create Item'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ItemForm;