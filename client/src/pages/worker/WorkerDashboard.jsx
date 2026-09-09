import { useAuth } from '../../context/AuthContext';

export default function WorkerDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Hi, {user?.fullName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">Your shift dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-medium text-gray-500">New Orders</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">—</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-medium text-gray-500">Preparing</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">—</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-medium text-gray-500">Completed Today</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">—</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5 text-sm text-gray-600">
        You're logged in as a Worker. Order management, inventory, and stock-taking tools will appear here in the next phase.
      </div>
    </div>
  );
}
