-- Migration: Create products table
-- This table stores all product information for the eCommerce catalog

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price DECIMAL(10, 2) NOT NULL,
    compare_price DECIMAL(10, 2), -- Original price for discounts
    cost_price DECIMAL(10, 2), -- Cost to vendor/store
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    track_inventory BOOLEAN DEFAULT true,
    inventory_quantity INTEGER DEFAULT 0,
    allow_backorder BOOLEAN DEFAULT false,
    weight DECIMAL(8, 2), -- in grams
    length DECIMAL(8, 2), -- in cm
    width DECIMAL(8, 2), -- in cm  
    height DECIMAL(8, 2), -- in cm
    category_id UUID,
    brand VARCHAR(100),
    tags TEXT[], -- Array of tags for search/filtering
    images TEXT[], -- Array of image URLs
    featured_image TEXT, -- Main product image
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    is_featured BOOLEAN DEFAULT false,
    seo_title VARCHAR(255),
    seo_description VARCHAR(500),
    slug VARCHAR(255) UNIQUE NOT NULL,
    vendor_id UUID, -- Reference to users table for vendor role
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_description ON products USING gin(to_tsvector('english', description));

-- Add foreign key constraints (will be added after related tables are created)
-- ALTER TABLE products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
-- ALTER TABLE products ADD CONSTRAINT fk_products_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample products for development
INSERT INTO products (name, description, short_description, price, compare_price, sku, inventory_quantity, category_id, brand, tags, featured_image, status, is_featured, slug) VALUES
('Premium Wireless Headphones', 'High-quality wireless headphones with noise cancellation and premium sound quality. Perfect for music lovers and professionals.', 'Premium wireless headphones with noise cancellation', 299.99, 399.99, 'WH-001', 50, null, 'AudioTech', ARRAY['electronics', 'audio', 'wireless', 'premium'], '/images/headphones-1.jpg', 'active', true, 'premium-wireless-headphones'),
('Organic Cotton T-Shirt', 'Comfortable organic cotton t-shirt made from sustainable materials. Available in multiple colors and sizes.', 'Comfortable organic cotton t-shirt', 29.99, 39.99, 'TS-001', 100, null, 'EcoWear', ARRAY['clothing', 'organic', 'cotton', 'sustainable'], '/images/tshirt-1.jpg', 'active', false, 'organic-cotton-t-shirt'),
('Smart Fitness Watch', 'Advanced fitness tracking watch with heart rate monitor, GPS, and smartphone connectivity.', 'Smart fitness watch with advanced tracking', 199.99, 249.99, 'SW-001', 25, null, 'FitTech', ARRAY['electronics', 'fitness', 'smartwatch', 'health'], '/images/smartwatch-1.jpg', 'active', true, 'smart-fitness-watch'),
('Artisan Coffee Beans', 'Premium single-origin coffee beans roasted to perfection. Rich flavor with notes of chocolate and caramel.', 'Premium single-origin artisan coffee beans', 24.99, null, 'CF-001', 200, null, 'RoastMaster', ARRAY['coffee', 'organic', 'premium', 'single-origin'], '/images/coffee-1.jpg', 'active', false, 'artisan-coffee-beans'),
('Professional Chef Knife', 'High-carbon steel chef knife with ergonomic handle. Perfect for professional and home cooking.', 'Professional grade chef knife', 89.99, 120.00, 'CK-001', 30, null, 'ChefPro', ARRAY['kitchen', 'cooking', 'professional', 'steel'], '/images/knife-1.jpg', 'active', false, 'professional-chef-knife');