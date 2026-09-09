import { useAuth } from '../../context/AuthContext';

const STAT_PLACEHOLDERS = [
  { label: "Today's Sales", value: '—' },
  { label: "Today's Orders", value: '—' },
  { label: 'Pending Orders', value: '—' },
  { label: 'Low Stock Items', value: '—' },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Welcome back, {user?.fullName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">Here's what's happening at your restaurant today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_PLACEHOLDERS.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-ink-900">Authentication & access control is live ✅</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
          <li>• JWT login for Admin and Worker portals is working end-to-end.</li>
          <li>• Backend verifies role on every request via middleware, not just the frontend.</li>
          <li>• Full database schema (14 tables) is ready for the next phases to build on.</li>
          <li>• Next phase will connect real sales/orders/inventory stats to this dashboard.</li>
        </ul>
      </div>
    </div>
  );
}
