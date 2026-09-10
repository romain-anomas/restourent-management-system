import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiEye, FiDownload } from 'react-icons/fi';
import { invoiceService } from '../../services/invoiceService';
import { formatMoney } from '../../utils/format';
import SearchInput from '../../components/SearchInput';
import LoadingScreen from '../../components/LoadingScreen';

const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    invoiceService
      .list({ search: search || undefined, paymentStatus: paymentFilter || undefined })
      .then(setInvoices)
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false));
  }, [search, paymentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleView = async (invoice) => {
    setBusyId(invoice.id);
    try {
      await invoiceService.openPdf(invoice.id);
    } catch {
      toast.error('Failed to open invoice');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (invoice) => {
    setBusyId(invoice.id);
    try {
      await invoiceService.downloadPdf(invoice.id, `${invoice.invoice_number}.pdf`);
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setBusyId(null);
    }
  };

  const handlePaymentStatusChange = async (invoice, newStatus) => {
    try {
      await invoiceService.updatePaymentStatus(invoice.id, newStatus);
      toast.success('Payment status updated');
      load();
    } catch {
      toast.error('Failed to update payment status');
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Invoices</h1>
        <p className="text-sm text-gray-500">
          Invoices are generated from an order's detail view. Browse, view, print, or download them here.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoice #, order #, customer..." className="sm:max-w-xs" />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingScreen label="Loading invoices..." />
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No invoices yet. Generate one from an order's detail view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.order_number}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.customer_name}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{formatMoney(inv.grand_total)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={inv.payment_status}
                      onChange={(e) => handlePaymentStatusChange(inv, e.target.value)}
                      className="rounded-full border-0 bg-transparent text-xs font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleView(inv)}
                        disabled={busyId === inv.id}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                        aria-label="View/Print"
                      >
                        <FiEye size={15} />
                      </button>
                      <button
                        onClick={() => handleDownload(inv)}
                        disabled={busyId === inv.id}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                        aria-label="Download"
                      >
                        <FiDownload size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
