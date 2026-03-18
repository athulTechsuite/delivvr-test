class Item {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.price = data.price || 0;
    this.category = data.category || '';
    this.imageUrl = data.imageUrl || '';
    this.availableCount = data.availableCount || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Validation methods
  validate() {
    const errors = {};

    if (!this.name || this.name.trim().length === 0) {
      errors.name = 'Item name is required';
    } else if (this.name.trim().length < 2) {
      errors.name = 'Item name must be at least 2 characters long';
    } else if (this.name.trim().length > 100) {
      errors.name = 'Item name must be less than 100 characters';
    }

    if (!this.description || this.description.trim().length === 0) {
      errors.description = 'Item description is required';
    } else if (this.description.trim().length < 10) {
      errors.description = 'Item description must be at least 10 characters long';
    } else if (this.description.trim().length > 500) {
      errors.description = 'Item description must be less than 500 characters';
    }

    if (!this.price || this.price <= 0) {
      errors.price = 'Price must be greater than 0';
    } else if (this.price > 999999.99) {
      errors.price = 'Price must be less than $999,999.99';
    }

    if (!this.category || this.category.trim().length === 0) {
      errors.category = 'Category is required';
    }

    if (this.availableCount < 0) {
      errors.availableCount = 'Available count cannot be negative';
    }

    if (this.availableCount > 99999) {
      errors.availableCount = 'Available count must be less than 100,000';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Static validation for image files
  static validateImage(file) {
    const errors = [];
    const maxSize = 200 * 1024; // 200KB in bytes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!file) {
      errors.push('Image file is required');
      return { isValid: false, errors };
    }

    if (file.size > maxSize) {
      errors.push('Image file size must be less than 200KB');
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push('Image must be in JPEG, PNG, WebP, or GIF format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Data transformation methods
  toJSON() {
    return {
      id: this.id,
      name: this.name.trim(),
      description: this.description.trim(),
      price: parseFloat(this.price),
      category: this.category.trim(),
      imageUrl: this.imageUrl,
      availableCount: parseInt(this.availableCount),
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Create a copy of the item for editing
  clone() {
    return new Item(this.toJSON());
  }

  // Update item properties
  update(data) {
    this.name = data.name || this.name;
    this.description = data.description || this.description;
    this.price = data.price || this.price;
    this.category = data.category || this.category;
    this.imageUrl = data.imageUrl || this.imageUrl;
    this.availableCount = data.availableCount !== undefined ? data.availableCount : this.availableCount;
    this.isActive = data.isActive !== undefined ? data.isActive : this.isActive;
    this.updatedAt = new Date().toISOString();
  }

  // Helper methods
  isInStock() {
    return this.availableCount > 0;
  }

  isLowStock(threshold = 5) {
    return this.availableCount <= threshold && this.availableCount > 0;
  }

  getFormattedPrice() {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(this.price);
  }

  getStockStatus() {
    if (this.availableCount === 0) {
      return 'out-of-stock';
    } else if (this.isLowStock()) {
      return 'low-stock';
    }
    return 'in-stock';
  }

  getStockStatusLabel() {
    const status = this.getStockStatus();
    switch (status) {
      case 'out-of-stock':
        return 'Out of Stock';
      case 'low-stock':
        return 'Low Stock';
      default:
        return 'In Stock';
    }
  }

  // Static factory methods
  static fromAPI(apiData) {
    return new Item({
      id: apiData.id,
      name: apiData.name,
      description: apiData.description,
      price: apiData.price,
      category: apiData.category,
      imageUrl: apiData.image_url || apiData.imageUrl,
      availableCount: apiData.available_count || apiData.availableCount,
      isActive: apiData.is_active !== undefined ? apiData.is_active : apiData.isActive,
      createdAt: apiData.created_at || apiData.createdAt,
      updatedAt: apiData.updated_at || apiData.updatedAt
    });
  }

  static createEmpty() {
    return new Item({
      name: '',
      description: '',
      price: 0,
      category: '',
      imageUrl: '',
      availableCount: 0,
      isActive: true
    });
  }

  // API payload transformation
  toAPIPayload() {
    return {
      name: this.name.trim(),
      description: this.description.trim(),
      price: parseFloat(this.price),
      category: this.category.trim(),
      image_url: this.imageUrl,
      available_count: parseInt(this.availableCount),
      is_active: this.isActive
    };
  }
}

export default Item;