import { useState } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from '../../context/CartContext';
import { orderService } from '../../services/orderService';
import { formatMoney } from '../../utils/format';

export default function Checkout() {
  const { settings } = useOutletContext() || {};
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerAddress: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await orderService.create({
        ...form,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/order-confirmation/${order.orderNumber}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-ink-900">Your cart is empty</h1>
        <Link to="/menu" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">Checkout</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={update('customerName')}
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number *</label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={update('customerPhone')}
              placeholder="078xxxxxxx"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Delivery Address</label>
            <input
              type="text"
              value={form.customerAddress}
              onChange={update('customerAddress')}
              placeholder="Street, area, landmark (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Order Notes</label>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              placeholder="Any special requests? (optional)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Placing order...' : 'Place Order'}
          </button>
        </form>

        {/* Order summary */}
        <div className="h-fit rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between text-gray-600">
                <span className="truncate pr-2">
                  {i.quantity} × {i.name}
                </span>
                <span className="shrink-0 font-medium text-ink-900">
                  {formatMoney(i.unitPrice * i.quantity, settings?.currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-gray-100 pt-4 text-base font-bold text-ink-900">
            <span>Total</span>
            <span>{formatMoney(subtotal, settings?.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
