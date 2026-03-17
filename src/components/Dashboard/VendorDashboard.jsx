import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Badge } from '../UI/Badge';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  ShoppingCart,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';

const VendorDashboard = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockCount: 0
  });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
    image: ''
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate API calls
    const mockProducts = [
      {
        id: 1,
        name: 'Premium Headphones',
        price: 199.99,
        stock: 25,
        category: 'Electronics',
        status: 'active',
        sales: 45
      },
      {
        id: 2,
        name: 'Wireless Speaker',
        price: 89.99,
        stock: 5,
        category: 'Electronics',
        status: 'active',
        sales: 32
      },
      {
        id: 3,
        name: 'Gaming Mouse',
        price: 49.99,
        stock: 0,
        category: 'Electronics',
        status: 'out_of_stock',
        sales: 67
      }
    ];

    const mockOrders = [
      {
        id: 'ORD-001',
        customer: 'John Doe',
        products: ['Premium Headphones'],
        total: 199.99,
        status: 'pending',
        date: '2024-01-15'
      },
      {
        id: 'ORD-002',
        customer: 'Jane Smith',
        products: ['Wireless Speaker', 'Gaming Mouse'],
        total: 139.98,
        status: 'shipped',
        date: '2024-01-14'
      }
    ];

    setProducts(mockProducts);
    setOrders(mockOrders);

    // Calculate analytics
    const totalRevenue = mockOrders.reduce((sum, order) => sum + order.total, 0);
    const totalProducts = mockProducts.length;
    const lowStockCount = mockProducts.filter(p => p.stock <= 5).length;

    setAnalytics({
      totalRevenue,
      totalOrders: mockOrders.length,
      totalProducts,
      lowStockCount
    });
  }, []);

  const handleAddProduct = () => {
    if (newProduct.name && newProduct.price && newProduct.stock) {
      const product = {
        id: Date.now(),
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        status: 'active',
        sales: 0
      };
      setProducts([...products, product]);
      setNewProduct({ name: '', description: '', price: '', stock: '', category: '', image: '' });
      setShowAddProduct(false);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      image: product.image || ''
    });
    setShowAddProduct(true);
  };

  const handleUpdateProduct = () => {
    const updatedProducts = products.map(p =>
      p.id === editingProduct.id
        ? {
            ...p,
            ...newProduct,
            price: parseFloat(newProduct.price),
            stock: parseInt(newProduct.stock)
          }
        : p
    );
    setProducts(updatedProducts);
    setEditingProduct(null);
    setNewProduct({ name: '', description: '', price: '', stock: '', category: '', image: '' });
    setShowAddProduct(false);
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== productId));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]';
      case 'out_of_stock': return 'bg-[var(--color-error-bg)] text-[var(--color-error-text)] border-[var(--color-error-border)]';
      case 'pending': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]';
      case 'shipped': return 'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]';
      default: return 'bg-[var(--color-muted-bg)] text-[var(--color-muted-text)] border-[var(--color-muted-border)]';
    }
  };

  return (
    <div className="space-y-6 bg-[var(--color-background)] text-[var(--color-foreground)] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)]">Vendor Dashboard</h1>
          <p className="text-[var(--color-muted-foreground)]">Welcome back, {user?.name}</p>
        </div>
        <Button 
          onClick={() => setShowAddProduct(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-[var(--color-success)]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Total Revenue</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)]">${analytics.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-[var(--color-primary)]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Total Orders</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)]">{analytics.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-[var(--color-accent)]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Total Products</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)]">{analytics.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-[var(--color-destructive)]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Low Stock</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)]">{analytics.lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-[var(--color-foreground)]">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <div className="space-y-4">
              <Input
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                className="bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-foreground)]"
              />
              <textarea
                placeholder="Description"
                className="w-full p-2 border border-[var(--color-border)] rounded-md bg-[var(--color-background)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]"
                rows="3"
                value={newProduct.description}
                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
              />
              <Input
                placeholder="Price"
                type="number"
                step="0.01"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                className="bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-foreground)]"
              />
              <Input
                placeholder="Stock Quantity"
                type="number"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                className="bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-foreground)]"
              />
              <Input
                placeholder="Category"
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                className="bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-foreground)]"
              />
              <Input
                placeholder="Image URL"
                value={newProduct.image}
                onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                className="bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-foreground)]"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                className="flex-1"
              >
                {editingProduct ? 'Update' : 'Add'} Product
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddProduct(false);
                  setEditingProduct(null);
                  setNewProduct({ name: '', description: '', price: '', stock: '', category: '', image: '' });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products Management */}
        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--color-foreground)]">
              <Package className="h-5 w-5" />
              Product Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)]">
                  <div className="flex-1">
                    <h4 className="font-medium text-[var(--color-foreground)]">{product.name}</h4>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      ${product.price} • Stock: {product.stock} • Sales: {product.sales}
                    </p>
                    <Badge className={`${getStatusColor(product.status)} border mt-1`}>
                      {product.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                      className="border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="border-[var(--color-border)] text-[var(--color-destructive)] hover:bg-[var(--color-destructive)] hover:text-[var(--color-destructive-foreground)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--color-foreground)]">
              <TrendingUp className="h-5 w-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)]">
                  <div className="flex-1">
                    <h4 className="font-medium text-[var(--color-foreground)]">{order.id}</h4>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {order.customer} • ${order.total}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{order.date}</p>
                    <Badge className={`${getStatusColor(order.status)} border mt-1`}>
                      {order.status}
                    </Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Analytics */}
      <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-foreground)]">Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-muted-foreground)]">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sales analytics chart would be implemented here</p>
            <p className="text-sm">Integration with charting library (Chart.js, Recharts, etc.)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;