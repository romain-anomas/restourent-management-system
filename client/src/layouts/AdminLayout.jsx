import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  FiGrid, FiShoppingBag, FiTag, FiBox, FiUsers, FiPackage, FiDollarSign,
  FiTrendingUp, FiFileText, FiPieChart, FiBell, FiSettings, FiUser, FiTable,
} from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/admin/orders', label: 'Orders', icon: FiShoppingBag },
  { to: '/admin/tables', label: 'Tables', icon: FiTable },
  { to: '/admin/products', label: 'Products', icon: FiBox },
  { to: '/admin/categories', label: 'Categories', icon: FiTag },
  { to: '/admin/inventory', label: 'Inventory', icon: FiPackage },
  { to: '/admin/workers', label: 'Workers', icon: FiUsers },
  { to: '/admin/worker-stock', label: 'Worker Stock', icon: FiBox },
  { to: '/admin/salary-deductions', label: 'Salary Deductions', icon: FiDollarSign },
  { to: '/admin/expenses', label: 'Expenses', icon: FiTrendingUp },
  { to: '/admin/invoices', label: 'Invoices', icon: FiFileText },
  { to: '/admin/reports', label: 'Reports', icon: FiPieChart },
  { to: '/admin/notifications', label: 'Notifications', icon: FiBell },
  { to: '/admin/settings', label: 'Settings', icon: FiSettings },
  { to: '/admin/profile', label: 'Profile', icon: FiUser },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        items={NAV_ITEMS}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Tasty Bites"
        subtitle="Admin Panel"
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
