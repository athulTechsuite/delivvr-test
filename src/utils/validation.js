// Validation utilities for admin dashboard forms

export const validateItemForm = (formData) => {
  const errors = {};

  // Name validation
  if (!formData.name || formData.name.trim().length === 0) {
    errors.name = 'Item name is required';
  } else if (formData.name.trim().length < 2) {
    errors.name = 'Item name must be at least 2 characters long';
  } else if (formData.name.trim().length > 100) {
    errors.name = 'Item name must be less than 100 characters';
  }

  // Description validation
  if (!formData.description || formData.description.trim().length === 0) {
    errors.description = 'Description is required';
  } else if (formData.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters long';
  } else if (formData.description.trim().length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  // Category validation
  if (!formData.category || formData.category.trim().length === 0) {
    errors.category = 'Category is required';
  }

  // Price validation
  if (!formData.price) {
    errors.price = 'Price is required';
  } else {
    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      errors.price = 'Price must be a valid positive number';
    } else if (price > 999999.99) {
      errors.price = 'Price must be less than $999,999.99';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateImageFile = (file) => {
  const errors = {};
  const maxSizeBytes = 200 * 1024; // 200KB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!file) {
    return { isValid: true, errors: {} }; // Image is optional
  }

  // File size validation
  if (file.size > maxSizeBytes) {
    errors.image = `Image size must be less than 200KB. Current size: ${Math.round(file.size / 1024)}KB`;
  }

  // File type validation
  if (!allowedTypes.includes(file.type)) {
    errors.image = 'Image must be in JPEG, PNG, or WebP format';
  }

  // File name validation
  if (file.name.length > 255) {
    errors.image = 'File name is too long';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateSearchQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return { isValid: true, sanitized: '' };
  }

  // Remove special characters that might cause issues
  const sanitized = query.replace(/[<>]/g, '').trim();
  
  return {
    isValid: sanitized.length <= 100,
    sanitized: sanitized.substring(0, 100),
    error: sanitized.length > 100 ? 'Search query too long' : null
  };
};

export const validatePaginationParams = (page, limit) => {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  const validPage = !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const validLimit = !isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100 ? parsedLimit : 20;

  return {
    page: validPage,
    limit: validLimit
  };
};

export const validateBulkDeleteIds = (ids) => {
  if (!Array.isArray(ids)) {
    return { isValid: false, error: 'Invalid selection' };
  }

  if (ids.length === 0) {
    return { isValid: false, error: 'No items selected' };
  }

  if (ids.length > 50) {
    return { isValid: false, error: 'Cannot delete more than 50 items at once' };
  }

  // Validate each ID is a valid format (assuming numeric IDs)
  const invalidIds = ids.filter(id => {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) || parsed <= 0;
  });

  if (invalidIds.length > 0) {
    return { isValid: false, error: 'Invalid item IDs selected' };
  }

  return { isValid: true, validIds: ids.map(id => parseInt(id, 10)) };
};

// Helper function to sanitize form data
export const sanitizeFormData = (formData) => {
  return {
    name: formData.name ? formData.name.trim() : '',
    description: formData.description ? formData.description.trim() : '',
    category: formData.category ? formData.category.trim() : '',
    price: formData.price ? parseFloat(formData.price) : 0,
    status: formData.status || 'active'
  };
};

// Categories validation helper
export const validateCategory = (category, allowedCategories = []) => {
  if (!category || category.trim().length === 0) {
    return { isValid: false, error: 'Category is required' };
  }

  if (allowedCategories.length > 0 && !allowedCategories.includes(category)) {
    return { isValid: false, error: 'Invalid category selected' };
  }

  return { isValid: true };
};

// Status validation helper
export const validateStatus = (status) => {
  const allowedStatuses = ['active', 'inactive', 'draft'];
  
  if (!status) {
    return { isValid: true, validStatus: 'active' }; // Default status
  }

  if (!allowedStatuses.includes(status)) {
    return { isValid: false, error: 'Invalid status value' };
  }

  return { isValid: true, validStatus: status };
};