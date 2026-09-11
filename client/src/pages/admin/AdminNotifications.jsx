import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiCheck } from 'react-icons/fi';
import { notificationService } from '../../services/notificationService';
import LoadingScreen from '../../components/LoadingScreen';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString();
}

export default function AdminNotifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    notificationService
      .list({ unreadOnly })
      .then(({ items: list, unreadCount: count }) => {
        setItems(list);
        setUnreadCount(count);
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      load();
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      toast.success('All notifications marked as read');
      load();
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Notifications</h1>
          <p className="text-sm text-gray-500">New orders, stock-taking requests, and pending deductions.</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FiCheck size={14} /> Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <label className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        Show unread only
      </label>

      {loading ? (
        <LoadingScreen label="Loading notifications..." />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <FiBell className="mx-auto mb-3 text-3xl text-gray-300" />
          <p className="text-sm text-gray-500">No notifications to show.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between gap-4 px-4 py-4 ${!item.is_read ? 'bg-brand-50/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                {!item.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                <div>
                  <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{item.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(item.created_at)}</p>
                </div>
              </div>
              {!item.is_read && (
                <button
                  onClick={() => handleMarkRead(item.id)}
                  className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600"
                  aria-label="Mark as read"
                >
                  <FiCheck size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
