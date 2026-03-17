import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orderService';
import { wishlistService } from '../../services/wishlistService';
import { userService } from '../../services/userService';
import './CustomerDashboard.css';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [ordersData, wishlistData, profileData] = await Promise.all([
        orderService.getUserOrders(user.id),
        wishlistService.getUserWishlist(user.id),
        userService.getUserProfile(user.id)
      ]);
      
      setOrders(ordersData);
      setWishlist(wishlistData);
      setUserProfile(profileData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (productId) => {
    try {
      await wishlistService.removeFromWishlist(user.id, productId);
      setWishlist(wishlist.filter(item => item.product.id !== productId));
    } catch (err) {
      setError('Failed to remove item from wishlist');
    }
  };

  const handleUpdateProfile = async (updatedData) => {
    try {
      const updatedProfile = await userService.updateProfile(user.id, updatedData);
      setUserProfile(updatedProfile);
      setError(null);
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user.firstName}!</h1>
        <p>Manage your account, orders, and wishlist</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="dashboard-nav">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="nav-icon">📊</span>
          Overview
        </button>
        <button
          className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <span className="nav-icon">📦</span>
          Orders ({orders.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('wishlist')}
        >
          <span className="nav-icon">❤️</span>
          Wishlist ({wishlist.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
          Profile
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <OverviewTab orders={orders} wishlist={wishlist} user={user} />
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} />
        )}
        {activeTab === 'wishlist' && (
          <WishlistTab 
            wishlist={wishlist} 
            onRemoveItem={handleRemoveFromWishlist}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab 
            profile={userProfile} 
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </div>
    </div>
  );
};

const OverviewTab = ({ orders, wishlist, user }) => {
  const recentOrders = orders.slice(0, 3);
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="overview-tab">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{orders.length}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>${totalSpent.toFixed(2)}</h3>
            <p>Total Spent</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❤️</div>
          <div className="stat-content">
            <h3>{wishlist.length}</h3>
            <p>Wishlist Items</p>
          </div>
        </div>
      </div>

      <div className="overview-sections">
        <div className="recent-orders">
          <h2>Recent Orders</h2>
          {recentOrders.length > 0 ? (
            <div className="orders-list">
              {recentOrders.map(order => (
                <div key={order.id} className="order-item-preview">
                  <div className="order-info">
                    <strong>#{order.id}</strong>
                    <span className="order-date">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="order-status">
                    <span className={`status ${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                    <strong>${order.total.toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No orders yet. Start shopping!</p>
          )}
        </div>

        <div className="wishlist-preview">
          <h2>Wishlist</h2>
          {wishlist.length > 0 ? (
            <div className="wishlist-grid">
              {wishlist.slice(0, 4).map(item => (
                <div key={item.id} className="wishlist-item-preview">
                  <img 
                    src={item.product.image} 
                    alt={item.product.name}
                    className="product-image"
                  />
                  <div className="product-info">
                    <h4>{item.product.name}</h4>
                    <p className="price">${item.product.price}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Your wishlist is empty</p>
          )}
        </div>
      </div>
    </div>
  );
};

const OrdersTab = ({ orders }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  
  const filteredOrders = orders.filter(order => 
    statusFilter === 'all' || order.status.toLowerCase() === statusFilter
  );

  return (
    <div className="orders-tab">
      <div className="orders-header">
        <h2>Order History</h2>
        <div className="filter-controls">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredOrders.length > 0 ? (
        <div className="orders-list">
          {filteredOrders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-number">
                  <strong>Order #{order.id}</strong>
                  <span className="order-date">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="order-status-total">
                  <span className={`status ${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                  <strong className="total">${order.total.toFixed(2)}</strong>
                </div>
              </div>
              
              <div className="order-items">
                {order.items.map(item => (
                  <div key={item.id} className="order-item">
                    <img 
                      src={item.product.image} 
                      alt={item.product.name}
                      className="item-image"
                    />
                    <div className="item-details">
                      <h4>{item.product.name}</h4>
                      <p>Quantity: {item.quantity}</p>
                      <p className="item-price">${item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-actions">
                <button className="btn-secondary">View Details</button>
                {order.status === 'delivered' && (
                  <button className="btn-primary">Reorder</button>
                )}
                {['pending', 'processing'].includes(order.status.toLowerCase()) && (
                  <button className="btn-danger">Cancel Order</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No orders found</h3>
          <p>You haven't placed any orders yet.</p>
        </div>
      )}
    </div>
  );
};

const WishlistTab = ({ wishlist, onRemoveItem }) => {
  return (
    <div className="wishlist-tab">
      <div className="wishlist-header">
        <h2>My Wishlist</h2>
        <p>{wishlist.length} items</p>
      </div>

      {wishlist.length > 0 ? (
        <div className="wishlist-grid">
          {wishlist.map(item => (
            <div key={item.id} className="wishlist-card">
              <div className="product-image-container">
                <img 
                  src={item.product.image} 
                  alt={item.product.name}
                  className="product-image"
                />
                <button 
                  className="remove-btn"
                  onClick={() => onRemoveItem(item.product.id)}
                  title="Remove from wishlist"
                >
                  ✕
                </button>
              </div>
              
              <div className="product-details">
                <h3>{item.product.name}</h3>
                <p className="product-description">
                  {item.product.description}
                </p>
                <div className="product-price">
                  <strong>${item.product.price.toFixed(2)}</strong>
                  {item.product.originalPrice && (
                    <span className="original-price">
                      ${item.product.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
                
                <div className="product-actions">
                  <button className="btn-primary">Add to Cart</button>
                  <button className="btn-secondary">View Product</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>Your wishlist is empty</h3>
          <p>Save items you love for later!</p>
          <button className="btn-primary">Continue Shopping</button>
        </div>
      )}
    </div>
  );
};

const ProfileTab = ({ profile, onUpdateProfile }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(profile || {});

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onUpdateProfile(formData);
    setEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="profile-tab">
      <div className="profile-header">
        <h2>Account Profile</h2>
        {!editing && (
          <button 
            className="btn-secondary"
            onClick={() => setEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName || ''}
              onChange={handleChange}
              disabled={!editing}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName || ''}
              onChange={handleChange}
              disabled={!editing}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            disabled={!editing}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            disabled={!editing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">Address</label>
          <textarea
            id="address"
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            disabled={!editing}
            rows="3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city || ''}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
          <div className="form-group">
            <label htmlFor="zipCode">ZIP Code</label>
            <input
              type="text"
              id="zipCode"
              name="zipCode"
              value={formData.zipCode || ''}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
        </div>

        {editing && (
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => {
                setEditing(false);
                setFormData(profile);
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CustomerDashboard;