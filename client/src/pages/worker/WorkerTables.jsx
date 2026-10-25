import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { tableService } from '../../services/tableService';
import { formatMoney } from '../../utils/format';

const statusColors = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  ORDERING: 'bg-amber-100 text-amber-700',
  PAYMENT_PENDING: 'bg-orange-100 text-orange-700',
  RESERVED: 'bg-sky-100 text-sky-700',
};

const cardColors = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50',
  OCCUPIED: 'border-red-200 bg-red-50',
  ORDERING: 'border-amber-200 bg-amber-50',
  PAYMENT_PENDING: 'border-orange-200 bg-orange-50',
  RESERVED: 'border-sky-200 bg-sky-50',
};

export default function WorkerTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await tableService.getSeatingPlan();
      setTables(data || []);
    } catch {
      toast.error('Failed to load seating plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Seating Plan</h1>
        <p className="text-sm text-gray-500">Live view of dine-in activity and table status.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-600">
        {Object.entries(statusColors).map(([status, cls]) => (
          <span key={status} className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{status}</span>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading seating plan...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tables.map((table) => (
            <div key={table.id} className={`rounded-2xl border p-4 shadow-sm ${cardColors[table.table_status || table.status] || cardColors.AVAILABLE}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-ink-900">{table.table_name || `Table ${table.table_number}`}</p>
                  <p className="text-xs text-gray-500">Capacity: {table.capacity}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[table.table_status || table.status] || statusColors.AVAILABLE}`}>
                  {table.table_status || table.status || 'AVAILABLE'}
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between"><span>Orders</span><span className="font-medium text-ink-900">{table.active_order_count || 0}</span></div>
                <div className="flex items-center justify-between"><span>Current total</span><span className="font-medium text-ink-900">{formatMoney(table.session_total || 0)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
