import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Checkbox, 
  Avatar, 
  Chip, 
  Menu, 
  MenuItem, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  TablePagination,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

const ProductTable = ({ 
  products = [], 
  loading = false,
  onEdit, 
  onDelete, 
  onView,
  onBulkDelete,
  searchTerm = '',
  filterCategory = '',
  page = 0,
  rowsPerPage = 10,
  onPageChange,
  onRowsPerPageChange,
  totalCount = 0
}) => {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Clear selections when products change
  useEffect(() => {
    setSelectedProducts([]);
  }, [products]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedProducts(products.map(product => product.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleMenuClick = (event, product) => {
    setAnchorEl(event.currentTarget);
    setSelectedProduct(product);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProduct(null);
  };

  const handleEdit = () => {
    if (selectedProduct && onEdit) {
      onEdit(selectedProduct);
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedProduct && onView) {
      onView(selectedProduct);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct && onDelete) {
      onDelete(selectedProduct.id);
    }
    setDeleteDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleBulkDeleteClick = () => {
    if (selectedProducts.length > 0) {
      setBulkDeleteDialogOpen(true);
    }
  };

  const handleBulkDeleteConfirm = () => {
    if (onBulkDelete && selectedProducts.length > 0) {
      onBulkDelete(selectedProducts);
    }
    setBulkDeleteDialogOpen(false);
    setSelectedProducts([]);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'out_of_stock':
        return 'error';
      case 'low_stock':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Paper elevation={2}>
        {selectedProducts.length > 0 && (
          <Box p={2} bgcolor="action.selected">
            <Typography variant="subtitle2" component="span">
              {selectedProducts.length} item{selectedProducts.length > 1 ? 's' : ''} selected
            </Typography>
            <Button 
              color="error" 
              onClick={handleBulkDeleteClick}
              sx={{ ml: 2 }}
              size="small"
            >
              Delete Selected
            </Button>
          </Box>
        )}
        
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedProducts.length > 0 && selectedProducts.length < products.length}
                    checked={products.length > 0 && selectedProducts.length === products.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Last Updated</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No products found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow 
                    key={product.id} 
                    hover
                    selected={selectedProducts.includes(product.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          src={product.image || product.images?.[0]}
                          alt={product.name}
                          sx={{ width: 48, height: 48 }}
                          variant="rounded"
                        >
                          {product.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            ID: {product.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={product.category || 'Uncategorized'} 
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="subtitle2">
                        {formatPrice(product.price || 0)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography 
                        variant="body2"
                        color={product.stock <= (product.lowStockThreshold || 10) ? 'error' : 'inherit'}
                      >
                        {product.stock || 0}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Chip
                        label={formatStatus(product.status)}
                        color={getStatusColor(product.status)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography variant="caption" color="textSecondary">
                        {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={() => onEdit && onEdit(product)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="More actions">
                        <IconButton 
                          size="small"
                          onClick={(e) => handleMenuClick(e, product)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <ViewIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Product</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>Delete Multiple Products</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedProducts.length} selected products? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProductTable;