import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiArrowDownCircle, FiArrowUpCircle, FiSliders, FiAlertTriangle, FiPlus, FiTrash2 } from 'react-icons/fi';
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

const TITLES = { 'stock-in': 'Stock In', 'stock-out': 'Stock Out', adjustment: 'Stock Adjustment' };

function emptyRow(mode) {
  return mode === 'adjustment'
    ? { productId: '', newQuantity: '' }
    : mode === 'stock-in'
    ? { productId: '', quantity: '', unitCost: '' }
    : { productId: '', quantity: '' };
}

/**
 * Bulk stock in/out/adjustment form: one or more product rows submitted
 * together in a single atomic request, sharing common fields (supplier/
 * reference/notes for stock-in, reason/notes for stock-out, reason for
 * adjustment) - matching how a real delivery invoice or stock count
 * usually covers many products at once.
 */
function ActionModal({ open, onClose, mode, products, onSubmit }) {
  const [rows, setRows] = useState([emptyRow(mode)]);
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setRows([emptyRow(mode)]);
      setSupplier('');
      setReference('');
      setReason('');
      setNotes('');
      setError('');
    }
  }, [open, mode]);

  const addRow = () => setRows((r) => [...r, emptyRow(mode)]);
  const removeRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const productById = (id) => products.find((p) => String(p.id) === String(id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validRows = rows.filter((r) => r.productId);
    if (validRows.length === 0) {
      setError('Add at least one product.');
      return;
    }
    if (mode === 'adjustment') {
      if (validRows.some((r) => r.newQuantity === '' || Number(r.newQuantity) < 0)) {
        setError('Every row needs a valid new quantity.');
        return;
      }
      if (!reason.trim()) {
        setError('A reason is required for adjustments.');
        return;
      }
    } else if (validRows.some((r) => !r.quantity || Number(r.quantity) <= 0)) {
      setError('Every row needs a valid positive quantity.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'stock-in') {
        await onSubmit({
          items: validRows.map((r) => ({ productId: r.productId, quantity: r.quantity, unitCost: r.unitCost || undefined })),
          supplier, reference, notes,
        });
      } else if (mode === 'stock-out') {
        await onSubmit({
          items: validRows.map((r) => ({ productId: r.productId, quantity: r.quantity })),
          reason, notes,
        });
      } else {
        await onSubmit({
          items: validRows.map((r) => ({ productId: r.productId, newQuantity: r.newQuantity })),
          reason,
        });
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
      title={TITLES[mode] || ''}
      maxWidth="max-w-2xl"
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

        {/* Product rows */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Products *</label>
            <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
              <FiPlus size={14} /> Add Product
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => {
              const product = productById(row.productId);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.productId}
                    onChange={(e) => updateRow(idx, 'productId', e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (current: {p.current_stock} {p.unit})</option>
                    ))}
                  </select>

                  {mode === 'adjustment' ? (
                    <input
                      type="number" min="0" step="1"
                      value={row.newQuantity}
                      onChange={(e) => updateRow(idx, 'newQuantity', e.target.value)}
                      placeholder="New qty"
                      className="input w-28"
                    />
                  ) : (
                    <input
                      type="number" min="1" step="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="input w-24"
                    />
                  )}

                  {mode === 'stock-in' && (
                    <input
                      type="number" min="0" step="1"
                      value={row.unitCost}
                      onChange={(e) => updateRow(idx, 'unitCost', e.target.value)}
                      placeholder="Unit cost"
                      className="input w-28"
                    />
                  )}

                  {product && (
                    <span className="hidden w-16 shrink-0 text-xs text-gray-400 sm:block">{product.unit}</span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                    className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {mode === 'stock-in' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Supplier</label>
                <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reference</label>
                <input
                  type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="Invoice/receipt number" className="input"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Supplier and reference apply to every product in this delivery.</p>
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
              className="input"
            />
            <p className="mt-1 text-xs text-gray-400">Applies to every product in this batch.</p>
          </div>
        )}

        {mode !== 'adjustment' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
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
          <p className="text-sm text-gray-500">Stock movements, adjustments, and low-stock alerts. Each form supports multiple products at once.</p>
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
