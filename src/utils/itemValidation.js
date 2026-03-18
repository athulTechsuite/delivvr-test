/**
 * Item validation utilities for admin dashboard CRUD operations
 */

export const ITEM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  DISCONTINUED: 'discontinued'
};

export const ITEM_CATEGORIES = {
  ELECTRONICS: 'electronics',
  CLOTHING: 'clothing',
  BOOKS: 'books',
  HOME_GARDEN: 'home_garden',
  SPORTS: 'sports',
  TOYS: 'toys',
  FOOD_BEVERAGES: 'food_beverages',
  BEAUTY: 'beauty',
  AUTOMOTIVE: 'automotive',
  OTHER: 'other'
};

export const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_.,!()&]+$/
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000
  },
  price: {
    required: true,
    min: 0,
    max: 999999.99,
    decimals: 2
  },
  quantity: {
    required: true,
    min: 0,
    max: 999999,
    integer: true
  },
  sku: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[A-Z0-9\-_]+$/
  },
  category: {
    required: true,
    enum: Object.values(ITEM_CATEGORIES)
  },
  status: {
    required: true,
    enum: Object.values(ITEM_STATUS)
  },
  weight: {
    required: false,
    min: 0,
    max: 999999,
    decimals: 2
  },
  dimensions: {
    length: { min: 0, max: 999999, decimals: 2 },
    width: { min: 0, max: 999999, decimals: 2 },
    height: { min: 0, max: 999999, decimals: 2 }
  }
};

export const FILE_VALIDATION = {
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFiles: 10
  },
  documents: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    maxFiles: 5
  }
};

/**
 * Validates item data for create/update operations
 * @param {Object} itemData - Item data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateItem(itemData, isUpdate = false) {
  const errors = [];
  const warnings = [];

  // Validate required fields
  if (!isUpdate || itemData.hasOwnProperty('name')) {
    const nameError = validateField('name', itemData.name, VALIDATION_RULES.name);
    if (nameError) errors.push(nameError);
  }

  if (!isUpdate || itemData.hasOwnProperty('description')) {
    const descError = validateField('description', itemData.description, VALIDATION_RULES.description);
    if (descError) errors.push(descError);
  }

  if (!isUpdate || itemData.hasOwnProperty('price')) {
    const priceError = validateField('price', itemData.price, VALIDATION_RULES.price);
    if (priceError) errors.push(priceError);
  }

  if (!isUpdate || itemData.hasOwnProperty('quantity')) {
    const quantityError = validateField('quantity', itemData.quantity, VALIDATION_RULES.quantity);
    if (quantityError) errors.push(quantityError);
    
    // Warning for low stock
    if (itemData.quantity !== undefined && itemData.quantity < 10) {
      warnings.push('Low stock warning: Quantity is below 10 units');
    }
  }

  if (!isUpdate || itemData.hasOwnProperty('sku')) {
    const skuError = validateField('sku', itemData.sku, VALIDATION_RULES.sku);
    if (skuError) errors.push(skuError);
  }

  if (!isUpdate || itemData.hasOwnProperty('category')) {
    const categoryError = validateField('category', itemData.category, VALIDATION_RULES.category);
    if (categoryError) errors.push(categoryError);
  }

  if (!isUpdate || itemData.hasOwnProperty('status')) {
    const statusError = validateField('status', itemData.status, VALIDATION_RULES.status);
    if (statusError) errors.push(statusError);
  }

  // Validate optional fields
  if (itemData.hasOwnProperty('weight') && itemData.weight !== null) {
    const weightError = validateField('weight', itemData.weight, VALIDATION_RULES.weight);
    if (weightError) errors.push(weightError);
  }

  if (itemData.dimensions) {
    const dimErrors = validateDimensions(itemData.dimensions);
    errors.push(...dimErrors);
  }

  // Validate tags if present
  if (itemData.tags && Array.isArray(itemData.tags)) {
    const tagErrors = validateTags(itemData.tags);
    errors.push(...tagErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single field against its rules
 * @param {string} fieldName - Name of the field
 * @param {any} value - Field value
 * @param {Object} rules - Validation rules
 * @returns {string|null} Error message or null if valid
 */
function validateField(fieldName, value, rules) {
  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // If not required and empty, skip other validations
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `${fieldName} must be at least ${rules.minLength} characters long`;
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${fieldName} must not exceed ${rules.maxLength} characters`;
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      return `${fieldName} contains invalid characters`;
    }
  }

  // Number validations
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(value))) {
    const numValue = Number(value);
    if (rules.min !== undefined && numValue < rules.min) {
      return `${fieldName} must be at least ${rules.min}`;
    }
    if (rules.max !== undefined && numValue > rules.max) {
      return `${fieldName} must not exceed ${rules.max}`;
    }
    if (rules.integer && !Number.isInteger(numValue)) {
      return `${fieldName} must be a whole number`;
    }
    if (rules.decimals !== undefined) {
      const decimalPlaces = (numValue.toString().split('.')[1] || '').length;
      if (decimalPlaces > rules.decimals) {
        return `${fieldName} can have at most ${rules.decimals} decimal places`;
      }
    }
  }

  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    return `${fieldName} must be one of: ${rules.enum.join(', ')}`;
  }

  return null;
}

/**
 * Validates item dimensions
 * @param {Object} dimensions - Dimensions object
 * @returns {Array} Array of error messages
 */
function validateDimensions(dimensions) {
  const errors = [];
  const { length, width, height } = dimensions;

  if (length !== undefined) {
    const lengthError = validateField('length', length, VALIDATION_RULES.dimensions.length);
    if (lengthError) errors.push(lengthError);
  }

  if (width !== undefined) {
    const widthError = validateField('width', width, VALIDATION_RULES.dimensions.width);
    if (widthError) errors.push(widthError);
  }

  if (height !== undefined) {
    const heightError = validateField('height', height, VALIDATION_RULES.dimensions.height);
    if (heightError) errors.push(heightError);
  }

  return errors;
}

/**
 * Validates item tags
 * @param {Array} tags - Array of tag strings
 * @returns {Array} Array of error messages
 */
function validateTags(tags) {
  const errors = [];

  if (tags.length > 20) {
    errors.push('Maximum 20 tags allowed');
  }

  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      errors.push(`Tag at position ${index + 1} must be a string`);
    } else if (tag.length < 2) {
      errors.push(`Tag "${tag}" must be at least 2 characters long`);
    } else if (tag.length > 30) {
      errors.push(`Tag "${tag}" must not exceed 30 characters`);
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) {
      errors.push(`Tag "${tag}" contains invalid characters`);
    }
  });

  // Check for duplicate tags
  const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase()))];
  if (uniqueTags.length !== tags.length) {
    errors.push('Duplicate tags are not allowed');
  }

  return errors;
}

/**
 * Validates uploaded files
 * @param {FileList|Array} files - Files to validate
 * @param {string} type - File type ('images' or 'documents')
 * @returns {Object} Validation result
 */
export function validateFiles(files, type) {
  const errors = [];
  const rules = FILE_VALIDATION[type];

  if (!rules) {
    return { isValid: false, errors: ['Invalid file type specified'] };
  }

  if (files.length > rules.maxFiles) {
    errors.push(`Maximum ${rules.maxFiles} files allowed for ${type}`);
  }

  Array.from(files).forEach((file, index) => {
    // Check file size
    if (file.size > rules.maxSize) {
      errors.push(`File "${file.name}" exceeds maximum size of ${formatFileSize(rules.maxSize)}`);
    }

    // Check file type
    if (!rules.allowedTypes.includes(file.type)) {
      errors.push(`File "${file.name}" has unsupported type. Allowed types: ${rules.allowedTypes.join(', ')}`);
    }

    // Check filename
    if (file.name.length > 255) {
      errors.push(`File "${file.name}" has a name that is too long`);
    }

    if (!/^[a-zA-Z0-9\s\-_.()\[\]]+$/.test(file.name)) {
      errors.push(`File "${file.name}" contains invalid characters`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates bulk operation data
 * @param {Array} items - Array of items for bulk operation
 * @param {string} operation - Type of bulk operation
 * @returns {Object} Validation result
 */
export function validateBulkOperation(items, operation) {
  const errors = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { isValid: false, errors: ['No items selected for bulk operation'] };
  }

  if (items.length > 1000) {
    errors.push('Bulk operations are limited to 1000 items at a time');
  }

  switch (operation) {
    case 'delete':
      // Check for items that cannot be deleted
      items.forEach((item, index) => {
        if (item.status === 'active' && item.quantity > 0) {
          errors.push(`Item "${item.name}" cannot be deleted - has active inventory`);
        }
      });
      break;

    case 'update_status':
      // Validate status updates
      items.forEach((item, index) => {
        if (!item.newStatus || !Object.values(ITEM_STATUS).includes(item.newStatus)) {
          errors.push(`Invalid status specified for item at position ${index + 1}`);
        }
      });
      break;

    case 'update_category':
      // Validate category updates
      items.forEach((item, index) => {
        if (!item.newCategory || !Object.values(ITEM_CATEGORIES).includes(item.newCategory)) {
          errors.push(`Invalid category specified for item at position ${index + 1}`);
        }
      });
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes item data for safe storage
 * @param {Object} itemData - Raw item data
 * @returns {Object} Sanitized item data
 */
export function sanitizeItemData(itemData) {
  const sanitized = { ...itemData };

  // Trim string fields
  if (sanitized.name) sanitized.name = sanitized.name.trim();
  if (sanitized.description) sanitized.description = sanitized.description.trim();
  if (sanitized.sku) sanitized.sku = sanitized.sku.trim().toUpperCase();

  // Convert numeric fields
  if (sanitized.price) sanitized.price = Number(parseFloat(sanitized.price).toFixed(2));
  if (sanitized.quantity) sanitized.quantity = parseInt(sanitized.quantity, 10);
  if (sanitized.weight) sanitized.weight = Number(parseFloat(sanitized.weight).toFixed(2));

  // Sanitize dimensions
  if (sanitized.dimensions) {
    Object.keys(sanitized.dimensions).forEach(key => {
      if (sanitized.dimensions[key]) {
        sanitized.dimensions[key] = Number(parseFloat(sanitized.dimensions[key]).toFixed(2));
      }
    });
  }

  // Sanitize tags
  if (sanitized.tags && Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
  }

  return sanitized;
}

/**
 * Formats file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Creates validation schema for form libraries
 * @param {boolean} isUpdate - Whether this is for update operation
 * @returns {Object} Validation schema object
 */
export function createValidationSchema(isUpdate = false) {
  return {
    name: {
      required: !isUpdate,
      ...VALIDATION_RULES.name
    },
    description: {
      required: !isUpdate,
      ...VALIDATION_RULES.description
    },
    price: {
      required: !isUpdate,
      ...VALIDATION_RULES.price
    },
    quantity: {
      required: !isUpdate,
      ...VALIDATION_RULES.quantity
    },
    sku: {
      required: !isUpdate,
      ...VALIDATION_RULES.sku
    },
    category: {
      required: !isUpdate,
      ...VALIDATION_RULES.category
    },
    status: {
      required: !isUpdate,
      ...VALIDATION_RULES.status
    },
    weight: VALIDATION_RULES.weight,
    dimensions: VALIDATION_RULES.dimensions
  };
}