import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiPlus } from 'react-icons/fi';
import { workerStockService } from '../../services/workerStockService';
import { productService } from '../../services/productService';
import { formatMoney } from '../../utils/format';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingScreen from '../../components/LoadingScreen';

export default function WorkerStockTaking() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([workerStockService.list(), productService.getAll()])
      .then(([recs, prods]) => {
        setRecords(recs);
        setProducts(prods);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    setProductId('');
    setQuantity('');
    setReason('');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!productId || !quantity || Number(quantity) <= 0) {
      setError('Please select a product and enter a valid quantity.');
      return;
    }
    setSaving(true);
    try {
      await workerStockService.create({ productId, quantity, reason });
      toast.success('Stock-taking recorded. It is pending admin review.');
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record stock-taking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Stock Taking</h1>
          <p className="text-sm text-gray-500">Record a product you took from stock. Subject to admin review.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FiPlus /> Record Stock Taken
        </button>
      </div>

      {loading ? (
        <LoadingScreen label="Loading your records..." />
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          You haven't recorded any stock takings yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.product_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.quantity} {r.unit}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(r.total_value)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.reason || '—'}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Stock Taken"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Submit'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This will immediately reduce stock and create a record for admin review. If approved, its value may be deducted from your salary after a separate admin approval.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (available: {p.current_stock} {p.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity *</label>
            <input
              type="number" min="0" step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Personal use"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
