import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Avatar,
  IconButton,
  Chip,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { itemsAPI } from '../../../services/api/itemsAPI';
import { uploadAPI } from '../../../services/api/uploadAPI';
import { useNotification } from '../../../hooks/useNotification';

const validationSchema = Yup.object({
  name: Yup.string()
    .required('Item name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  description: Yup.string()
    .required('Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  price: Yup.number()
    .required('Price is required')
    .positive('Price must be positive')
    .min(0.01, 'Price must be at least $0.01')
    .max(99999.99, 'Price must be less than $100,000'),
  category: Yup.string()
    .required('Category is required'),
  subcategory: Yup.string()
    .required('Subcategory is required'),
  sku: Yup.string()
    .required('SKU is required')
    .matches(/^[A-Z0-9-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens'),
  stockQuantity: Yup.number()
    .required('Stock quantity is required')
    .integer('Stock quantity must be a whole number')
    .min(0, 'Stock quantity cannot be negative'),
  weight: Yup.number()
    .positive('Weight must be positive')
    .max(1000, 'Weight must be less than 1000 lbs'),
  dimensions: Yup.object({
    length: Yup.number().positive('Length must be positive'),
    width: Yup.number().positive('Width must be positive'),
    height: Yup.number().positive('Height must be positive')
  })
});

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'home-garden', label: 'Home & Garden' },
  { value: 'sports', label: 'Sports & Outdoors' },
  { value: 'books', label: 'Books' },
  { value: 'toys', label: 'Toys & Games' },
  { value: 'health-beauty', label: 'Health & Beauty' },
  { value: 'automotive', label: 'Automotive' }
];

const SUBCATEGORIES = {
  electronics: ['Smartphones', 'Laptops', 'Tablets', 'Accessories', 'Audio'],
  clothing: ['Men\'s', 'Women\'s', 'Kids', 'Shoes', 'Accessories'],
  'home-garden': ['Furniture', 'Decor', 'Kitchen', 'Garden', 'Tools'],
  sports: ['Fitness', 'Outdoor Recreation', 'Team Sports', 'Water Sports'],
  books: ['Fiction', 'Non-Fiction', 'Educational', 'Children\'s'],
  toys: ['Educational', 'Action Figures', 'Board Games', 'Outdoor Toys'],
  'health-beauty': ['Skincare', 'Makeup', 'Health Supplements', 'Personal Care'],
  automotive: ['Parts', 'Accessories', 'Tools', 'Care Products']
};

const ItemForm = ({ item, onSave, onCancel, mode = 'create' }) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const { showNotification } = useNotification();

  const formik = useFormik({
    initialValues: {
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || '',
      category: item?.category || '',
      subcategory: item?.subcategory || '',
      sku: item?.sku || '',
      stockQuantity: item?.stockQuantity || 0,
      weight: item?.weight || '',
      dimensions: {
        length: item?.dimensions?.length || '',
        width: item?.dimensions?.width || '',
        height: item?.dimensions?.height || ''
      },
      isActive: item?.isActive !== undefined ? item.isActive : true,
      isFeatured: item?.isFeatured || false,
      notes: item?.notes || ''
    },
    validationSchema,
    onSubmit: async (values) => {
      await handleSubmit(values);
    }
  });

  useEffect(() => {
    if (item?.images) {
      setImages(item.images);
    }
    if (item?.tags) {
      setTags(item.tags);
    }
  }, [item]);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      const itemData = {
        ...values,
        images: images.map(img => ({ url: img.url, alt: img.alt || values.name })),
        tags,
        lastModified: new Date().toISOString()
      };

      let result;
      if (mode === 'edit' && item?.id) {
        result = await itemsAPI.updateItem(item.id, itemData);
        showNotification('Item updated successfully', 'success');
      } else {
        result = await itemsAPI.createItem(itemData);
        showNotification('Item created successfully', 'success');
      }

      onSave(result);
    } catch (error) {
      console.error('Error saving item:', error);
      showNotification(
        error.response?.data?.message || 'Failed to save item',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      const uploadPromises = files.map(file => uploadAPI.uploadImage(file));
      const results = await Promise.all(uploadPromises);
      
      const newImages = results.map(result => ({
        url: result.url,
        alt: formik.values.name,
        isPrimary: images.length === 0
      }));

      setImages(prev => [...prev, ...newImages]);
      showNotification(`${files.length} image(s) uploaded successfully`, 'success');
    } catch (error) {
      console.error('Error uploading images:', error);
      showNotification('Failed to upload images', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleImageDelete = (index) => {
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      // If we deleted the primary image, make the first remaining image primary
      if (prev[index]?.isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true;
      }
      return newImages;
    });
  };

  const handleSetPrimaryImage = (index) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index
    })));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleDeleteTag = (tagToDelete) => {
    setTags(prev => prev.filter(tag => tag !== tagToDelete));
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {mode === 'edit' ? 'Edit Item' : 'Create New Item'}
        </Typography>

        <Box component="form" onSubmit={formik.handleSubmit} noValidate>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="name"
                label="Item Name"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="sku"
                label="SKU"
                value={formik.values.sku}
                onChange={formik.handleChange}
                error={formik.touched.sku && Boolean(formik.errors.sku)}
                helperText={formik.touched.sku && formik.errors.sku}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                name="description"
                label="Description"
                value={formik.values.description}
                onChange={formik.handleChange}
                error={formik.touched.description && Boolean(formik.errors.description)}
                helperText={formik.touched.description && formik.errors.description}
                required
              />
            </Grid>

            {/* Category and Pricing */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Category & Pricing
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={formik.values.category}
                  onChange={(e) => {
                    formik.handleChange(e);
                    formik.setFieldValue('subcategory', ''); // Reset subcategory
                  }}
                  error={formik.touched.category && Boolean(formik.errors.category)}
                  label="Category"
                >
                  {CATEGORIES.map(category => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Subcategory</InputLabel>
                <Select
                  name="subcategory"
                  value={formik.values.subcategory}
                  onChange={formik.handleChange}
                  error={formik.touched.subcategory && Boolean(formik.errors.subcategory)}
                  label="Subcategory"
                  disabled={!formik.values.category}
                >
                  {formik.values.category && SUBCATEGORIES[formik.values.category]?.map(subcategory => (
                    <MenuItem key={subcategory} value={subcategory}>
                      {subcategory}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="price"
                label="Price ($)"
                type="number"
                inputProps={{ step: "0.01", min: "0" }}
                value={formik.values.price}
                onChange={formik.handleChange}
                error={formik.touched.price && Boolean(formik.errors.price)}
                helperText={formik.touched.price && formik.errors.price}
                required
              />
            </Grid>

            {/* Inventory */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Inventory & Shipping
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                name="stockQuantity"
                label="Stock Quantity"
                type="number"
                value={formik.values.stockQuantity}
                onChange={formik.handleChange}
                error={formik.touched.stockQuantity && Boolean(formik.errors.stockQuantity)}
                helperText={formik.touched.stockQuantity && formik.errors.stockQuantity}
                required
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                name="weight"
                label="Weight (lbs)"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                value={formik.values.weight}
                onChange={formik.handleChange}
                error={formik.touched.weight && Boolean(formik.errors.weight)}
                helperText={formik.touched.weight && formik.errors.weight}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                name="dimensions.length"
                label="Length (in)"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                value={formik.values.dimensions.length}
                onChange={formik.handleChange}
                error={formik.touched.dimensions?.length && Boolean(formik.errors.dimensions?.length)}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                name="dimensions.width"
                label="Width (in)"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                value={formik.values.dimensions.width}
                onChange={formik.handleChange}
                error={formik.touched.dimensions?.width && Boolean(formik.errors.dimensions?.width)}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                name="dimensions.height"
                label="Height (in)"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                value={formik.values.dimensions.height}
                onChange={formik.handleChange}
                error={formik.touched.dimensions?.height && Boolean(formik.errors.dimensions?.height)}
              />
            </Grid>

            {/* Images */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Images
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                  disabled={uploading}
                >
                  Upload Images
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </Button>
              </Box>

              <Grid container spacing={2}>
                {images.map((image, index) => (
                  <Grid item xs={6} md={3} key={index}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={image.url}
                        variant="rounded"
                        sx={{ width: '100%', height: 150 }}
                      />
                      {image.isPrimary && (
                        <Chip
                          label="Primary"
                          size="small"
                          color="primary"
                          sx={{ position: 'absolute', top: 8, left: 8 }}
                        />
                      )}
                      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleImageDelete(index)}
                          sx={{ bgcolor: 'rgba(255,255,255,0.8)' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      {!image.isPrimary && (
                        <Button
                          size="small"
                          onClick={() => handleSetPrimaryImage(index)}
                          sx={{ mt: 1, width: '100%' }}
                        >
                          Set Primary
                        </Button>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Tags
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="Add Tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <IconButton onClick={handleAddTag} disabled={!newTag.trim()}>
                  <AddIcon />
                </IconButton>
              </Box>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleDeleteTag(tag)}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Grid>

            {/* Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Settings
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.isActive}
                      onChange={formik.handleChange}
                      name="isActive"
                    />
                  }
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.isFeatured}
                      onChange={formik.handleChange}
                      name="isFeatured"
                    />
                  }
                  label="Featured"
                />
              </Box>
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                name="notes"
                label="Internal Notes"
                value={formik.values.notes}
                onChange={formik.handleChange}
                helperText="These notes are for internal use only and won't be visible to customers"
              />
            </Grid>

            {/* Form Actions */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={loading}
                  startIcon={<CancelIcon />}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !formik.isValid}
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                >
                  {loading ? 'Saving...' : (mode === 'edit' ? 'Update Item' : 'Create Item')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

ItemForm.propTypes = {
  item: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['create', 'edit'])
};

export default ItemForm;