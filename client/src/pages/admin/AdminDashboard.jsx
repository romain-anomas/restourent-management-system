import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  FiDollarSign, FiShoppingBag, FiClock, FiBox, FiAlertTriangle, FiUsers, FiTrendingUp,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { formatMoney } from '../../utils/format';
import StatCard from '../../components/StatCard';
import LoadingScreen from '../../components/LoadingScreen';

const PIE_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardService
      .getStats()
      .then(setStats)
      .catch(() => setError('Could not load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen label="Loading dashboard..." />;

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">
        {error || 'No data available.'}
      </div>
    );
  }

  const salesChartData = stats.charts.salesOverTime.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: Number(d.total),
  }));
  const ordersChartData = stats.charts.ordersOverTime.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: Number(d.count),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Welcome back, {user?.fullName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">Here's what's happening at your restaurant today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today's Sales" value={formatMoney(stats.today.sales)} icon={FiDollarSign} />
        <StatCard label="Today's Orders" value={stats.today.orders} icon={FiShoppingBag} />
        <StatCard label="Pending Orders" value={stats.today.pendingOrders} icon={FiClock} />
        <StatCard
          label="Low Stock Items"
          value={stats.inventory.lowStockCount}
          icon={FiAlertTriangle}
          tone={stats.inventory.lowStockCount > 0 ? 'danger' : 'default'}
        />
        <StatCard label="Completed Today" value={stats.today.completedOrders} icon={FiShoppingBag} tone="success" />
        <StatCard label="Cancelled Today" value={stats.today.cancelledOrders} icon={FiShoppingBag} />
        <StatCard label="Active Products" value={stats.inventory.totalProducts} icon={FiBox} />
        <StatCard label="Active Workers" value={stats.workers.total} icon={FiUsers} />
      </div>

      {/* Finance summary */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="This Month's Revenue" value={formatMoney(stats.finance.monthRevenue)} icon={FiTrendingUp} />
        <StatCard label="Inventory Value" value={formatMoney(stats.inventory.inventoryValue)} icon={FiBox} />
        <StatCard
          label="Est. Profit (this month)"
          value={formatMoney(stats.finance.estimatedProfit)}
          icon={FiDollarSign}
          tone={stats.finance.estimatedProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Sales — Last 7 Days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="total" stroke="#ea580c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Orders — Last 7 Days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={35} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Best-Selling Products</h2>
          {stats.charts.bestSellingProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No sales data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.charts.bestSellingProducts} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#ea580c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Category Performance</h2>
          {stats.charts.categoryPerformance.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No sales data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.charts.categoryPerformance}
                    dataKey="revenue"
                    nameKey="category"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {stats.charts.categoryPerformance.map((entry, i) => (
                      <Cell key={entry.category || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
