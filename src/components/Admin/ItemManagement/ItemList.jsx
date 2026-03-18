import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Grid,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { itemService } from '../../../services/itemService';
import { auditService } from '../../../services/auditService';
import { formatCurrency, formatDate } from '../../../utils/formatting';
import ItemForm from './ItemForm';
import ItemDetails from './ItemDetails';

const ItemList = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  // State management
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formMode, setFormMode] = useState('create'); // 'create' or 'edit'

  // Check admin authentication
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Load initial data
  useEffect(() => {
    loadItems();
    loadCategories();
  }, [page, rowsPerPage, searchTerm, categoryFilter, statusFilter]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
        category: categoryFilter,
        status: statusFilter
      };
      
      const response = await itemService.getItems(params);
      setItems(response.data.items);
      setTotalCount(response.data.totalCount);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await itemService.getCategories();
      setCategories(response.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  const handleCategoryFilterChange = (event) => {
    setCategoryFilter(event.target.value);
    setPage(0);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStatusFilter('');
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateItem = () => {
    setSelectedItem(null);
    setFormMode('create');
    setFormDialogOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setFormMode('edit');
    setFormDialogOpen(true);
  };

  const handleViewItem = (item) => {
    setSelectedItem(item);
    setDetailsDialogOpen(true);
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      await itemService.deleteItem(itemToDelete.id);
      
      // Log audit event
      await auditService.log({
        action: 'DELETE_ITEM',
        entityType: 'item',
        entityId: itemToDelete.id,
        details: {
          itemName: itemToDelete.name,
          itemSku: itemToDelete.sku
        },
        userId: user.id
      });

      setDeleteDialogOpen(false);
      setItemToDelete(null);
      loadItems(); // Reload the list
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item. Please try again.');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (formMode === 'create') {
        await itemService.createItem(formData);
        
        // Log audit event
        await auditService.log({
          action: 'CREATE_ITEM',
          entityType: 'item',
          details: {
            itemName: formData.name,
            itemSku: formData.sku
          },
          userId: user.id
        });
      } else {
        await itemService.updateItem(selectedItem.id, formData);
        
        // Log audit event
        await auditService.log({
          action: 'UPDATE_ITEM',
          entityType: 'item',
          entityId: selectedItem.id,
          details: {
            itemName: formData.name,
            itemSku: formData.sku,
            changes: formData
          },
          userId: user.id
        });
      }

      setFormDialogOpen(false);
      setSelectedItem(null);
      loadItems(); // Reload the list
    } catch (err) {
      console.error('Error saving item:', err);
      throw err; // Re-throw to let form handle the error
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      active: { color: 'success', label: 'Active' },
      inactive: { color: 'default', label: 'Inactive' },
      discontinued: { color: 'error', label: 'Discontinued' },
      draft: { color: 'warning', label: 'Draft' }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return <Chip size="small" color={config.color} label={config.label} />;
  };

  const filteredAndSortedItems = useMemo(() => {
    return items; // Items are already filtered on the backend
  }, [items]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          {/* Header */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" component="h1">
              Item Management
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateItem}
              sx={{ ml: 2 }}
            >
              Add New Item
            </Button>
          </Box>

          {/* Search and Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Search items by name or SKU..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={handleCategoryFilterChange}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
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
                  onChange={handleStatusFilterChange}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="discontinued">Discontinued</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                sx={{ height: '56px' }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Items Table */}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Image</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Modified</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No items found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Avatar
                          src={item.imageUrl}
                          alt={item.name}
                          sx={{ width: 40, height: 40 }}
                          variant="rounded"
                        >
                          {item.name.charAt(0)}
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.sku}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.category?.name || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={item.stockQuantity <= item.lowStockThreshold ? 'error' : 'inherit'}
                        >
                          {item.stockQuantity}
                          {item.stockQuantity <= item.lowStockThreshold && ' (Low)'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(item.status)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(item.updatedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewItem(item)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Item">
                          <IconButton
                            size="small"
                            onClick={() => handleEditItem(item)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Item">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(item)}
                            color="error"
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

          {/* Pagination */}
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Item Form Dialog */}
      <Dialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {formMode === 'create' ? 'Create New Item' : 'Edit Item'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ItemForm
            item={selectedItem}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormDialogOpen(false)}
            categories={categories}
          />
        </DialogContent>
      </Dialog>

      {/* Item Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Item Details</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ItemDetails
            item={selectedItem}
            onClose={() => setDetailsDialogOpen(false)}
            onEdit={() => {
              setDetailsDialogOpen(false);
              handleEditItem(selectedItem);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ItemList;