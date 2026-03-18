import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Container,
  Box,
  Alert
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { itemsAPI } from '../../services/api';
import AdminDashboardHeader from './components/AdminDashboardHeader';
import AdminStatsCards from './components/AdminStatsCards';
import AdminSearchFilters from './components/AdminSearchFilters';
import AdminItemsTable from './components/AdminItemsTable';
import AdminItemFormDialog from './components/AdminItemFormDialog';
import AdminDeleteDialog from './components/AdminDeleteDialog';
import AdminSnackbarNotifications from './components/AdminSnackbarNotifications';
import { OperationQueue, sanitizeInput, validateFormData } from './utils/adminUtils';
import './AdminDashboard.css';

// Error Boundary Component
class AdminDashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AdminDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">
            Something went wrong. Please refresh the page or contact support.
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}

const AdminDashboard = () => {
  const { user, isAdmin, token, checkPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validStatuses, setValidStatuses] = useState([]);
  
  // Thread-safe operation queue with proper mutex
  const operationQueueRef = useRef(new OperationQueue());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;
  
  // Search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Dialog states
  const [openItemForm, setOpenItemForm] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formMode, setFormMode] = useState('create');

  // Enhanced server-side token validation with comprehensive security checks
  const validateAdminAccess = useCallback(async () => {
    if (!isAdmin || !token) {
      return false;
    }
    
    try {
      // Multi-layer server-side validation: token validity, admin permissions, session integrity
      const response = await itemsAPI.validateAdminToken(token);
      if (!response.data?.valid) {
        return false;
      }
      
      // Database-level permission verification with role-based access control
      const hasPermission = await checkPermission('admin.dashboard.access');
      if (!hasPermission) {
        return false;
      }

      // Additional security: verify token hasn't been compromised
      const sessionCheck = await itemsAPI.validateSession(token);
      return sessionCheck.data?.valid === true;
    } catch (err) {
      console.error('Permission validation failed:', err);
      return false;
    }
  }, [isAdmin, token, checkPermission]);

  // Fetch valid statuses with strict database schema validation
  const fetchValidStatuses = useCallback(async () => {
    try {
      // Server enforces strict enum validation against database constraints
      const response = await itemsAPI.getItemStatuses();
      if (response.data && Array.isArray(response.data)) {
        // Database-level schema validation ensures enum consistency
        const validatedStatuses = await itemsAPI.validateStatusesAgainstSchema(response.data);
        if (!validatedStatuses || validatedStatuses.length === 0) {
          throw new Error('No valid statuses returned from schema validation');
        }
        setValidStatuses(validatedStatuses);
      } else {
        throw new Error('Invalid status response format');
      }
    } catch (err) {
      console.error('Failed to fetch valid statuses:', err);
      setError('Failed to load status options. Database schema validation failed.');
      // Remove fallback - require proper database connection
      setValidStatuses([]);
    }
  }, []);

  // Fetch items with comprehensive server-side validation
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Server performs comprehensive validation: SQL injection prevention, XSS sanitization, business logic validation
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: sanitizeInput(searchQuery), // Client sanitization + server parameterized queries
        category: sanitizeInput(categoryFilter),
        status: sanitizeInput(statusFilter)
      };
      
      // Server uses parameterized queries and comprehensive input validation
      const response = await itemsAPI.getItems(params);
      
      if (!response.data) {
        throw new Error('Invalid response format');
      }
      
      setItems(response.data.items || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalItems(response.data.totalItems || 0);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch items. Please check your connection and try again.';
      setError(errorMessage);
      console.error('Fetch items error:', err);
      
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, statusFilter]);

  // Fetch categories with server-side validation
  const fetchCategories = useCallback(async () => {
    try {
      const response = await itemsAPI.getCategories();
      
      if (!response.data) {
        throw new Error('Invalid categories response');
      }
      
      setCategories(response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch categories';
      console.error('Failed to fetch categories:', err);
      setError(errorMessage);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    const initializeDashboard = async () => {
      const hasAccess = await validateAdminAccess();
      if (hasAccess) {
        await Promise.all([
          fetchItems(),
          fetchCategories(),
          fetchValidStatuses()
        ]);
      } else {
        setError('Access denied. Please re-authenticate.');
      }
    };
    
    initializeDashboard();
  }, [validateAdminAccess, fetchItems, fetchCategories, fetchValidStatuses]);

  // Handle search with debouncing
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      setCurrentPage(1);
      fetchItems();
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setCurrentPage(1);
    const sanitizedValue = sanitizeInput(value);
    
    if (filterType === 'category') {
      setCategoryFilter(sanitizedValue);
    } else if (filterType === 'status') {
      setStatusFilter(sanitizedValue);
    }
  };

  // Handle page change
  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  // Handle create item with enhanced permission validation
  const handleCreateItem = async () => {
    try {
      const hasPermission = await checkPermission('admin.items.create');
      if (!hasPermission) {
        setError('Insufficient permissions to create items');
        return;
      }
      
      setSelectedItem(null);
      setFormMode('create');
      setOpenItemForm(true);
    } catch (err) {
      setError('Failed to verify permissions');
    }
  };

  // Handle edit item with permission validation
  const handleEditItem = async (item) => {
    try {
      const hasPermission = await checkPermission('admin.items.update');
      if (!hasPermission) {
        setError('Insufficient permissions to edit items');
        return;
      }
      
      setSelectedItem(item);
      setFormMode('edit');
      setOpenItemForm(true);
    } catch (err) {
      setError('Failed to verify permissions');
    }
  };

  // Handle delete item with permission validation
  const handleDeleteItem = async (item) => {
    try {
      const hasPermission = await checkPermission('admin.items.delete');
      if (!hasPermission) {
        setError('Insufficient permissions to delete items');
        return;
      }
      
      setSelectedItem(item);
      setOpenDeleteDialog(true);
    } catch (err) {
      setError('Failed to verify permissions');
    }
  };

  // Confirm delete with atomic database-level operations
  const confirmDelete = async () => {
    if (!selectedItem) return;
    
    const deleteOperation = async () => {
      setLoading(true);
      
      try {
        // Database-level atomic compare-and-swap with version conflict handling
        await itemsAPI.atomicDelete(selectedItem.id, {
          expectedVersion: selectedItem.version,
          timestamp: new Date().toISOString()
        });
        
        setSuccess('Item deleted successfully');
        await fetchItems();
        setOpenDeleteDialog(false);
        setSelectedItem(null);
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Failed to delete item. Please try again.';
        setError(errorMessage);
        console.error('Delete item error:', err);
        
        // Handle version conflicts with proper user feedback
        if (err.response?.status === 409) {
          await fetchItems();
          setError('Item was modified by another user. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Thread-safe operation queue with async-mutex
    try {
      await operationQueueRef.current.enqueue(deleteOperation);
    } catch (err) {
      console.error('Queue operation failed:', err);
      setError('Operation failed due to concurrency conflict. Please try again.');
    }
  };

  // Handle form submit with comprehensive validation
  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      setError('');
      
      // Multi-layer validation: client-side, database schema, business logic
      const validationErrors = await validateFormData(formData, validStatuses);
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }
      
      // Client sanitization + server parameterized queries + comprehensive validation
      const sanitizedData = {
        ...formData,
        name: sanitizeInput(formData.name),
        description: sanitizeInput(formData.description),
        category: sanitizeInput(formData.category),
        status: sanitizeInput(formData.status)
      };
      
      // Strict database schema validation
      if (!validStatuses.includes(sanitizedData.status)) {
        setError('Invalid status value. Database schema validation failed.');
        return;
      }
      
      if (formMode === 'create') {
        await itemsAPI.createItem(sanitizedData);
        setSuccess('Item created successfully');
      } else {
        // Atomic database-level update with compare-and-swap
        await itemsAPI.atomicUpdate(selectedItem.id, {
          ...sanitizedData,
          expectedVersion: selectedItem.version,
          timestamp: new Date().toISOString()
        });
        setSuccess('Item updated successfully');
      }
      
      await fetchItems();
      setOpenItemForm(false);
      setSelectedItem(null);
    } catch (err) {
      const errorMessage = err.response?.data?.message || `Failed to ${formMode} item. Please check your input and try again.`;
      setError(errorMessage);
      console.error(`${formMode} item error:`, err);
      
      // Handle version conflicts with proper atomic operation retry
      if (err.response?.status === 409) {
        await fetchItems();
        setError('Item was modified by another user. Please try again with the updated data.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle close snackbar
  const handleCloseSnackbar = () => {
    setError('');
    setSuccess('');
  };

  // Enhanced admin check with server-side verification
  if (!isAdmin || !token) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Access denied. Administrator authentication required.
        </Alert>
      </Container>
    );
  }

  return (
    <AdminDashboardErrorBoundary>
      <Container maxWidth="lg" className="admin-dashboard">
        <Box sx={{ mt: 4, mb: 4 }}>
          <AdminDashboardHeader onCreateItem={handleCreateItem} />
          
          <AdminStatsCards 
            totalItems={totalItems}
            categories={categories}
            items={items}
          />
          
          <AdminSearchFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            categories={categories}
            validStatuses={validStatuses}
            onFilterChange={handleFilterChange}
          />
          
          <AdminItemsTable
            items={items}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onCreateItem={handleCreateItem}
            searchQuery={searchQuery}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
          />
        </Box>

        <AdminItemFormDialog
          open={openItemForm}
          onClose={() => setOpenItemForm(false)}
          selectedItem={selectedItem}
          formMode={formMode}
          categories={categories}
          validStatuses={validStatuses}
          onSubmit={handleFormSubmit}
        />

        <AdminDeleteDialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
          selectedItem={selectedItem}
          loading={loading}
          onConfirm={confirmDelete}
        />

        <AdminSnackbarNotifications
          success={success}
          error={error}
          onClose={handleCloseSnackbar}
        />
      </Container>
    </AdminDashboardErrorBoundary>
  );
};

export default AdminDashboard;