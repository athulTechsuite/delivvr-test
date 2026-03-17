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
  FiSun,
  FiMoon,
  FiSettings
} from 'react-icons/fi';

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 bg-indigo-600 dark:bg-indigo-700">
          <h1 className="text-xl font-bold text-white">
            {user?.role === 'admin' && 'Admin Dashboard'}
            {user?.role === 'vendor' && 'Vendor Dashboard'}
            {user?.role === 'customer' && 'My Account'}
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-200 transition-colors duration-200"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* User info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={toggleTheme}
            className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <FiMoon className="flex-shrink-0 w-5 h-5 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
            ) : (
              <FiSun className="flex-shrink-0 w-5 h-5 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
            )}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3 flex-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.href}
                className="group flex items-center px-3 py-2 mb-1 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <Icon className="flex-shrink-0 w-5 h-5 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                {item.name}
              </a>
            );
          })}
        </nav>

        {/* Logout button */}
        <div className="absolute bottom-0 w-full p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={handleLogout}
            className="group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <FiLogOut className="flex-shrink-0 w-5 h-5 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top navigation bar */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  aria-label="Open sidebar"
                >
                  <FiMenu className="w-6 h-6" />
                </button>
                <h2 className="ml-4 text-xl font-semibold text-gray-900 dark:text-gray-100 lg:ml-0">
                  Welcome back, {user?.name}!
                </h2>
              </div>

              {/* Quick actions */}
              <div className="flex items-center space-x-4">
                {user?.role === 'customer' && (
                  <a
                    href="/shop"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors duration-200"
                  >
                    Continue Shopping
                  </a>
                )}
                {user?.role === 'vendor' && (
                  <a
                    href="/dashboard/add-product"
                    className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors duration-200"
                  >
                    Add Product
                  </a>
                )}
                {user?.role === 'admin' && (
                  <a
                    href="/dashboard/analytics"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors duration-200"
                  >
                    View Reports
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;