import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  FiMenu, 
  FiX, 
  FiHome, 
  FiUsers, 
  FiPackage, 
  FiBarChart3, 
  FiShoppingCart, 
  FiHeart, 
  FiUser, 
  FiLogOut,
  FiInventory,
  FiDollarSign,
  FiSettings
} from 'react-icons/fi';

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getNavigationItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/dashboard', icon: FiHome }
    ];

    const settingsItem = { name: 'Settings', href: '/dashboard/settings', icon: FiSettings };

    switch (user?.role) {
      case 'admin':
        return [
          ...baseItems,
          { name: 'User Management', href: '/dashboard/users', icon: FiUsers },
          { name: 'Product Management', href: '/dashboard/products', icon: FiPackage },
          { name: 'Analytics', href: '/dashboard/analytics', icon: FiBarChart3 },
          { name: 'Orders', href: '/dashboard/orders', icon: FiShoppingCart },
          settingsItem
        ];
      case 'vendor':
        return [
          ...baseItems,
          { name: 'My Products', href: '/dashboard/my-products', icon: FiPackage },
          { name: 'Inventory', href: '/dashboard/inventory', icon: FiInventory },
          { name: 'Sales', href: '/dashboard/sales', icon: FiDollarSign },
          { name: 'Orders', href: '/dashboard/vendor-orders', icon: FiShoppingCart },
          settingsItem
        ];
      case 'customer':
      default:
        return [
          ...baseItems,
          { name: 'Order History', href: '/dashboard/orders', icon: FiShoppingCart },
          { name: 'Wishlist', href: '/dashboard/wishlist', icon: FiHeart },
          { name: 'Account', href: '/dashboard/account', icon: FiUser },
          settingsItem
        ];
    }
  };

  const navigationItems = getNavigationItems();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-secondary shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 bg-primary">
          <h1 className="text-xl font-bold text-primary-foreground">
            {user?.role === 'admin' && 'Admin Dashboard'}
            {user?.role === 'vendor' && 'Vendor Dashboard'}
            {user?.role === 'customer' && 'My Account'}
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-primary-foreground hover:text-primary-foreground/80"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* User info */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-text-primary">{user?.name}</p>
              <p className="text-xs text-text-secondary capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.href}
                className="group flex items-center px-3 py-2 mb-1 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors duration-200"
              >
                <Icon className="flex-shrink-0 w-5 h-5 mr-3 text-text-secondary group-hover:text-text-primary" />
                {item.name}
              </a>
            );
          })}
        </nav>

        {/* Logout button */}
        <div className="absolute bottom-0 w-full p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors duration-200"
          >
            <FiLogOut className="flex-shrink-0 w-5 h-5 mr-3 text-text-secondary group-hover:text-text-primary" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top navigation bar */}
        <div className="sticky top-0 z-40 bg-surface-secondary shadow-sm border-b border-border">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                >
                  <FiMenu className="w-6 h-6" />
                </button>
                <h2 className="ml-4 text-xl font-semibold text-text-primary lg:ml-0">
                  Welcome back, {user?.name}!
                </h2>
              </div>

              {/* Quick actions */}
              <div className="flex items-center space-x-4">
                {user?.role === 'customer' && (
                  <a
                    href="/shop"
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Continue Shopping
                  </a>
                )}
                {user?.role === 'vendor' && (
                  <a
                    href="/dashboard/add-product"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
                  >
                    Add Product
                  </a>
                )}
                {user?.role === 'admin' && (
                  <a
                    href="/dashboard/analytics"
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    View Reports
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;