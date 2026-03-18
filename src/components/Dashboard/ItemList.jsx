import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  TextField, 
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Pagination,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  Visibility as ViewIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { itemService } from '../../services/itemService';
import ItemForm from './ItemForm';
import ItemDetails from './ItemDetails';
import BulkActions from './BulkActions';
import AuditTrail from './AuditTrail';

const ItemList = () => {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    availability: 'all'
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Dialog states
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [bulkActionsAnchor, setBulkActionsAnchor] = useState(null);

  // Check admin permissions
  useEffect(() => {
    if (!hasPermission('admin')) {
      setError('Access denied. Administrator privileges required.');
      return;
    }
  }, [hasPermission]);

  // Load items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itemService.getItems({
        page,
        search: searchTerm,
        filters,
        sortBy,
        sortOrder,
        includeAuditInfo: true
      });
      
      setItems(response.items);
      setTotalPages(response.totalPages);
      setError('');
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filters, sortBy, sortOrder]);

  useEffect(() => {
    if (hasPermission('admin')) {
      loadItems();
    }
  }, [loadItems, hasPermission]);

  // Search and filter handlers
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Item selection handlers
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedItems(items.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // CRUD operation handlers
  const handleCreateItem = () => {
    setSelectedItem(null);
    setItemFormOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setItemFormOpen(true);
  };

  const handleViewItem = (item) => {
    setSelectedItem(item);
    setItemDetailsOpen(true);
  };

  const handleDeleteItem = (item) => {
    setSelectedItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleViewAuditTrail = (item) => {
    setSelectedItem(item);
    setAuditTrailOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await itemService.deleteItem(selectedItem.id);
      setItems(prev => prev.filter(item => item.id !== selectedItem.id));
      setSuccess('Item deleted successfully');
      setDeleteConfirmOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Failed to delete item. Please try again.');
    }
  };

  const handleItemSaved = (savedItem) => {
    if (selectedItem) {
      // Update existing item
      setItems(prev => prev.map(item => 
        item.id === savedItem.id ? savedItem : item
      ));
      setSuccess('Item updated successfully');
    } else {
      // Add new item
      setItems(prev => [savedItem, ...prev]);
      setSuccess('Item created successfully');
    }
    setItemFormOpen(false);
    setSelectedItem(null);
  };

  const handleBulkAction = async (action, options = {}) => {
    try {
      switch (action) {
        case 'delete':
          await itemService.bulkDelete(selectedItems);
          setItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
          setSuccess(`${selectedItems.length} items deleted successfully`);
          break;
        case 'updateStatus':
          await itemService.bulkUpdateStatus(selectedItems, options.status);
          loadItems(); // Reload to get updated items
          setSuccess(`${selectedItems.length} items updated successfully`);
          break;
        case 'export':
          await itemService.exportItems(selectedItems);
          setSuccess('Items exported successfully');
          break;
        default:
          break;
      }
      setSelectedItems([]);
      setBulkActionsAnchor(null);
    } catch (err) {
      console.error('Bulk action failed:', err);
      setError('Bulk action failed. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'out_of_stock': return 'error';
      case 'low_stock': return 'warning';
      default: return 'default';
    }
  };

  if (!hasPermission('admin')) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Administrator privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Item Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateItem}
        >
          Add New Item
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search items..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="electronics">Electronics</MenuItem>
                  <MenuItem value="clothing">Clothing</MenuItem>
                  <MenuItem value="home">Home & Garden</MenuItem>
                  <MenuItem value="books">Books</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Availability</InputLabel>
                <Select
                  value={filters.availability}
                  onChange={(e) => handleFilterChange('availability', e.target.value)}
                  label="Availability"
                >
                  <MenuItem value="all">All Items</MenuItem>
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="low_stock">Low Stock</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              {selectedItems.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  onClick={(e) => setBulkActionsAnchor(e.currentTarget)}
                >
                  Actions ({selectedItems.length})
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedItems.length > 0 && selectedItems.length < items.length}
                    checked={items.length > 0 && selectedItems.length === items.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Image</TableCell>
                <TableCell 
                  onClick={() => handleSort('name')}
                  sx={{ cursor: 'pointer' }}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell>Description</TableCell>
                <TableCell 
                  onClick={() => handleSort('quantity')}
                  sx={{ cursor: 'pointer' }}
                >
                  Quantity {sortBy === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell 
                  onClick={() => handleSort('updated_at')}
                  sx={{ cursor: 'pointer' }}
                >
                  Last Updated {sortBy === 'updated_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No items found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar
                        src={item.image_url}
                        sx={{ width: 40, height: 40 }}
                      >
                        <ImageIcon />
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          maxWidth: 200, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap' 
                        }}
                      >
                        {item.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.available_quantity} / {item.total_quantity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </Typography>
                      {item.updated_by && (
                        <Typography variant="caption" display="block">
                          by {item.updated_by}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
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
                          onClick={() => handleDeleteItem(item)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Audit Trail">
                        <IconButton
                          size="small"
                          onClick={() => handleViewAuditTrail(item)}
                        >
                          <MoreVertIcon />
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
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}
      </Card>

      {/* Item Form Dialog */}
      <Dialog
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedItem ? 'Edit Item' : 'Create New Item'}
        </DialogTitle>
        <DialogContent>
          <ItemForm
            item={selectedItem}
            onSave={handleItemSaved}
            onCancel={() => setItemFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Item Details Dialog */}
      <Dialog
        open={itemDetailsOpen}
        onClose={() => setItemDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Item Details</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <ItemDetails
              item={selectedItem}
              onEdit={() => {
                setItemDetailsOpen(false);
                setItemFormOpen(true);
              }}
              onDelete={() => {
                setItemDetailsOpen(false);
                setDeleteConfirmOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog
        open={auditTrailOpen}
        onClose={() => setAuditTrailOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Audit Trail - {selectedItem?.name}</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <AuditTrail itemId={selectedItem.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionsAnchor}
        open={Boolean(bulkActionsAnchor)}
        onClose={() => setBulkActionsAnchor(null)}
      >
        <MenuItem onClick={() => handleBulkAction('export')}>
          <ExportIcon sx={{ mr: 1 }} />
          Export Selected
        </MenuItem>
        <MenuItem onClick={() => handleBulkAction('updateStatus', { status: 'active' })}>
          Set Active
        </MenuItem>
        <MenuItem onClick={() => handleBulkAction('updateStatus', { status: 'inactive' })}>
          Set Inactive
        </MenuItem>
        <MenuItem 
          onClick={() => handleBulkAction('delete')}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Selected
        </MenuItem>
      </Menu>

      {/* Success/Error Notifications */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ItemList;