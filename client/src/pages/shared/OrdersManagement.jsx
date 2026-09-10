import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiEye, FiFileText } from 'react-icons/fi';
import { orderService } from '../../services/orderService';
import { invoiceService } from '../../services/invoiceService';
import { formatMoney } from '../../utils/format';
import SearchInput from '../../components/SearchInput';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingScreen from '../../components/LoadingScreen';

const STATUS_OPTIONS = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

/**
 * Shared order management board used by both the Admin "Orders" page and
 * the Worker "Orders" page - the backend already scopes what each role
 * can see/do via authorize('admin','worker'), so the UI is identical
 * except for the heading copy.
 */
export default function OrdersManagement({ title = 'Orders', subtitle = 'View and manage all customer orders.' }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    orderService
      .list({ search: search || undefined, status: statusFilter || undefined })
      .then(setOrders)
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (order) => {
    setDetailLoading(true);
    setSelectedOrder({ id: order.id }); // open modal immediately with loading state
    try {
      const full = await orderService.getById(order.id);
      setSelectedOrder(full);
    } catch {
      toast.error('Failed to load order details');
      setSelectedOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await orderService.updateStatus(selectedOrder.id, newStatus);
      toast.success(`Order marked as ${newStatus}`);
      const full = await orderService.getById(selectedOrder.id);
      setSelectedOrder(full);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateOrViewInvoice = async () => {
    if (!selectedOrder) return;
    setInvoiceLoading(true);
    try {
      let invoiceId = selectedOrder.invoice?.id;
      if (!invoiceId) {
        const invoice = await invoiceService.generate(selectedOrder.id);
        invoiceId = invoice.id;
        setSelectedOrder((prev) => ({ ...prev, invoice: { id: invoice.id, invoice_number: invoice.invoice_number, payment_status: invoice.payment_status } }));
        toast.success('Invoice generated');
        load();
      }
      await invoiceService.openPdf(invoiceId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate/open invoice.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">{title}</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search order #, customer, phone..." className="sm:max-w-xs" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingScreen label="Loading orders..." />
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No orders found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.customer_name}
                    <div className="text-xs text-gray-400">{o.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-900">{formatMoney(o.total_amount)}</td>
                  <td className="px-4 py-3"><Badge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetail(o)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      aria-label="View order"
                    >
                      <FiEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order ${selectedOrder?.order_number || ''}`} maxWidth="max-w-xl">
        {detailLoading || !selectedOrder?.order_number ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading order...</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink-900">{selectedOrder.customer_name}</p>
                <p className="text-xs text-gray-500">{selectedOrder.customer_phone}</p>
                {selectedOrder.customer_address && (
                  <p className="text-xs text-gray-500">{selectedOrder.customer_address}</p>
                )}
              </div>
              <Badge status={selectedOrder.status} />
            </div>

            {selectedOrder.notes && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">Note: {selectedOrder.notes}</p>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</h3>
              <div className="space-y-1.5 text-sm">
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-gray-600">
                    <span>{item.quantity} × {item.product_name}</span>
                    <span className="font-medium text-ink-900">{formatMoney(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-bold text-ink-900">
                <span>Total</span>
                <span>{formatMoney(selectedOrder.total_amount)}</span>
              </div>
            </div>

            {selectedOrder.history?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">History</h3>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {selectedOrder.history.map((h, i) => (
                    <div key={i}>
                      {h.old_status ? `${h.old_status} → ${h.new_status}` : `Order placed (${h.new_status})`}
                      {h.changed_by_name && ` by ${h.changed_by_name}`} — {new Date(h.created_at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              {!['completed', 'cancelled'].includes(selectedOrder.status) && (
                <>
                  {NEXT_STATUS[selectedOrder.status] && (
                    <button
                      onClick={() => handleStatusChange(NEXT_STATUS[selectedOrder.status])}
                      disabled={updating}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      Mark as {NEXT_STATUS[selectedOrder.status]}
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={updating}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Cancel Order
                  </button>
                </>
              )}
              {selectedOrder.status !== 'cancelled' && (
                <button
                  onClick={handleGenerateOrViewInvoice}
                  disabled={invoiceLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gray-50 disabled:opacity-60"
                >
                  <FiFileText size={15} />
                  {invoiceLoading ? 'Please wait...' : selectedOrder.invoice ? `View Invoice (${selectedOrder.invoice.invoice_number})` : 'Generate Invoice'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
