import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Button, 
  Chip, 
  Box, 
  Grid, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { itemsApi } from '../../../services/api';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import LoadingSpinner from '../../Common/LoadingSpinner';
import ErrorBoundary from '../../Common/ErrorBoundary';

const ItemDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await itemsApi.getById(id);
      setItem(response.data);
    } catch (err) {
      console.error('Error fetching item:', err);
      setError(err.response?.data?.message || 'Failed to fetch item details');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/admin/items/edit/${id}`);
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await itemsApi.delete(id);
      toast.success('Item deleted successfully');
      navigate('/admin/items');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error(err.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      const response = await itemsApi.update(id, { status: newStatus });
      setItem(response.data);
      toast.success(`Item ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error('Error updating item status:', err);
      toast.error(err.response?.data?.message || 'Failed to update item status');
    }
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'out_of_stock':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'out_of_stock':
        return 'Out of Stock';
      default:
        return status || 'Unknown';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/items')}
        >
          Back to Items
        </Button>
      </Box>
    );
  }

  if (!item) {
    return (
      <Box p={3}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Item not found
        </Alert>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/items')}
        >
          Back to Items
        </Button>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box p={3}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/admin/items')}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              Item Details
            </Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            <Tooltip title={item.status === 'active' ? 'Deactivate Item' : 'Activate Item'}>
              <Button
                variant="outlined"
                color={item.status === 'active' ? 'warning' : 'success'}
                startIcon={item.status === 'active' ? <VisibilityOffIcon /> : <ViewIcon />}
                onClick={handleToggleStatus}
              >
                {item.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Main Details */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader
                title={item.name}
                subheader={`SKU: ${item.sku || 'N/A'}`}
                action={
                  <Chip 
                    label={getStatusLabel(item.status)}
                    color={getStatusColor(item.status)}
                    variant="filled"
                  />
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Price
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(item.price)}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Category
                    </Typography>
                    <Typography variant="body1">
                      {item.category?.name || 'Uncategorized'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Stock Quantity
                    </Typography>
                    <Typography 
                      variant="body1"
                      color={item.stockQuantity <= 0 ? 'error' : 'textPrimary'}
                    >
                      {item.stockQuantity || 0} units
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Weight
                    </Typography>
                    <Typography variant="body1">
                      {item.weight ? `${item.weight} kg` : 'N/A'}
                    </Typography>
                  </Grid>
                  
                  {item.description && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Description
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        {item.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Images and Meta */}
          <Grid item xs={12} md={4}>
            {/* Images */}
            {item.images && item.images.length > 0 && (
              <Card sx={{ mb: 2 }}>
                <CardHeader title="Images" />
                <CardContent>
                  <Grid container spacing={1}>
                    {item.images.map((image, index) => (
                      <Grid item xs={6} key={index}>
                        <Box
                          component="img"
                          src={image.url}
                          alt={`${item.name} ${index + 1}`}
                          sx={{
                            width: '100%',
                            height: 100,
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleImageClick(image.url)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Meta Information */}
            <Card>
              <CardHeader title="Meta Information" />
              <CardContent>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(item.createdAt)}
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(item.updatedAt)}
                    </Typography>
                  </Box>
                  
                  {item.createdBy && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                          Created By
                        </Typography>
                        <Typography variant="body2">
                          {item.createdBy.name || item.createdBy.email}
                        </Typography>
                      </Box>
                    </>
                  )}
                  
                  {item.updatedBy && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                          Last Updated By
                        </Typography>
                        <Typography variant="body2">
                          {item.updatedBy.name || item.updatedBy.email}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Delete Item</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{item.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDelete}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <ImageIcon />
              Image Preview
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box display="flex" justifyContent="center" p={2}>
              <Box
                component="img"
                src={selectedImage}
                alt="Preview"
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain'
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImageDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ErrorBoundary>
  );
};

export default ItemDetails;