import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FiGrid, FiShoppingBag, FiPackage, FiClipboard, FiActivity, FiUser, FiSettings } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const NAV_ITEMS = [
  { to: '/worker', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/worker/orders', label: 'Orders', icon: FiShoppingBag },
  { to: '/worker/inventory', label: 'Inventory/Stock', icon: FiPackage },
  { to: '/worker/stock-taking', label: 'Stock Taking', icon: FiClipboard },
  { to: '/worker/activity', label: 'Activity', icon: FiActivity },
  { to: '/worker/profile', label: 'Profile', icon: FiUser },
  { to: '/worker/settings', label: 'Settings', icon: FiSettings },
];

export default function WorkerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        items={NAV_ITEMS}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Tasty Bites"
        subtitle="Worker Panel"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
