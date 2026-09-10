import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiClock, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/orderService';
import StatCard from '../../components/StatCard';
import LoadingScreen from '../../components/LoadingScreen';

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderService
      .list({})
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen label="Loading your dashboard..." />;

  const newOrders = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length;
  const completedToday = orders.filter((o) => o.status === 'completed' && isToday(o.created_at)).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Hi, {user?.fullName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">Your shift dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="New Orders" value={newOrders} icon={FiShoppingBag} tone={newOrders > 0 ? 'danger' : 'default'} />
        <StatCard label="Preparing" value={preparing} icon={FiClock} />
        <StatCard label="Completed Today" value={completedToday} icon={FiCheckCircle} tone="success" />
      </div>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-ink-900">What you can do</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li>• Go to <Link to="/worker/orders" className="font-medium text-brand-600 hover:underline">Orders</Link> to accept and process incoming orders.</li>
          <li>• Check <Link to="/worker/inventory" className="font-medium text-brand-600 hover:underline">Inventory / Stock</Link> for current stock levels.</li>
          <li>• Update your password anytime from <Link to="/worker/profile" className="font-medium text-brand-600 hover:underline">Profile</Link>.</li>
        </ul>
      </div>
    </div>
  );
}
