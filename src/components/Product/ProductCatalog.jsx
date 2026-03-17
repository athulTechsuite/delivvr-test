import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useTheme } from '../../contexts/ThemeContext';
import './ProductCatalog.css';

const ProductCatalog = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { theme } = useTheme();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, priceRange, searchTerm, sortBy]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by price range
    filtered = filtered.filter(product => 
      product.price >= priceRange.min && product.price <= priceRange.max
    );

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  };

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product, 1);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  };

  const handlePriceRangeChange = (type, value) => {
    setPriceRange(prev => ({
      ...prev,
      [type]: parseInt(value)
    }));
  };

  const ProductCard = ({ product }) => (
    <div className={`product-card ${theme}`}>
      <div className="product-image-container">
        <img 
          src={product.image || '/images/placeholder-product.jpg'} 
          alt={product.name}
          className="product-image"
        />
        {product.discount && (
          <span className={`product-discount ${theme}`}>-{product.discount}%</span>
        )}
      </div>
      
      <div className={`product-info ${theme}`}>
        <h3 className={`product-name ${theme}`}>{product.name}</h3>
        <p className={`product-description ${theme}`}>{product.description}</p>
        
        <div className={`product-rating ${theme}`}>
          {[...Array(5)].map((_, i) => (
            <span 
              key={i} 
              className={`star ${i < (product.rating || 0) ? 'filled' : ''} ${theme}`}
            >
              ★
            </span>
          ))}
          <span className={`rating-count ${theme}`}>({product.reviewCount || 0})</span>
        </div>

        <div className="product-price-container">
          {product.originalPrice && product.originalPrice > product.price && (
            <span className={`original-price ${theme}`}>${product.originalPrice.toFixed(2)}</span>
          )}
          <span className={`product-price ${theme}`}>${product.price.toFixed(2)}</span>
        </div>

        <div className="product-actions">
          <button 
            className={`btn-add-cart ${theme}`}
            onClick={() => handleAddToCart(product)}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
          {user && (
            <button className={`btn-wishlist ${theme}`}>
              ♡
            </button>
          )}
        </div>

        {product.stock > 0 && product.stock <= 5 && (
          <p className={`stock-warning ${theme}`}>Only {product.stock} left in stock!</p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`catalog-loading ${theme}`}>
        <div className={`loading-spinner ${theme}`}></div>
        <p className={theme}>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`catalog-error ${theme}`}>
        <h3 className={theme}>Error Loading Products</h3>
        <p className={theme}>{error}</p>
        <button onClick={fetchProducts} className={`btn-retry ${theme}`}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`product-catalog ${theme}`}>
      <div className={`catalog-header ${theme}`}>
        <h2 className={theme}>Product Catalog</h2>
        <p className={theme}>Discover our amazing products</p>
      </div>

      <div className={`catalog-filters ${theme}`}>
        <div className="filter-section">
          <div className="filter-group">
            <label htmlFor="search" className={theme}>Search Products</label>
            <input
              id="search"
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`search-input ${theme}`}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="category" className={theme}>Category</label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`filter-select ${theme}`}
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort" className={theme}>Sort By</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`filter-select ${theme}`}
            >
              <option value="name">Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          <div className="filter-group price-range">
            <label className={theme}>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={priceRange.min}
                onChange={(e) => handlePriceRangeChange('min', e.target.value)}
                className={`price-input ${theme}`}
              />
              <span className={theme}>to</span>
              <input
                type="number"
                placeholder="Max"
                value={priceRange.max}
                onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                className={`price-input ${theme}`}
              />
            </div>
          </div>
        </div>

        <div className={`results-info ${theme}`}>
          <span className={theme}>{filteredProducts.length} products found</span>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className={`no-products ${theme}`}>
          <h3 className={theme}>No Products Found</h3>
          <p className={theme}>Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;