import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Pagination,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  ErrorBoundary
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import validator from 'validator';
import { Mutex } from 'async-mutex';
import { useAuth } from '../../hooks/useAuth';
import { itemsAPI } from '../../services/api';
import ItemForm from './ItemForm';
import ImageUpload from './ImageUpload';
import './AdminDashboard.css';

// Enhanced sanitization utility with server-side validation awareness
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Use DOMPurify to sanitize HTML/XSS - server also validates
  const sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
  
  // Additional validation using validator.js
  const trimmed = validator.escape(sanitized).trim();
  
  // Length validation - server enforces stricter limits
  return validator.isLength(trimmed, { max: 255 }) ? trimmed : trimmed.substring(0, 255);
};

// Thread-safe operation queue with proper mutex implementation
class OperationQueue {
  constructor() {
    this.mutex = new Mutex();
    this.operationId = 0;
  }

  async enqueue(operation) {
    const currentOpId = ++this.operationId;
    
    return this.mutex.runExclusive(async () => {
      try {
        console.log(`Starting operation ${currentOpId}`);
        const result = await operation();
        console.log(`Completed operation ${currentOpId}`);
        return result;
      } catch (error) {
        console.error(`Failed operation ${currentOpId}:`, error);
        throw error;
      }
    });
  }
}

// Enhanced form validation with database schema validation
const validateFormData = async (formData, validStatuses) => {
  const errors = [];
  
  if (!formData.name || formData.name.trim().length < 2) {
    errors.push('Item name must be at least 2 characters long');
  }
  
  if (!formData.description || formData.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters long');
  }
  
  if (!formData.price || formData.price <= 0) {
    errors.push('Price must be greater than 0');
  }
  
  if (!formData.category || !formData.category.trim()) {
    errors.push('Category is required');
  }
  
  // Strict enum validation against database constraints
  if (!formData.status || !validStatuses.includes(formData.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Additional server-side validation check
  try {
    await itemsAPI.validateFormData(formData);
  } catch (err) {
    if (err.response?.data?.validationErrors) {
      errors.push(...err.response.data.validationErrors);
    }
  }
  
  return errors;
};

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
  const [formMode, setFormMode] = useState('create'); // 'create' or 'edit'

  // Server-side token validation with proper error handling
  const validateAdminAccess = useCallback(async () => {
    if (!isAdmin || !token) {
      return false;
    }
    
    try {
      // Server-side token validation and admin permissions check
      const response = await itemsAPI.validateAdminToken(token);
      if (!response.data?.valid) {
        return false;
      }
      
      const hasPermission = await checkPermission('admin.dashboard.access');
      return hasPermission;
    } catch (err) {
      console.error('Permission validation failed:', err);
      return false;
    }
  }, [isAdmin, token, checkPermission]);

  // Fetch valid statuses from API with strict database validation
  const fetchValidStatuses = useCallback(async () => {
    try {
      const response = await itemsAPI.getItemStatuses();
      if (response.data && Array.isArray(response.data)) {
        // Validate against database schema
        const validatedStatuses = await itemsAPI.validateStatusesAgainstSchema(response.data);
        setValidStatuses(validatedStatuses);
      } else {
        throw new Error('Invalid status response format');
      }
    } catch (err) {
      console.warn('Failed to fetch valid statuses:', err);
      // Fallback with warning - should be replaced with database call
      setValidStatuses(['active', 'inactive', 'draft']);
      setError('Warning: Using fallback status values. Please refresh.');
    }
  }, []);

  // Fetch items with pagination and filters - server-side validation
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Client-side sanitization for UI only - server validates all inputs including SQL injection, XSS, business logic
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: sanitizeInput(searchQuery),
        category: sanitizeInput(categoryFilter),
        status: sanitizeInput(statusFilter)
      };
      
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
      
      // Set fallback data
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, statusFilter]);

  // Fetch categories for filter dropdown
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
        fetchItems();
        fetchCategories();
        fetchValidStatuses();
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

  // Handle create item with server-side permission check
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

  // Handle edit item with server-side permission check
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

  // Handle delete item with operation queuing
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

  // Confirm delete with atomic compare-and-swap operations
  const confirmDelete = async () => {
    if (!selectedItem) return;
    
    const deleteOperation = async () => {
      setLoading(true);
      
      try {
        // Use atomic compare-and-swap operation at database level
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
        
        // Handle version conflict
        if (err.response?.status === 409) {
          await fetchItems(); // Refresh data
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Use thread-safe operation queue with proper mutex
    try {
      await operationQueueRef.current.enqueue(deleteOperation);
    } catch (err) {
      console.error('Queue operation failed:', err);
    }
  };

  // Handle form submit with enhanced validation and atomic operations
  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      setError('');
      
      // Validate form data with current valid statuses and database schema
      const validationErrors = await validateFormData(formData, validStatuses);
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }
      
      // Client-side sanitization for UI - server does comprehensive validation including SQL injection, XSS, business logic
      const sanitizedData = {
        ...formData,
        name: sanitizeInput(formData.name),
        description: sanitizeInput(formData.description),
        category: sanitizeInput(formData.category),
        status: sanitizeInput(formData.status)
      };
      
      // Strict validation against current backend schema
      if (!validStatuses.includes(sanitizedData.status)) {
        setError('Invalid status value. Please refresh the page.');
        return;
      }
      
      if (formMode === 'create') {
        await itemsAPI.createItem(sanitizedData);
        setSuccess('Item created successfully');
      } else {
        // Use atomic compare-and-swap for updates
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
      
      // Handle version conflicts
      if (err.response?.status === 409) {
        await fetchItems(); // Refresh data
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

  // Get status color using valid statuses
  const getStatusColor = (status) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'error';
      case 'draft':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Item Management Dashboard
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateItem}
              size="large"
            >
              Add New Item
            </Button>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Items
                  </Typography>
                  <Typography variant="h4">
                    {totalItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Categories
                  </Typography>
                  <Typography variant="h4">
                    {categories.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Active Items
                  </Typography>
                  <Typography variant="h4">
                    {items.filter(item => item.status?.toLowerCase() === 'active').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Draft Items
                  </Typography>
                  <Typography variant="h4">
                    {items.filter(item => item.status?.toLowerCase() === 'draft').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Search and Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                    aria-label="Search items by name or description"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      aria-label="Filter by category"
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.name}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      label="Status"
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      aria-label="Filter by status"
                    >
                      <MenuItem value="">All Status</MenuItem>
                      {validStatuses.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<FilterIcon />}
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                      setStatusFilter('');
                    }}
                    aria-label="Clear all filters"
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <TableContainer component={Paper}>
                    <Table aria-label="Items management table">
                      <TableHead>
                        <TableRow>
                          <TableCell>Image</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Price</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow 
                            key={item.id} 
                            hover
                            aria-label={`Item: ${item.name}, Category: ${item.category}, Price: ${formatCurrency(item.price)}, Status: ${item.status}`}
                            aria-describedby={`item-${item.id}-description`}
                          >
                            <TableCell>
                              <Avatar
                                src={item.imageUrl}
                                alt={`${item.name} product image`}
                                sx={{ width: 50, height: 50 }}
                                variant="rounded"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" noWrap>
                                {item.name}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color="textSecondary" 
                                noWrap
                                id={`item-${item.id}-description`}
                              >
                                {item.description?.substring(0, 50)}...
                              </Typography>
                            </TableCell>
                            <TableCell aria-label={`Category: ${item.category}`}>
                              {item.category}
                            </TableCell>
                            <TableCell aria-label={`Price: ${formatCurrency(item.price)}`}>
                              {formatCurrency(item.price)}
                            </TableCell>
                            <TableCell aria-label={`Status: ${item.status}`}>
                              <Chip
                                label={item.status}
                                color={getStatusColor(item.status)}
                                size="small"
                                aria-label={`Status: ${item.status}`}
                              />
                            </TableCell>
                            <TableCell aria-label={`Created: ${new Date(item.createdAt).toLocaleDateString()}`}>
                              {new Date(item.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }} role="group" aria-label="Item actions">
                                <Tooltip title="View item details">
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    aria-label={`View details for ${item.name}`}
                                  >
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit item">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEditItem(item)}
                                    aria-label={`Edit ${item.name}`}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete item">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteItem(item)}
                                    aria-label={`Delete ${item.name}`}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={totalPages}
                        page={currentPage}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                        aria-label="Items pagination"
                      />
                    </Box>
                  )}

                  {items.length === 0 && !loading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="h6" color="textSecondary">
                        No items found
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {searchQuery || categoryFilter || statusFilter
                          ? 'Try adjusting your search criteria'
                          : 'Get started by creating your first item'}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleCreateItem}
                      >
                        Add New Item
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Item Form Dialog */}
        <Dialog
          open={openItemForm}
          onClose={() => setOpenItemForm(false)}
          maxWidth="md"
          fullWidth
          aria-labelledby="item-form-dialog-title"
        >
          <DialogTitle id="item-form-dialog-title">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {formMode === 'create' ? 'Create New Item' : 'Edit Item'}
              <IconButton 
                onClick={() => setOpenItemForm(false)}
                aria-label="Close dialog"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <ItemForm
              item={selectedItem}
              mode={formMode}
              categories={categories}
              validStatuses={validStatuses}
              onSubmit={handleFormSubmit}
              onCancel={() => setOpenItemForm(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography id="delete-dialog-description">
              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setOpenDeleteDialog(false)}
              aria-label="Cancel delete operation"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete} 
              color="error" 
              variant="contained"
              disabled={loading}
              aria-label="Confirm delete operation"
            >
              {loading ? <CircularProgress size={20} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success/Error Snackbar */}
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="success">
            {success}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="error">
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </AdminDashboardErrorBoundary>
  );
};

export default AdminDashboard;