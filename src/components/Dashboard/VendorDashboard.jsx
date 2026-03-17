import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Badge } from '../UI/Badge';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { theme } = useTheme();
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
    const baseClasses = theme === 'dark' 
      ? {
          active: 'bg-green-900/30 text-green-300 border-green-800',
          out_of_stock: 'bg-red-900/30 text-red-300 border-red-800',
          pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-800',
          shipped: 'bg-blue-900/30 text-blue-300 border-blue-800',
          default: 'bg-gray-800/30 text-gray-300 border-gray-700'
        }
      : {
          active: 'bg-green-100 text-green-800 border-green-200',
          out_of_stock: 'bg-red-100 text-red-800 border-red-200',
          pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          shipped: 'bg-blue-100 text-blue-800 border-blue-200',
          default: 'bg-gray-100 text-gray-800 border-gray-200'
        };

    return baseClasses[status] || baseClasses.default;
  };

  const themeClasses = {
    container: theme === 'dark' 
      ? 'bg-gray-900 text-gray-100' 
      : 'bg-gray-50 text-gray-900',
    header: theme === 'dark' 
      ? 'text-gray-100' 
      : 'text-gray-900',
    subtitle: theme === 'dark' 
      ? 'text-gray-300' 
      : 'text-gray-600',
    modal: theme === 'dark' 
      ? 'bg-gray-800 border-gray-700' 
      : 'bg-white border-gray-200',
    modalOverlay: 'bg-black bg-opacity-50',
    productItem: theme === 'dark' 
      ? 'border-gray-700 bg-gray-800/50' 
      : 'border-gray-200 bg-white',
    text: {
      primary: theme === 'dark' ? 'text-gray-100' : 'text-gray-900',
      secondary: theme === 'dark' ? 'text-gray-300' : 'text-gray-600',
      muted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
    },
    input: theme === 'dark' 
      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  };

  return (
    <div className={`space-y-6 transition-colors duration-200 ${themeClasses.container}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold transition-colors duration-200 ${themeClasses.header}`}>
            Vendor Dashboard
          </h1>
          <p className={`transition-colors duration-200 ${themeClasses.subtitle}`}>
            Welcome back, {user?.name}
          </p>
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
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className={`text-sm font-medium transition-colors duration-200 ${themeClasses.text.secondary}`}>
                  Total Revenue
                </p>
                <p className={`text-2xl font-bold transition-colors duration-200 ${themeClasses.text.primary}`}>
                  ${analytics.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className={`text-sm font-medium transition-colors duration-200 ${themeClasses.text.secondary}`}>
                  Total Orders
                </p>
                <p className={`text-2xl font-bold transition-colors duration-200 ${themeClasses.text.primary}`}>
                  {analytics.totalOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className={`text-sm font-medium transition-colors duration-200 ${themeClasses.text.secondary}`}>
                  Total Products
                </p>
                <p className={`text-2xl font-bold transition-colors duration-200 ${themeClasses.text.primary}`}>
                  {analytics.totalProducts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className={`text-sm font-medium transition-colors duration-200 ${themeClasses.text.secondary}`}>
                  Low Stock
                </p>
                <p className={`text-2xl font-bold transition-colors duration-200 ${themeClasses.text.primary}`}>
                  {analytics.lowStockCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddProduct && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-200 ${themeClasses.modalOverlay}`}>
          <div className={`rounded-lg p-6 w-full max-w-md mx-4 transition-all duration-200 ${themeClasses.modal}`}>
            <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${themeClasses.text.primary}`}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <div className="space-y-4">
              <Input
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                className={`transition-colors duration-200 ${themeClasses.input}`}
              />
              <textarea
                placeholder="Description"
                className={`w-full p-2 border rounded-md transition-colors duration-200 ${themeClasses.input}`}
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
                className={`transition-colors duration-200 ${themeClasses.input}`}
              />
              <Input
                placeholder="Stock Quantity"
                type="number"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                className={`transition-colors duration-200 ${themeClasses.input}`}
              />
              <Input
                placeholder="Category"
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                className={`transition-colors duration-200 ${themeClasses.input}`}
              />
              <Input
                placeholder="Image URL"
                value={newProduct.image}
                onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                className={`transition-colors duration-200 ${themeClasses.input}`}
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors duration-200 ${themeClasses.productItem}`}>
                  <div className="flex-1">
                    <h4 className={`font-medium transition-colors duration-200 ${themeClasses.text.primary}`}>
                      {product.name}
                    </h4>
                    <p className={`text-sm transition-colors duration-200 ${themeClasses.text.secondary}`}>
                      ${product.price} • Stock: {product.stock} • Sales: {product.sales}
                    </p>
                    <Badge className={`transition-colors duration-200 border ${getStatusColor(product.status)}`}>
                      {product.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors duration-200 ${themeClasses.productItem}`}>
                  <div className="flex-1">
                    <h4 className={`font-medium transition-colors duration-200 ${themeClasses.text.primary}`}>
                      {order.id}
                    </h4>
                    <p className={`text-sm transition-colors duration-200 ${themeClasses.text.secondary}`}>
                      {order.customer} • ${order.total}
                    </p>
                    <p className={`text-xs transition-colors duration-200 ${themeClasses.text.muted}`}>
                      {order.date}
                    </p>
                    <Badge className={`transition-colors duration-200 border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className={`h-12 w-12 mx-auto mb-4 opacity-50 transition-colors duration-200 ${themeClasses.text.muted}`} />
            <p className={`transition-colors duration-200 ${themeClasses.text.muted}`}>
              Sales analytics chart would be implemented here
            </p>
            <p className={`text-sm transition-colors duration-200 ${themeClasses.text.muted}`}>
              Integration with charting library (Chart.js, Recharts, etc.)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;