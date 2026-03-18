import { z } from 'zod';

// Item status enum
export const ItemStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  ARCHIVED: 'archived'
};

// Item category enum
export const ItemCategory = {
  FOOD: 'food',
  BEVERAGE: 'beverage',
  GROCERY: 'grocery',
  PHARMACY: 'pharmacy',
  ELECTRONICS: 'electronics',
  CLOTHING: 'clothing',
  HOME: 'home',
  OTHER: 'other'
};

// Zod validation schema for Item
export const ItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Item name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.nativeEnum(ItemCategory, {
    errorMap: () => ({ message: 'Please select a valid category' })
  }),
  price: z.number().min(0, 'Price must be greater than or equal to 0').optional(),
  sku: z.string().max(100, 'SKU must be less than 100 characters').optional(),
  barcode: z.string().max(100, 'Barcode must be less than 100 characters').optional(),
  status: z.nativeEnum(ItemStatus, {
    errorMap: () => ({ message: 'Please select a valid status' })
  }).default(ItemStatus.ACTIVE),
  image_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  weight: z.number().min(0, 'Weight must be greater than or equal to 0').optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional()
  }).optional(),
  tags: z.array(z.string()).optional().default([]),
  vendor_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional()
});

// Item class with validation and utility methods
export class Item {
  constructor(data = {}) {
    // Validate and assign data
    const validatedData = ItemSchema.parse(data);
    Object.assign(this, validatedData);
    
    // Set timestamps if not provided
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Static method to create item from API response
  static fromAPI(apiData) {
    return new Item({
      ...apiData,
      // Ensure proper type conversion
      price: apiData.price ? parseFloat(apiData.price) : undefined,
      weight: apiData.weight ? parseFloat(apiData.weight) : undefined,
      dimensions: apiData.dimensions || {},
      tags: Array.isArray(apiData.tags) ? apiData.tags : []
    });
  }

  // Convert to API format
  toAPI() {
    const apiData = { ...this };
    
    // Remove undefined values
    Object.keys(apiData).forEach(key => {
      if (apiData[key] === undefined) {
        delete apiData[key];
      }
    });

    return apiData;
  }

  // Validation method
  static validate(data) {
    try {
      ItemSchema.parse(data);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
      }
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Validation failed' }]
      };
    }
  }

  // Get display name for category
  getCategoryDisplayName() {
    const categoryNames = {
      [ItemCategory.FOOD]: 'Food',
      [ItemCategory.BEVERAGE]: 'Beverage',
      [ItemCategory.GROCERY]: 'Grocery',
      [ItemCategory.PHARMACY]: 'Pharmacy',
      [ItemCategory.ELECTRONICS]: 'Electronics',
      [ItemCategory.CLOTHING]: 'Clothing',
      [ItemCategory.HOME]: 'Home & Garden',
      [ItemCategory.OTHER]: 'Other'
    };
    return categoryNames[this.category] || this.category;
  }

  // Get display name for status
  getStatusDisplayName() {
    const statusNames = {
      [ItemStatus.ACTIVE]: 'Active',
      [ItemStatus.INACTIVE]: 'Inactive',
      [ItemStatus.DRAFT]: 'Draft',
      [ItemStatus.ARCHIVED]: 'Archived'
    };
    return statusNames[this.status] || this.status;
  }

  // Get status color for UI
  getStatusColor() {
    const statusColors = {
      [ItemStatus.ACTIVE]: 'green',
      [ItemStatus.INACTIVE]: 'red',
      [ItemStatus.DRAFT]: 'yellow',
      [ItemStatus.ARCHIVED]: 'gray'
    };
    return statusColors[this.status] || 'gray';
  }

  // Check if item is active
  isActive() {
    return this.status === ItemStatus.ACTIVE;
  }

  // Format price for display
  getFormattedPrice() {
    if (this.price === undefined || this.price === null) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(this.price);
  }

  // Get formatted weight
  getFormattedWeight() {
    if (this.weight === undefined || this.weight === null) {
      return 'N/A';
    }
    return `${this.weight} lbs`;
  }

  // Get formatted dimensions
  getFormattedDimensions() {
    if (!this.dimensions || 
        (!this.dimensions.length && !this.dimensions.width && !this.dimensions.height)) {
      return 'N/A';
    }
    
    const { length = 0, width = 0, height = 0 } = this.dimensions;
    return `${length}" × ${width}" × ${height}"`;
  }

  // Clone item for editing
  clone() {
    return new Item(this.toAPI());
  }

  // Update item data
  update(data) {
    const updatedData = { ...this.toAPI(), ...data };
    const validatedData = ItemSchema.parse(updatedData);
    Object.assign(this, validatedData);
    this.updated_at = new Date().toISOString();
    return this;
  }
}

// Utility functions for item management
export const ItemUtils = {
  // Get all categories for dropdown
  getCategories() {
    return Object.values(ItemCategory).map(value => ({
      value,
      label: new Item({ category: value, name: 'temp' }).getCategoryDisplayName()
    }));
  },

  // Get all statuses for dropdown
  getStatuses() {
    return Object.values(ItemStatus).map(value => ({
      value,
      label: new Item({ status: value, name: 'temp' }).getStatusDisplayName(),
      color: new Item({ status: value, name: 'temp' }).getStatusColor()
    }));
  },

  // Filter items by search term
  filterItems(items, searchTerm) {
    if (!searchTerm) return items;
    
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.barcode?.toLowerCase().includes(term) ||
      item.tags?.some(tag => tag.toLowerCase().includes(term))
    );
  },

  // Sort items by field
  sortItems(items, field, direction = 'asc') {
    return [...items].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle undefined/null values
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      // Handle different data types
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  },

  // Create empty item for new item form
  createEmpty() {
    return {
      name: '',
      description: '',
      category: ItemCategory.OTHER,
      status: ItemStatus.DRAFT,
      price: undefined,
      sku: '',
      barcode: '',
      image_url: '',
      weight: undefined,
      dimensions: {
        length: undefined,
        width: undefined,
        height: undefined
      },
      tags: []
    };
  }
};

export default Item;