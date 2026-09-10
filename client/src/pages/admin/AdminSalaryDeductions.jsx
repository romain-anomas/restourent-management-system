import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiX } from 'react-icons/fi';
import { salaryDeductionService } from '../../services/salaryDeductionService';
import { formatMoney } from '../../utils/format';
import Badge from '../../components/Badge';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingScreen from '../../components/LoadingScreen';

export default function AdminSalaryDeductions() {
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirmAction, setConfirmAction] = useState(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    salaryDeductionService
      .list({ status: statusFilter || undefined })
      .then(setDeductions)
      .catch(() => toast.error('Failed to load salary deductions'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReview = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      const res = await salaryDeductionService.review(confirmAction.deduction.id, confirmAction.action);
      toast.success(res.message);
      setConfirmAction(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review deduction.');
    } finally {
      setProcessing(false);
    }
  };

  const pendingTotal = deductions
    .filter((d) => d.status === 'pending')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Salary Deductions</h1>
        <p className="text-sm text-gray-500">Review and approve deductions from approved worker stock-takings.</p>
      </div>

      {statusFilter === 'pending' && deductions.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {deductions.length} pending deduction(s) totaling {formatMoney(pendingTotal)}
        </div>
      )}

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
        </select>
      </div>

      {loading ? (
        <LoadingScreen label="Loading deductions..." />
      ) : deductions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No salary deductions found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deductions.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{d.worker_name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.product_name ? `${d.product_name} (${d.quantity})` : '—'}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{formatMoney(d.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{d.reason || '—'}</td>
                  <td className="px-4 py-3"><Badge status={d.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {d.status === 'pending' && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setConfirmAction({ deduction: d, action: 'approve' })}
                          className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          aria-label="Approve"
                        >
                          <FiCheck size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ deduction: d, action: 'reject' })}
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
        title={confirmAction?.action === 'approve' ? 'Approve Deduction' : 'Reject Deduction'}
        message={
          confirmAction?.action === 'approve'
            ? `Approve a salary deduction of ${formatMoney(confirmAction?.deduction.amount)} for ${confirmAction?.deduction.worker_name}?`
            : `Reject this deduction? The worker's stock-taking record stays approved, but no salary deduction will be applied.`
        }
        confirmLabel={confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
        danger={confirmAction?.action === 'reject'}
        loading={processing}
      />
    </div>
  );
}
