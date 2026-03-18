import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip, 
  Avatar, 
  Pagination, 
  InputAdornment, 
  Alert, 
  Snackbar, 
  CircularProgress, 
  Card, 
  CardContent, 
  Grid, 
  Fab, 
  Tooltip,
  ConfirmationDialog
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Search as SearchIcon, 
  CloudUpload as CloudUploadIcon, 
  Image as ImageIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const ItemManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    count: '',
    image: null,
    imagePreview: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [imageUploadError, setImageUploadError] = useState('');

  // Categories for filtering
  const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Home & Garden', 'Sports'];

  // Fetch items with pagination and filters
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search: searchTerm,
        category: categoryFilter !== 'all' ? categoryFilter : ''
      });

      const response = await fetch(`/api/admin/items?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotalPages(Math.ceil((data.total || 0) / 10));
    } catch (error) {
      showNotification('Failed to fetch items', 'error');
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Item name is required';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!formData.price || formData.price <= 0) {
      errors.price = 'Valid price is required';
    }
    
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    
    if (!formData.count || formData.count < 0) {
      errors.count = 'Valid item count is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle image upload with size validation
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (200KB = 200 * 1024 bytes)
    const maxSize = 200 * 1024;
    if (file.size > maxSize) {
      setImageUploadError('Image size must be less than 200KB');
      return;
    }

    setImageUploadError('');
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: e.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      count: '',
      image: null,
      imagePreview: ''
    });
    setFormErrors({});
    setImageUploadError('');
    setEditingItem(null);
  };

  // Handle create/edit item
  const handleSaveItem = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('count', formData.count);
      
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      const url = editingItem 
        ? `/api/admin/items/${editingItem.id}`
        : '/api/admin/items';
      
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error(`Failed to ${editingItem ? 'update' : 'create'} item`);
      }

      showNotification(
        `Item ${editingItem ? 'updated' : 'created'} successfully`, 
        'success'
      );
      
      setOpenDialog(false);
      resetForm();
      fetchItems();
    } catch (error) {
      showNotification(
        `Failed to ${editingItem ? 'update' : 'create'} item`, 
        'error'
      );
      console.error('Error saving item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit item
  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      category: item.category || '',
      count: item.count || '',
      image: null,
      imagePreview: item.imageUrl || ''
    });
    setOpenDialog(true);
  };

  // Handle delete item
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/items/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      showNotification('Item deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      fetchItems();
    } catch (error) {
      showNotification('Failed to delete item', 'error');
      console.error('Error deleting item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show notification
  const showNotification = (message, severity) => {
    setNotification({ open: true, message, severity });
  };

  // Handle search
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  // Handle filter change
  const handleFilterChange = (event) => {
    setCategoryFilter(event.target.value);
    setPage(1);
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // Mobile card view for items
  const renderMobileCard = (item) => (
    <Card key={item.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            src={item.imageUrl} 
            sx={{ width: 60, height: 60, mr: 2 }}
          >
            <ImageIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h3">
              {item.name}
            </Typography>
            <Chip 
              label={item.category} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
          </Box>
          <Box>
            <IconButton 
              onClick={() => handleEditItem(item)}
              color="primary"
              size="small"
            >
              <EditIcon />
            </IconButton>
            <IconButton 
              onClick={() => {
                setItemToDelete(item);
                setDeleteConfirmOpen(true);
              }}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {item.description}
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="subtitle2">Price:</Typography>
            <Typography variant="body1">${item.price}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2">Available:</Typography>
            <Typography variant="body1">{item.count}</Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Item Management
      </Typography>

      {/* Search and Filter Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search items..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filter by Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={handleFilterChange}
                  label="Filter by Category"
                  startAdornment={<FilterIcon sx={{ mr: 1 }} />}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  resetForm();
                  setOpenDialog(true);
                }}
                sx={{ height: '56px' }}
              >
                Add Item
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Items Display */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {isMobile ? (
            // Mobile view - Cards
            <Box>
              {items.length === 0 ? (
                <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
                  No items found
                </Typography>
              ) : (
                items.map(renderMobileCard)
              )}
            </Box>
          ) : (
            // Desktop view - Table
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Image</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Available</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Avatar src={item.imageUrl} sx={{ width: 50, height: 50 }}>
                            <ImageIcon />
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{item.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.description?.substring(0, 50)}...
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.category} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </TableCell>
                        <TableCell>${item.price}</TableCell>
                        <TableCell>
                          <Chip 
                            label={item.count} 
                            size="small" 
                            color={item.count > 0 ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Edit">
                            <IconButton 
                              onClick={() => handleEditItem(item)}
                              color="primary"
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton 
                              onClick={() => {
                                setItemToDelete(item);
                                setDeleteConfirmOpen(true);
                              }}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Item Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal" error={!!formErrors.category}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    label="Category"
                  >
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  error={!!formErrors.description}
                  helperText={formErrors.description}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  error={!!formErrors.price}
                  helperText={formErrors.price}
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Available Count"
                  type="number"
                  value={formData.count}
                  onChange={(e) => setFormData(prev => ({ ...prev, count: e.target.value }))}
                  error={!!formErrors.count}
                  helperText={formErrors.count}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    sx={{ mb: 2 }}
                  >
                    Upload Image (Max 200KB)
                    <VisuallyHiddenInput
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </Button>
                  
                  {imageUploadError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {imageUploadError}
                    </Alert>
                  )}
                  
                  {formData.imagePreview && (
                    <Box sx={{ mt: 2 }}>
                      <Avatar
                        src={formData.imagePreview}
                        sx={{ width: 100, height: 100 }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setOpenDialog(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveItem}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : (editingItem ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteItem}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => {
            resetForm();
            setOpenDialog(true);
          }}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ItemManagement;