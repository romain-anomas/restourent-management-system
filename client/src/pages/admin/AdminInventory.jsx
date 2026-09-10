import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiArrowDownCircle, FiArrowUpCircle, FiSliders, FiAlertTriangle } from 'react-icons/fi';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingScreen from '../../components/LoadingScreen';

const TYPE_LABELS = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  adjustment: 'Adjustment',
  order_deduction: 'Order Deduction',
  worker_taking: 'Worker Taking',
};

const TYPE_BADGE = {
  stock_in: 'active',
  stock_out: 'disabled',
  adjustment: 'pending',
  order_deduction: 'confirmed',
  worker_taking: 'pending',
};

function ActionModal({ open, onClose, mode, products, onSubmit }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setProductId(''); setQuantity(''); setUnitCost(''); setSupplier('');
      setReference(''); setReason(''); setNotes(''); setError('');
    }
  }, [open, mode]);

  const titles = { 'stock-in': 'Stock In', 'stock-out': 'Stock Out', adjustment: 'Stock Adjustment' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!productId) {
      setError('Please select a product.');
      return;
    }
    if (mode !== 'adjustment' && (!quantity || Number(quantity) <= 0)) {
      setError('Please enter a valid quantity.');
      return;
    }
    if (mode === 'adjustment' && (quantity === '' || Number(quantity) < 0)) {
      setError('Please enter the new stock quantity.');
      return;
    }
    if (mode === 'adjustment' && !reason.trim()) {
      setError('A reason is required for adjustments.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'stock-in') {
        await onSubmit({ productId, quantity, unitCost, supplier, reference, notes });
      } else if (mode === 'stock-out') {
        await onSubmit({ productId, quantity, reason, notes });
      } else {
        await onSubmit({ productId, newQuantity: quantity, reason });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titles[mode] || ''}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Product *</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (current: {p.current_stock} {p.unit})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {mode === 'adjustment' ? 'New Stock Quantity *' : 'Quantity *'}
          </label>
          <input
            type="number" min="0" step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        {mode === 'stock-in' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unit Cost</label>
                <input
                  type="number" min="0" step="1"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice/receipt number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </>
        )}

        {(mode === 'stock-out' || mode === 'adjustment') && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason {mode === 'adjustment' ? '*' : ''}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === 'stock-out' ? 'e.g. Spoilage, kitchen use' : 'e.g. Physical count correction'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        )}

        {mode !== 'adjustment' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function AdminInventory() {
  const [transactions, setTransactions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [actionMode, setActionMode] = useState(null); // 'stock-in' | 'stock-out' | 'adjustment' | null

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      inventoryService.listTransactions({ type: typeFilter || undefined }),
      productService.getLowStock(),
      productService.getAll({ all: true }),
    ])
      .then(([txns, low, allProducts]) => {
        setTransactions(txns);
        setLowStock(low);
        setProducts(allProducts.filter((p) => p.is_active));
      })
      .catch(() => toast.error('Failed to load inventory data'))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (payload) => {
    if (actionMode === 'stock-in') {
      const res = await inventoryService.stockIn(payload);
      toast.success(res.message);
    } else if (actionMode === 'stock-out') {
      const res = await inventoryService.stockOut(payload);
      toast.success(res.message);
    } else {
      const res = await inventoryService.adjustment(payload);
      toast.success(res.message);
    }
    setActionMode(null);
    load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Inventory</h1>
          <p className="text-sm text-gray-500">Stock movements, adjustments, and low-stock alerts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActionMode('stock-in')}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <FiArrowUpCircle size={15} /> Stock In
          </button>
          <button
            onClick={() => setActionMode('stock-out')}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <FiArrowDownCircle size={15} /> Stock Out
          </button>
          <button
            onClick={() => setActionMode('adjustment')}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            <FiSliders size={15} /> Adjust
          </button>
        </div>
      </div>

      {/* Low stock section */}
      {lowStock.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <FiAlertTriangle /> Low Stock Alert ({lowStock.length})
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium text-ink-900">{p.name}</span>
                <span className="text-red-600">{p.current_stock} / {p.minimum_stock} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All transaction types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingScreen label="Loading inventory history..." />
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No inventory transactions yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Before → After</th>
                <th className="px-4 py-3">Reason / Reference</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{t.product_name || '—'}</td>
                  <td className="px-4 py-3"><Badge status={TYPE_BADGE[t.type]}>{TYPE_LABELS[t.type] || t.type}</Badge></td>
                  <td className="px-4 py-3 text-gray-700">{t.quantity > 0 ? '+' : ''}{t.quantity} {t.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{t.previous_stock} → {t.new_stock}</td>
                  <td className="px-4 py-3 text-gray-500">{t.reason || t.reference || t.supplier || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.created_by_name || 'System'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ActionModal
        open={!!actionMode}
        mode={actionMode}
        products={products}
        onClose={() => setActionMode(null)}
        onSubmit={handleAction}
      />
    </div>
  );
}
