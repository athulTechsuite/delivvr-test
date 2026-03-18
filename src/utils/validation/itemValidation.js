/**
 * Item validation utilities for admin dashboard CRUD operations
 * Provides validation functions for item creation, updates, and form handling
 */

// Constants for validation
const VALIDATION_RULES = {
  name: {
    minLength: 2,
    maxLength: 100,
    required: true
  },
  description: {
    minLength: 10,
    maxLength: 1000,
    required: true
  },
  price: {
    min: 0.01,
    max: 999999.99,
    required: true
  },
  category: {
    required: true,
    validCategories: [
      'electronics',
      'clothing',
      'home',
      'books',
      'sports',
      'toys',
      'beauty',
      'automotive',
      'grocery',
      'other'
    ]
  },
  sku: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[A-Z0-9-_]+$/,
    required: true
  },
  stock: {
    min: 0,
    max: 999999,
    required: true
  },
  weight: {
    min: 0.01,
    max: 1000,
    required: false
  },
  dimensions: {
    required: false
  },
  tags: {
    maxItems: 20,
    maxLength: 30,
    required: false
  }
};

const IMAGE_VALIDATION = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxImages: 10,
  minImages: 1
};

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(field, message, code = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Validate item name
 */
export const validateItemName = (name) => {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push(new ValidationError('name', 'Item name is required', 'REQUIRED'));
    return errors;
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < VALIDATION_RULES.name.minLength) {
    errors.push(new ValidationError(
      'name',
      `Item name must be at least ${VALIDATION_RULES.name.minLength} characters long`,
      'MIN_LENGTH'
    ));
  }
  
  if (trimmedName.length > VALIDATION_RULES.name.maxLength) {
    errors.push(new ValidationError(
      'name',
      `Item name must not exceed ${VALIDATION_RULES.name.maxLength} characters`,
      'MAX_LENGTH'
    ));
  }
  
  // Check for invalid characters
  if (/[<>{}[\]\\\/]/.test(trimmedName)) {
    errors.push(new ValidationError(
      'name',
      'Item name contains invalid characters',
      'INVALID_CHARACTERS'
    ));
  }
  
  return errors;
};

/**
 * Validate item description
 */
export const validateItemDescription = (description) => {
  const errors = [];
  
  if (!description || typeof description !== 'string') {
    errors.push(new ValidationError('description', 'Item description is required', 'REQUIRED'));
    return errors;
  }
  
  const trimmedDescription = description.trim();
  
  if (trimmedDescription.length < VALIDATION_RULES.description.minLength) {
    errors.push(new ValidationError(
      'description',
      `Description must be at least ${VALIDATION_RULES.description.minLength} characters long`,
      'MIN_LENGTH'
    ));
  }
  
  if (trimmedDescription.length > VALIDATION_RULES.description.maxLength) {
    errors.push(new ValidationError(
      'description',
      `Description must not exceed ${VALIDATION_RULES.description.maxLength} characters`,
      'MAX_LENGTH'
    ));
  }
  
  return errors;
};

/**
 * Validate item price
 */
export const validateItemPrice = (price) => {
  const errors = [];
  
  if (price === null || price === undefined || price === '') {
    errors.push(new ValidationError('price', 'Price is required', 'REQUIRED'));
    return errors;
  }
  
  const numPrice = parseFloat(price);
  
  if (isNaN(numPrice)) {
    errors.push(new ValidationError('price', 'Price must be a valid number', 'INVALID_NUMBER'));
    return errors;
  }
  
  if (numPrice < VALIDATION_RULES.price.min) {
    errors.push(new ValidationError(
      'price',
      `Price must be at least $${VALIDATION_RULES.price.min}`,
      'MIN_VALUE'
    ));
  }
  
  if (numPrice > VALIDATION_RULES.price.max) {
    errors.push(new ValidationError(
      'price',
      `Price must not exceed $${VALIDATION_RULES.price.max}`,
      'MAX_VALUE'
    ));
  }
  
  // Check for more than 2 decimal places
  if (numPrice.toString().includes('.') && numPrice.toString().split('.')[1].length > 2) {
    errors.push(new ValidationError(
      'price',
      'Price cannot have more than 2 decimal places',
      'INVALID_PRECISION'
    ));
  }
  
  return errors;
};

/**
 * Validate item category
 */
export const validateItemCategory = (category) => {
  const errors = [];
  
  if (!category || typeof category !== 'string') {
    errors.push(new ValidationError('category', 'Category is required', 'REQUIRED'));
    return errors;
  }
  
  if (!VALIDATION_RULES.category.validCategories.includes(category.toLowerCase())) {
    errors.push(new ValidationError(
      'category',
      'Invalid category selected',
      'INVALID_CATEGORY'
    ));
  }
  
  return errors;
};

/**
 * Validate item SKU
 */
export const validateItemSku = (sku) => {
  const errors = [];
  
  if (!sku || typeof sku !== 'string') {
    errors.push(new ValidationError('sku', 'SKU is required', 'REQUIRED'));
    return errors;
  }
  
  const trimmedSku = sku.trim().toUpperCase();
  
  if (trimmedSku.length < VALIDATION_RULES.sku.minLength) {
    errors.push(new ValidationError(
      'sku',
      `SKU must be at least ${VALIDATION_RULES.sku.minLength} characters long`,
      'MIN_LENGTH'
    ));
  }
  
  if (trimmedSku.length > VALIDATION_RULES.sku.maxLength) {
    errors.push(new ValidationError(
      'sku',
      `SKU must not exceed ${VALIDATION_RULES.sku.maxLength} characters`,
      'MAX_LENGTH'
    ));
  }
  
  if (!VALIDATION_RULES.sku.pattern.test(trimmedSku)) {
    errors.push(new ValidationError(
      'sku',
      'SKU can only contain letters, numbers, hyphens, and underscores',
      'INVALID_FORMAT'
    ));
  }
  
  return errors;
};

/**
 * Validate item stock quantity
 */
export const validateItemStock = (stock) => {
  const errors = [];
  
  if (stock === null || stock === undefined || stock === '') {
    errors.push(new ValidationError('stock', 'Stock quantity is required', 'REQUIRED'));
    return errors;
  }
  
  const numStock = parseInt(stock, 10);
  
  if (isNaN(numStock) || !Number.isInteger(Number(stock))) {
    errors.push(new ValidationError('stock', 'Stock must be a valid integer', 'INVALID_INTEGER'));
    return errors;
  }
  
  if (numStock < VALIDATION_RULES.stock.min) {
    errors.push(new ValidationError(
      'stock',
      `Stock quantity cannot be negative`,
      'MIN_VALUE'
    ));
  }
  
  if (numStock > VALIDATION_RULES.stock.max) {
    errors.push(new ValidationError(
      'stock',
      `Stock quantity cannot exceed ${VALIDATION_RULES.stock.max}`,
      'MAX_VALUE'
    ));
  }
  
  return errors;
};

/**
 * Validate item weight (optional)
 */
export const validateItemWeight = (weight) => {
  const errors = [];
  
  // Weight is optional
  if (!weight || weight === '') {
    return errors;
  }
  
  const numWeight = parseFloat(weight);
  
  if (isNaN(numWeight)) {
    errors.push(new ValidationError('weight', 'Weight must be a valid number', 'INVALID_NUMBER'));
    return errors;
  }
  
  if (numWeight < VALIDATION_RULES.weight.min) {
    errors.push(new ValidationError(
      'weight',
      `Weight must be at least ${VALIDATION_RULES.weight.min} kg`,
      'MIN_VALUE'
    ));
  }
  
  if (numWeight > VALIDATION_RULES.weight.max) {
    errors.push(new ValidationError(
      'weight',
      `Weight cannot exceed ${VALIDATION_RULES.weight.max} kg`,
      'MAX_VALUE'
    ));
  }
  
  return errors;
};

/**
 * Validate item dimensions (optional)
 */
export const validateItemDimensions = (dimensions) => {
  const errors = [];
  
  // Dimensions are optional
  if (!dimensions) {
    return errors;
  }
  
  const { length, width, height } = dimensions;
  
  if (length !== undefined && length !== null && length !== '') {
    const numLength = parseFloat(length);
    if (isNaN(numLength) || numLength <= 0) {
      errors.push(new ValidationError('dimensions.length', 'Length must be a positive number', 'INVALID_DIMENSION'));
    }
  }
  
  if (width !== undefined && width !== null && width !== '') {
    const numWidth = parseFloat(width);
    if (isNaN(numWidth) || numWidth <= 0) {
      errors.push(new ValidationError('dimensions.width', 'Width must be a positive number', 'INVALID_DIMENSION'));
    }
  }
  
  if (height !== undefined && height !== null && height !== '') {
    const numHeight = parseFloat(height);
    if (isNaN(numHeight) || numHeight <= 0) {
      errors.push(new ValidationError('dimensions.height', 'Height must be a positive number', 'INVALID_DIMENSION'));
    }
  }
  
  return errors;
};

/**
 * Validate item tags (optional)
 */
export const validateItemTags = (tags) => {
  const errors = [];
  
  // Tags are optional
  if (!tags || !Array.isArray(tags)) {
    return errors;
  }
  
  if (tags.length > VALIDATION_RULES.tags.maxItems) {
    errors.push(new ValidationError(
      'tags',
      `Cannot have more than ${VALIDATION_RULES.tags.maxItems} tags`,
      'MAX_ITEMS'
    ));
  }
  
  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      errors.push(new ValidationError(
        `tags[${index}]`,
        'Each tag must be a string',
        'INVALID_TYPE'
      ));
      return;
    }
    
    if (tag.trim().length === 0) {
      errors.push(new ValidationError(
        `tags[${index}]`,
        'Tags cannot be empty',
        'EMPTY_TAG'
      ));
      return;
    }
    
    if (tag.trim().length > VALIDATION_RULES.tags.maxLength) {
      errors.push(new ValidationError(
        `tags[${index}]`,
        `Tag cannot exceed ${VALIDATION_RULES.tags.maxLength} characters`,
        'MAX_LENGTH'
      ));
    }
    
    // Check for invalid characters in tags
    if (/[<>{}[\]\\\/]/.test(tag)) {
      errors.push(new ValidationError(
        `tags[${index}]`,
        'Tag contains invalid characters',
        'INVALID_CHARACTERS'
      ));
    }
  });
  
  return errors;
};

/**
 * Validate item images
 */
export const validateItemImages = (images) => {
  const errors = [];
  
  if (!images || !Array.isArray(images)) {
    errors.push(new ValidationError('images', 'At least one image is required', 'REQUIRED'));
    return errors;
  }
  
  if (images.length < IMAGE_VALIDATION.minImages) {
    errors.push(new ValidationError(
      'images',
      `At least ${IMAGE_VALIDATION.minImages} image is required`,
      'MIN_IMAGES'
    ));
  }
  
  if (images.length > IMAGE_VALIDATION.maxImages) {
    errors.push(new ValidationError(
      'images',
      `Cannot upload more than ${IMAGE_VALIDATION.maxImages} images`,
      'MAX_IMAGES'
    ));
  }
  
  images.forEach((image, index) => {
    if (image instanceof File) {
      // Validate file size
      if (image.size > IMAGE_VALIDATION.maxSize) {
        errors.push(new ValidationError(
          `images[${index}]`,
          `Image ${index + 1} is too large. Maximum size is ${IMAGE_VALIDATION.maxSize / (1024 * 1024)}MB`,
          'FILE_TOO_LARGE'
        ));
      }
      
      // Validate file type
      if (!IMAGE_VALIDATION.allowedTypes.includes(image.type)) {
        errors.push(new ValidationError(
          `images[${index}]`,
          `Image ${index + 1} has invalid file type. Allowed types: ${IMAGE_VALIDATION.allowedTypes.join(', ')}`,
          'INVALID_FILE_TYPE'
        ));
      }
    }
  });
  
  return errors;
};

/**
 * Comprehensive item validation function
 */
export const validateItemData = (itemData, isUpdate = false) => {
  const errors = [];
  
  // Required field validation
  const requiredFields = ['name', 'description', 'price', 'category', 'sku', 'stock'];
  
  requiredFields.forEach(field => {
    if (!itemData[field] && itemData[field] !== 0) {
      errors.push(new ValidationError(field, `${field} is required`, 'REQUIRED'));
    }
  });
  
  // If we have validation errors for required fields, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors: errors,
      errorsByField: groupErrorsByField(errors)
    };
  }
  
  // Validate each field
  errors.push(...validateItemName(itemData.name));
  errors.push(...validateItemDescription(itemData.description));
  errors.push(...validateItemPrice(itemData.price));
  errors.push(...validateItemCategory(itemData.category));
  errors.push(...validateItemSku(itemData.sku));
  errors.push(...validateItemStock(itemData.stock));
  
  // Optional fields
  if (itemData.weight !== undefined) {
    errors.push(...validateItemWeight(itemData.weight));
  }
  
  if (itemData.dimensions !== undefined) {
    errors.push(...validateItemDimensions(itemData.dimensions));
  }
  
  if (itemData.tags !== undefined) {
    errors.push(...validateItemTags(itemData.tags));
  }
  
  // Image validation (required for new items, optional for updates)
  if (!isUpdate || itemData.images) {
    errors.push(...validateItemImages(itemData.images));
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    errorsByField: groupErrorsByField(errors)
  };
};

/**
 * Group validation errors by field name
 */
const groupErrorsByField = (errors) => {
  return errors.reduce((acc, error) => {
    if (!acc[error.field]) {
      acc[error.field] = [];
    }
    acc[error.field].push(error);
    return acc;
  }, {});
};

/**
 * Sanitize item data for safe processing
 */
export const sanitizeItemData = (itemData) => {
  const sanitized = { ...itemData };
  
  // Trim string fields
  if (sanitized.name) sanitized.name = sanitized.name.trim();
  if (sanitized.description) sanitized.description = sanitized.description.trim();
  if (sanitized.sku) sanitized.sku = sanitized.sku.trim().toUpperCase();
  if (sanitized.category) sanitized.category = sanitized.category.toLowerCase();
  
  // Convert numeric fields
  if (sanitized.price) sanitized.price = parseFloat(sanitized.price);
  if (sanitized.stock) sanitized.stock = parseInt(sanitized.stock, 10);
  if (sanitized.weight) sanitized.weight = parseFloat(sanitized.weight);
  
  // Sanitize tags
  if (sanitized.tags && Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
  }
  
  // Sanitize dimensions
  if (sanitized.dimensions) {
    if (sanitized.dimensions.length) sanitized.dimensions.length = parseFloat(sanitized.dimensions.length);
    if (sanitized.dimensions.width) sanitized.dimensions.width = parseFloat(sanitized.dimensions.width);
    if (sanitized.dimensions.height) sanitized.dimensions.height = parseFloat(sanitized.dimensions.height);
  }
  
  return sanitized;
};

/**
 * Get validation rules for frontend form validation
 */
export const getValidationRules = () => {
  return VALIDATION_RULES;
};

/**
 * Get image validation rules
 */
export const getImageValidationRules = () => {
  return IMAGE_VALIDATION;
};

/**
 * Quick validation function for real-time form validation
 */
export const validateField = (fieldName, value, itemData = {}) => {
  switch (fieldName) {
    case 'name':
      return validateItemName(value);
    case 'description':
      return validateItemDescription(value);
    case 'price':
      return validateItemPrice(value);
    case 'category':
      return validateItemCategory(value);
    case 'sku':
      return validateItemSku(value);
    case 'stock':
      return validateItemStock(value);
    case 'weight':
      return validateItemWeight(value);
    case 'dimensions':
      return validateItemDimensions(value);
    case 'tags':
      return validateItemTags(value);
    case 'images':
      return validateItemImages(value);
    default:
      return [];
  }
};

export default {
  validateItemData,
  validateField,
  sanitizeItemData,
  getValidationRules,
  getImageValidationRules,
  ValidationError
};