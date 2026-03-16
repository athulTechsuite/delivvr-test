// Role definitions
export const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  VENDOR: 'vendor'
};

// Permission definitions
export const PERMISSIONS = {
  // Product permissions
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCT: 'create_product',
  EDIT_PRODUCT: 'edit_product',
  DELETE_PRODUCT: 'delete_product',
  MANAGE_INVENTORY: 'manage_inventory',
  
  // User permissions
  VIEW_USERS: 'view_users',
  CREATE_USER: 'create_user',
  EDIT_USER: 'edit_user',
  DELETE_USER: 'delete_user',
  MANAGE_ROLES: 'manage_roles',
  
  // Order permissions
  VIEW_ORDERS: 'view_orders',
  CREATE_ORDER: 'create_order',
  EDIT_ORDER: 'edit_order',
  CANCEL_ORDER: 'cancel_order',
  VIEW_ALL_ORDERS: 'view_all_orders',
  
  // Analytics permissions
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_SALES_REPORTS: 'view_sales_reports',
  
  // Dashboard permissions
  ACCESS_ADMIN_DASHBOARD: 'access_admin_dashboard',
  ACCESS_VENDOR_DASHBOARD: 'access_vendor_dashboard',
  ACCESS_CUSTOMER_DASHBOARD: 'access_customer_dashboard',
  
  // Payment permissions
  PROCESS_PAYMENTS: 'process_payments',
  MANAGE_REFUNDS: 'manage_refunds'
};

// Role-based permissions mapping
export const ROLE_PERMISSIONS = {
  [ROLES.CUSTOMER]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.CANCEL_ORDER,
    PERMISSIONS.ACCESS_CUSTOMER_DASHBOARD
  ],
  
  [ROLES.VENDOR]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDER,
    PERMISSIONS.VIEW_SALES_REPORTS,
    PERMISSIONS.ACCESS_VENDOR_DASHBOARD
  ],
  
  [ROLES.ADMIN]: [
    // All permissions
    ...Object.values(PERMISSIONS)
  ]
};

// Check if user has specific permission
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) {
    return false;
  }
  
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions && rolePermissions.includes(permission);
};

// Check if user has any of the specified permissions
export const hasAnyPermission = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) {
    return false;
  }
  
  return permissions.some(permission => hasPermission(userRole, permission));
};

// Check if user has all of the specified permissions
export const hasAllPermissions = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) {
    return false;
  }
  
  return permissions.every(permission => hasPermission(userRole, permission));
};

// Get all permissions for a role
export const getRolePermissions = (userRole) => {
  return ROLE_PERMISSIONS[userRole] || [];
};

// Check if user can access specific dashboard
export const canAccessDashboard = (userRole, dashboardType) => {
  const dashboardPermissions = {
    admin: PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
    vendor: PERMISSIONS.ACCESS_VENDOR_DASHBOARD,
    customer: PERMISSIONS.ACCESS_CUSTOMER_DASHBOARD
  };
  
  return hasPermission(userRole, dashboardPermissions[dashboardType]);
};

// Get default dashboard route for user role
export const getDefaultDashboard = (userRole) => {
  const dashboardRoutes = {
    [ROLES.ADMIN]: '/admin/dashboard',
    [ROLES.VENDOR]: '/vendor/dashboard',
    [ROLES.CUSTOMER]: '/customer/dashboard'
  };
  
  return dashboardRoutes[userRole] || '/';
};

// Check if role is valid
export const isValidRole = (role) => {
  return Object.values(ROLES).includes(role);
};

// Get role hierarchy (higher number = more privileges)
export const getRoleLevel = (role) => {
  const roleLevels = {
    [ROLES.CUSTOMER]: 1,
    [ROLES.VENDOR]: 2,
    [ROLES.ADMIN]: 3
  };
  
  return roleLevels[role] || 0;
};

// Check if user role has higher or equal privileges than required role
export const hasRoleLevel = (userRole, requiredRole) => {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
};

export default {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  canAccessDashboard,
  getDefaultDashboard,
  isValidRole,
  getRoleLevel,
  hasRoleLevel
};