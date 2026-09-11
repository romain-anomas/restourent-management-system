import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity } from 'react-icons/fi';
import { activityService } from '../../services/activityService';
import LoadingScreen from '../../components/LoadingScreen';

const ACTION_LABELS = {
  login: 'Logged in',
  logout: 'Logged out',
  change_password: 'Changed password',
  update_order_status: 'Updated order status',
  stock_in: 'Recorded stock in',
  stock_out: 'Recorded stock out',
  worker_stock_taking: 'Recorded stock taken',
  generate_invoice: 'Generated an invoice',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

export default function WorkerActivity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activityService
      .list()
      .then(setItems)
      .catch(() => toast.error('Failed to load your activity'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">My Activity</h1>
        <p className="text-sm text-gray-500">A record of your actions in the system.</p>
      </div>

      {loading ? (
        <LoadingScreen label="Loading your activity..." />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <FiActivity className="mx-auto mb-3 text-3xl text-gray-300" />
          <p className="text-sm text-gray-500">No recorded activity yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3.5">
              <p className="text-sm font-medium capitalize text-ink-900">{actionLabel(item.action)}</p>
              {item.description && <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>}
              <p className="mt-1 text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
