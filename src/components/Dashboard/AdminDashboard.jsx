import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter
} from 'lucide-react';

const AdminDashboard = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API calls to fetch admin data
    const fetchAdminData = async () => {
      try {
        // Mock data - replace with actual API calls
        setUsers([
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'customer', status: 'active', joinDate: '2024-01-15' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'vendor', status: 'active', joinDate: '2024-01-20' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'customer', status: 'inactive', joinDate: '2024-01-25' }
        ]);

        setProducts([
          { id: 1, name: 'Wireless Headphones', price: 99.99, stock: 50, category: 'Electronics', status: 'active' },
          { id: 2, name: 'Running Shoes', price: 129.99, stock: 30, category: 'Sports', status: 'active' },
          { id: 3, name: 'Coffee Maker', price: 79.99, stock: 0, category: 'Appliances', status: 'out_of_stock' }
        ]);

        setOrders([
          { id: 1, customer: 'John Doe', total: 199.98, status: 'completed', date: '2024-01-30' },
          { id: 2, customer: 'Jane Smith', total: 99.99, status: 'pending', date: '2024-01-31' },
          { id: 3, customer: 'Bob Johnson', total: 259.97, status: 'shipped', date: '2024-02-01' }
        ]);

        setAnalytics({
          totalUsers: 1250,
          totalProducts: 450,
          totalOrders: 850,
          totalRevenue: 125000,
          monthlyGrowth: 15.5,
          topSellingProducts: [
            { name: 'Wireless Headphones', sales: 156 },
            { name: 'Running Shoes', sales: 142 },
            { name: 'Coffee Maker', sales: 98 }
          ]
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching admin data:', error);
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }) => (
    <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow-md p-6 border-l-4 ${theme.colors.primary}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${theme.colors.textMuted}`}>{title}</p>
          <p className={`text-2xl font-bold ${theme.colors.textPrimary}`}>{value}</p>
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${theme.colors.accent}`}>
          <Icon className={`h-6 w-6 ${theme.colors.primary}`} />
        </div>
      </div>
    </div>
  );

  const UserManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>User Management</h2>
        <button className={`${theme.colors.primary} text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:${theme.colors.primaryHover} transition-colors`}>
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className={`h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.colors.textMuted}`} />
          <input
            type="text"
            placeholder="Search users..."
            className={`w-full pl-10 pr-4 py-2 border ${theme.colors.border} ${theme.colors.bg} ${theme.colors.textPrimary} rounded-lg focus:ring-2 focus:ring-${theme.colors.primary} focus:border-transparent`}
          />
        </div>
        <button className={`px-4 py-2 border ${theme.colors.border} ${theme.colors.bg} ${theme.colors.textPrimary} rounded-lg flex items-center gap-2 hover:${theme.colors.bgSecondary} transition-colors`}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow overflow-hidden`}>
        <table className={`min-w-full divide-y ${theme.colors.border}`}>
          <thead className={theme.colors.bgSecondary}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>User</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Role</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Join Date</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`${theme.colors.bg} divide-y ${theme.colors.border}`}>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className={`text-sm font-medium ${theme.colors.textPrimary}`}>{user.name}</div>
                    <div className={`text-sm ${theme.colors.textMuted}`}>{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'vendor' ? 'bg-orange-100 text-orange-800' :
                    `${theme.colors.bgSecondary} ${theme.colors.textPrimary}`
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.colors.textMuted}`}>
                  {user.joinDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className={`${theme.colors.primary} hover:${theme.colors.primaryHover} transition-colors`}>
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-green-600 hover:text-green-900 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const ProductManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>Product Management</h2>
        <button className={`${theme.colors.primary} text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:${theme.colors.primaryHover} transition-colors`}>
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow overflow-hidden`}>
        <table className={`min-w-full divide-y ${theme.colors.border}`}>
          <thead className={theme.colors.bgSecondary}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Product</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Category</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Price</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Stock</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${theme.colors.textMuted} uppercase tracking-wider`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`${theme.colors.bg} divide-y ${theme.colors.border}`}>
            {products.map((product) => (
              <tr key={product.id}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme.colors.textPrimary}`}>
                  {product.name}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.colors.textMuted}`}>
                  {product.category}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.colors.textPrimary}`}>
                  ${product.price}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.colors.textPrimary}`}>
                  {product.stock}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' : 
                    product.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                    `${theme.colors.bgSecondary} ${theme.colors.textPrimary}`
                  }`}>
                    {product.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className={`${theme.colors.primary} hover:${theme.colors.primaryHover} transition-colors`}>
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-green-600 hover:text-green-900 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme.colors.textPrimary}`}>Analytics & Reports</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={analytics.totalUsers?.toLocaleString()}
          icon={Users}
          trend={12.5}
          color="blue"
        />
        <StatCard
          title="Total Products"
          value={analytics.totalProducts?.toLocaleString()}
          icon={Package}
          trend={8.2}
          color="green"
        />
        <StatCard
          title="Total Orders"
          value={analytics.totalOrders?.toLocaleString()}
          icon={ShoppingCart}
          trend={analytics.monthlyGrowth}
          color="purple"
        />
        <StatCard
          title="Total Revenue"
          value={`$${analytics.totalRevenue?.toLocaleString()}`}
          icon={DollarSign}
          trend={18.7}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow p-6`}>
          <h3 className={`text-lg font-semibold ${theme.colors.textPrimary} mb-4`}>Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topSellingProducts?.map((product, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-sm ${theme.colors.textMuted}`}>{product.name}</span>
                <span className={`text-sm font-medium ${theme.colors.textPrimary}`}>{product.sales} sales</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow p-6`}>
          <h3 className={`text-lg font-semibold ${theme.colors.textPrimary} mb-4`}>Recent Orders</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center">
                <div>
                  <p className={`text-sm font-medium ${theme.colors.textPrimary}`}>#{order.id} - {order.customer}</p>
                  <p className={`text-xs ${theme.colors.textMuted}`}>{order.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${theme.colors.textPrimary}`}>${order.total}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.colors.bgSecondary} flex items-center justify-center`}>
        <div className={`animate-spin rounded-full h-32 w-32 border-b-2 ${theme.colors.primary}`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.colors.bgSecondary}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme.colors.textPrimary}`}>Admin Dashboard</h1>
          <p className={`mt-2 ${theme.colors.textMuted}`}>Manage your eCommerce platform</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'products', name: 'Products', icon: Package },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? `border-${theme.colors.primary} ${theme.colors.primary}`
                    : `border-transparent ${theme.colors.textMuted} hover:${theme.colors.textPrimary} hover:border-${theme.colors.border}`
                }`}
              >
                <Icon className="h-4 w-4" />
                {name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className={`${theme.colors.bg} border ${theme.colors.border} rounded-lg shadow-sm`}>
          <div className="p-6">
            {activeTab === 'overview' && <AnalyticsTab />}
            {activeTab === 'users' && <UserManagementTab />}
            {activeTab === 'products' && <ProductManagementTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;