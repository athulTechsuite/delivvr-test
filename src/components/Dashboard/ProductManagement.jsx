import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Alert,
  Snackbar,
  Fab,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Tooltip,
  CircularProgress,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

// Mock data - replace with actual API calls
const mockProducts = [
  {
    id: 1,
    name: 'Premium Coffee Beans',
    description: 'High-quality arabica coffee beans from Ethiopia',
    category: 'Beverages',
    price: 24.99,
    stock: 150,
    status: 'active',
    imageUrl: '/api/placeholder/100/100',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T14:22:00Z'
  },
  {
    id: 2,
    name: 'Organic Green Tea',
    description: 'Premium organic green tea leaves',
    category: 'Beverages',
    price: 18.50,
    stock: 75,
    status: 'active',
    imageUrl: '/api/placeholder/100/100',
    createdAt: '2024-01-16T09:15:00Z',
    updatedAt: '2024-01-18T11:45:00Z'
  },
  {
    id: 3,
    name: 'Artisan Chocolate Bar',
    description: 'Handcrafted dark chocolate with sea salt',
    category: 'Confectionery',
    price: 12.99,
    stock: 0,
    status: 'inactive',
    imageUrl: '/api/placeholder/100/100',
    createdAt: '2024-01-10T16:20:00Z',
    updatedAt: '2024-01-22T08:30:00Z'
  }
];

const categories = ['Beverages', 'Confectionery', 'Bakery', 'Dairy', 'Meat', 'Vegetables', 'Fruits'];

const ProductManagement = () => {
  const [products, setProducts] = useState(mockProducts);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Dialog states
  const [openAddEdit, setOpenAddEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openBulkDelete, setOpenBulkDelete] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);

  // Menu states
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuProductId, setMenuProductId] = useState(null);

  // Notification states
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Form validation schema
  const validationSchema = Yup.object({
    name: Yup.string().required('Product name is required').min(2, 'Name must be at least 2 characters'),
    description: Yup.string().required('Description is required').min(10, 'Description must be at least 10 characters'),
    category: Yup.string().required('Category is required'),
    price: Yup.number().required('Price is required').min(0.01, 'Price must be greater than 0'),
    stock: Yup.number().required('Stock is required').min(0, 'Stock cannot be negative'),
    status: Yup.string().required('Status is required')
  });

  // Form handling
  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      category: '',
      price: '',
      stock: '',
      status: 'active',
      imageUrl: ''
    },
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        setLoading(true);
        
        if (editingProduct) {
          // Update existing product
          const updatedProducts = products.map(product =>
            product.id === editingProduct.id
              ? { ...product, ...values, updatedAt: new Date().toISOString() }
              : product
          );
          setProducts(updatedProducts);
          showNotification('Product updated successfully', 'success');
        } else {
          // Add new product
          const newProduct = {
            ...values,
            id: Math.max(...products.map(p => p.id)) + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setProducts([newProduct, ...products]);
          showNotification('Product added successfully', 'success');
        }
        
        resetForm();
        setOpenAddEdit(false);
        setEditingProduct(null);
      } catch (error) {
        showNotification('Error saving product', 'error');
      } finally {
        setLoading(false);
      }
    }
  });

  // Load product data for editing
  useEffect(() => {
    if (editingProduct) {
      formik.setValues({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        category: editingProduct.category || '',
        price: editingProduct.price || '',
        stock: editingProduct.stock || '',
        status: editingProduct.status || 'active',
        imageUrl: editingProduct.imageUrl || ''
      });
    }
  }, [editingProduct]);

  // Filter and search products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesStatus = !statusFilter || product.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination
  const paginatedProducts = filteredProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const showNotification = (message, severity) => {
    setNotification({ open: true, message, severity });
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = paginatedProducts.map(product => product.id);
      setSelectedProducts(newSelected);
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectClick = (productId) => {
    const selectedIndex = selectedProducts.indexOf(productId);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedProducts, productId);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedProducts.slice(1));
    } else if (selectedIndex === selectedProducts.length - 1) {
      newSelected = newSelected.concat(selectedProducts.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedProducts.slice(0, selectedIndex),
        selectedProducts.slice(selectedIndex + 1),
      );
    }

    setSelectedProducts(newSelected);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setOpenAddEdit(true);
    handleMenuClose();
  };

  const handleDelete = (product) => {
    setProductToDelete(product);
    setOpenDelete(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    setProducts(products.filter(p => p.id !== productToDelete.id));
    showNotification('Product deleted successfully', 'success');
    setOpenDelete(false);
    setProductToDelete(null);
  };

  const handleBulkDelete = () => {
    setProducts(products.filter(p => !selectedProducts.includes(p.id)));
    showNotification(`${selectedProducts.length} products deleted successfully`, 'success');
    setSelectedProducts([]);
    setOpenBulkDelete(false);
  };

  const handleMenuOpen = (event, productId) => {
    setAnchorEl(event.currentTarget);
    setMenuProductId(productId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuProductId(null);
  };

  const resetForm = () => {
    formik.resetForm();
    setEditingProduct(null);
    setOpenAddEdit(false);
  };

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      showNotification('Products refreshed', 'success');
    }, 1000);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Product Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddEdit(true)}
          >
            Add Product
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              {selectedProducts.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setOpenBulkDelete(true)}
                  fullWidth
                >
                  Delete ({selectedProducts.length})
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedProducts.length > 0 && selectedProducts.length < paginatedProducts.length}
                    checked={paginatedProducts.length > 0 && selectedProducts.length === paginatedProducts.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton variant="rectangular" width={20} height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" width={200} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" width={80} /></TableCell>
                    <TableCell><Skeleton variant="text" width={60} /></TableCell>
                    <TableCell><Skeleton variant="text" width={80} /></TableCell>
                    <TableCell><Skeleton variant="text" width={120} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                  </TableRow>
                ))
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No products found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    hover
                    selected={selectedProducts.indexOf(product.id) !== -1}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedProducts.indexOf(product.id) !== -1}
                        onChange={() => handleSelectClick(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          src={product.imageUrl}
                          alt={product.name}
                          variant="rounded"
                          sx={{ width: 50, height: 50 }}
                        />
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {product.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {product.description.length > 50 
                              ? `${product.description.substring(0, 50)}...` 
                              : product.description}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>${product.price}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color={product.stock === 0 ? 'error' : product.stock < 20 ? 'warning.main' : 'inherit'}
                      >
                        {product.stock}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={product.status}
                        color={product.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(product.updatedAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, product.id)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const product = products.find(p => p.id === menuProductId);
          handleEdit(product);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          const product = products.find(p => p.id === menuProductId);
          handleDelete(product);
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add/Edit Product Dialog */}
      <Dialog
        open={openAddEdit}
        onClose={resetForm}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <form onSubmit={formik.handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="name"
                  label="Product Name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={formik.touched.category && Boolean(formik.errors.category)}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={formik.values.category}
                    label="Category"
                    onChange={formik.handleChange}
                  >
                    {categories.map(category => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  name="description"
                  label="Description"
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  error={formik.touched.description && Boolean(formik.errors.description)}
                  helperText={formik.touched.description && formik.errors.description}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  name="price"
                  label="Price"
                  type="number"
                  InputProps={{ startAdornment: '$' }}
                  value={formik.values.price}
                  onChange={formik.handleChange}
                  error={formik.touched.price && Boolean(formik.errors.price)}
                  helperText={formik.touched.price && formik.errors.price}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  name="stock"
                  label="Stock Quantity"
                  type="number"
                  value={formik.values.stock}
                  onChange={formik.handleChange}
                  error={formik.touched.stock && Boolean(formik.errors.stock)}
                  helperText={formik.touched.stock && formik.errors.stock}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formik.values.status}
                    label="Status"
                    onChange={formik.handleChange}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="imageUrl"
                  label="Image URL"
                  value={formik.values.imageUrl}
                  onChange={formik.handleChange}
                  placeholder="Enter image URL or upload file"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={resetForm}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={openBulkDelete} onClose={() => setOpenBulkDelete(false)}>
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedProducts.length} selected products? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkDelete(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProductManagement;