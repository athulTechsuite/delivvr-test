import React, { useState, useEffect, useCallback } from 'react';
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
  Avatar
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
import { useAuth } from '../../hooks/useAuth';
import { itemsAPI } from '../../services/api';
import ItemForm from './ItemForm';
import ImageUpload from './ImageUpload';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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

  // Fetch items with pagination and filters
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter
      };
      
      const response = await itemsAPI.getItems(params);
      setItems(response.data.items);
      setTotalPages(response.data.totalPages);
      setTotalItems(response.data.totalItems);
    } catch (err) {
      setError('Failed to fetch items');
      console.error('Fetch items error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, statusFilter]);

  // Fetch categories for filter dropdown
  const fetchCategories = useCallback(async () => {
    try {
      const response = await itemsAPI.getCategories();
      setCategories(response.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchItems();
      fetchCategories();
    }
  }, [isAdmin, fetchItems, fetchCategories]);

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
    if (filterType === 'category') {
      setCategoryFilter(value);
    } else if (filterType === 'status') {
      setStatusFilter(value);
    }
  };

  // Handle page change
  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  // Handle create item
  const handleCreateItem = () => {
    setSelectedItem(null);
    setFormMode('create');
    setOpenItemForm(true);
  };

  // Handle edit item
  const handleEditItem = (item) => {
    setSelectedItem(item);
    setFormMode('edit');
    setOpenItemForm(true);
  };

  // Handle delete item
  const handleDeleteItem = (item) => {
    setSelectedItem(item);
    setOpenDeleteDialog(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      setLoading(true);
      await itemsAPI.deleteItem(selectedItem.id);
      setSuccess('Item deleted successfully');
      fetchItems();
      setOpenDeleteDialog(false);
      setSelectedItem(null);
    } catch (err) {
      setError('Failed to delete item');
      console.error('Delete item error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit
  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      if (formMode === 'create') {
        await itemsAPI.createItem(formData);
        setSuccess('Item created successfully');
      } else {
        await itemsAPI.updateItem(selectedItem.id, formData);
        setSuccess('Item updated successfully');
      }
      fetchItems();
      setOpenItemForm(false);
      setSelectedItem(null);
    } catch (err) {
      setError(`Failed to ${formMode} item`);
      console.error(`${formMode} item error:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Handle close snackbar
  const handleCloseSnackbar = () => {
    setError('');
    setSuccess('');
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
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

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Access denied. Administrator privileges required.
        </Alert>
      </Container>
    );
  }

  return (
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
                  {items.filter(item => item.status === 'active').length}
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
                  {items.filter(item => item.status === 'draft').length}
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
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Category"
                    onChange={(e) => handleFilterChange('category', e.target.value)}
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
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
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
                  <Table>
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
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Avatar
                              src={item.imageUrl}
                              alt={item.name}
                              sx={{ width: 50, height: 50 }}
                              variant="rounded"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle2" noWrap>
                              {item.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" noWrap>
                              {item.description?.substring(0, 50)}...
                            </Typography>
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.status}
                              color={getStatusColor(item.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View">
                                <IconButton size="small" color="primary">
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteItem(item)}
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
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {formMode === 'create' ? 'Create New Item' : 'Edit Item'}
            <IconButton onClick={() => setOpenItemForm(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <ItemForm
            item={selectedItem}
            mode={formMode}
            categories={categories}
            onSubmit={handleFormSubmit}
            onCancel={() => setOpenItemForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained"
            disabled={loading}
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
  );
};

export default AdminDashboard;