import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './ItemFilters.css';

const ItemFilters = ({ onFilterChange, categories, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    search: initialFilters.search || '',
    category: initialFilters.category || '',
    status: initialFilters.status || '',
    priceRange: initialFilters.priceRange || '',
    sortBy: initialFilters.sortBy || 'name',
    sortOrder: initialFilters.sortOrder || 'asc'
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange(filters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      category: '',
      status: '',
      priceRange: '',
      sortBy: 'name',
      sortOrder: 'asc'
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'discontinued', label: 'Discontinued' }
  ];

  const priceRangeOptions = [
    { value: '', label: 'All Prices' },
    { value: '0-10', label: 'Under $10' },
    { value: '10-25', label: '$10 - $25' },
    { value: '25-50', label: '$25 - $50' },
    { value: '50-100', label: '$50 - $100' },
    { value: '100+', label: 'Over $100' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'category', label: 'Category' },
    { value: 'status', label: 'Status' },
    { value: 'created_at', label: 'Date Created' },
    { value: 'updated_at', label: 'Last Modified' }
  ];

  return (
    <div className="item-filters">
      <div className="filters-header">
        <h3>Filter Items</h3>
        <button 
          className="clear-filters-btn"
          onClick={clearFilters}
          type="button"
        >
          Clear All
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="filters-form">
        <div className="filter-row">
          <div className="filter-group search-group">
            <label htmlFor="search">Search Items</label>
            <div className="search-input-wrapper">
              <input
                type="text"
                id="search"
                placeholder="Search by name or description..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="priceRange">Price Range</label>
            <select
              id="priceRange"
              value={filters.priceRange}
              onChange={(e) => handleFilterChange('priceRange', e.target.value)}
            >
              {priceRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="sortBy">Sort By</label>
            <select
              id="sortBy"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sortOrder">Order</label>
            <select
              id="sortOrder"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </form>

      <div className="active-filters">
        {filters.search && (
          <span className="filter-tag">
            Search: "{filters.search}"
            <button onClick={() => handleFilterChange('search', '')}>×</button>
          </span>
        )}
        {filters.category && (
          <span className="filter-tag">
            Category: {categories.find(c => c.id === filters.category)?.name}
            <button onClick={() => handleFilterChange('category', '')}>×</button>
          </span>
        )}
        {filters.status && (
          <span className="filter-tag">
            Status: {statusOptions.find(s => s.value === filters.status)?.label}
            <button onClick={() => handleFilterChange('status', '')}>×</button>
          </span>
        )}
        {filters.priceRange && (
          <span className="filter-tag">
            Price: {priceRangeOptions.find(p => p.value === filters.priceRange)?.label}
            <button onClick={() => handleFilterChange('priceRange', '')}>×</button>
          </span>
        )}
      </div>
    </div>
  );
};

ItemFilters.propTypes = {
  onFilterChange: PropTypes.func.isRequired,
  categories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  initialFilters: PropTypes.shape({
    search: PropTypes.string,
    category: PropTypes.string,
    status: PropTypes.string,
    priceRange: PropTypes.string,
    sortBy: PropTypes.string,
    sortOrder: PropTypes.string
  })
};

export default ItemFilters;