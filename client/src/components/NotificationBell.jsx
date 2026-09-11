import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const load = useCallback(() => {
    notificationService
      .list()
      .then(({ items: list, unreadCount: count }) => {
        setItems(list.slice(0, 8));
        setUnreadCount(count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = async (item) => {
    if (!item.is_read) {
      try {
        await notificationService.markAsRead(item.id);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: 1 } : i)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // non-fatal
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setItems((prev) => prev.map((i) => ({ ...i, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`block w-full border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-gray-50 ${
                    !item.is_read ? 'bg-brand-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!item.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-gray-500">{item.message}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {isAdmin && (
            <Link
              to="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-gray-50"
            >
              View all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
