import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiX } from 'react-icons/fi';
import { workerStockService } from '../../services/workerStockService';
import { formatMoney } from '../../utils/format';
import Badge from '../../components/Badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingScreen from '../../components/LoadingScreen';

export default function AdminWorkerStock() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirmAction, setConfirmAction] = useState(null); // { record, action }
  const [processing, setProcessing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    workerStockService
      .list({ status: statusFilter || undefined })
      .then(setRecords)
      .catch(() => toast.error('Failed to load stock-taking records'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReview = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      const res = await workerStockService.review(confirmAction.record.id, confirmAction.action);
      toast.success(res.message);
      setConfirmAction(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review record.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Worker Stock Taking</h1>
        <p className="text-sm text-gray-500">Review products workers have taken from stock.</p>
      </div>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deducted">Deducted</option>
        </select>
      </div>

      {loading ? (
        <LoadingScreen label="Loading records..." />
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.worker_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.product_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.quantity} {r.unit}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(r.total_value)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.reason || '—'}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setConfirmAction({ record: r, action: 'approve' })}
                          className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          aria-label="Approve"
                        >
                          <FiCheck size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ record: r, action: 'reject' })}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          aria-label="Reject"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleReview}
        title={confirmAction?.action === 'approve' ? 'Approve Record' : 'Reject Record'}
        message={
          confirmAction?.action === 'approve'
            ? `Approve this record? A pending salary deduction of ${formatMoney(confirmAction?.record.total_value)} will be created for further review.`
            : `Reject this record? The stock will be restored to "${confirmAction?.record.product_name}".`
        }
        confirmLabel={confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
        danger={confirmAction?.action === 'reject'}
        loading={processing}
      />
    </div>
  );
}
