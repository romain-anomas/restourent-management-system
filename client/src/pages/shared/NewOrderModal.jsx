import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiFileText, FiCheckCircle } from 'react-icons/fi';
import { productService } from '../../services/productService';
import { orderService } from '../../services/orderService';
import { invoiceService } from '../../services/invoiceService';
import { formatMoney } from '../../utils/format';
import Modal from '../../components/Modal';

const EMPTY_ROW = { productId: '', quantity: 1 };
const EMPTY_FORM = { customerName: '', customerPhone: '', customerAddress: '', notes: '' };

export default function NewOrderModal({ open, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null); // success state
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => {
    if (open) {
      productService.getAll({ all: true }).then((data) => setProducts(data.filter((p) => p.is_active))).catch(() => {});
      setForm(EMPTY_FORM);
      setRows([{ ...EMPTY_ROW }]);
      setPaymentMethod('');
      setMarkPaid(false);
      setError('');
      setCreatedOrder(null);
    }
  }, [open]);

  const productById = (id) => products.find((p) => String(p.id) === String(id));

  const addRow = () => setRows((r) => [...r, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const total = rows.reduce((sum, row) => {
    const product = productById(row.productId);
    if (!product || !row.quantity) return sum;
    return sum + Number(product.selling_price) * Number(row.quantity);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const validRows = rows.filter((r) => r.productId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      setError('Add at least one product with a quantity.');
      return;
    }

    setSaving(true);
    try {
      const order = await orderService.createManual({
        ...form,
        items: validRows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) })),
        paymentMethod: paymentMethod || undefined,
        markPaid,
      });
      toast.success(`Order ${order.orderNumber} recorded`);
      setCreatedOrder(order);
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record order.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!createdOrder) return;
    setGeneratingInvoice(true);
    try {
      const invoice = await invoiceService.generate(createdOrder.id);
      await invoiceService.openPdf(invoice.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice.');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Success state - order was just created
  if (createdOrder) {
    return (
      <Modal open={open} onClose={onClose} title="Order Recorded">
        <div className="text-center">
          <FiCheckCircle className="mx-auto mb-3 text-4xl text-green-500" />
          <p className="text-sm text-gray-600">Order created for <strong>{form.customerName}</strong></p>
          <p className="mt-1 text-lg font-bold text-ink-900">{createdOrder.orderNumber}</p>
          <p className="text-sm text-gray-500">{formatMoney(createdOrder.totalAmount)}</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={handleGenerateInvoice}
              disabled={generatingInvoice}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <FiFileText size={15} /> {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Order"
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
            {saving ? 'Recording...' : 'Record Order'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Customer Name *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              className="input"
            />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Products *</label>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
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
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.selling_price)} (stock: {p.current_stock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                    className="input w-20"
                  />
                  <span className="w-24 shrink-0 text-right text-sm font-medium text-ink-900">
                    {product ? formatMoney(product.selling_price * row.quantity) : '—'}
                  </span>
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

          <div className="mt-3 flex justify-end border-t border-gray-100 pt-3 text-sm font-bold text-ink-900">
            Total: {formatMoney(total)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
              <option value="">Not specified yet</option>
              <option value="cash">Cash</option>
              <option value="momo">MTN MoMo</option>
              <option value="airtel_money">Airtel Money</option>
              <option value="card">Card (Visa / Mastercard / AmEx)</option>
            </select>
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={markPaid || paymentMethod === 'cash'}
                disabled={paymentMethod === 'cash'}
                onChange={(e) => setMarkPaid(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Mark as paid now
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="input"
          />
        </div>
      </form>
    </Modal>
  );
}
