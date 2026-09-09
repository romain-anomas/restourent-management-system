import { useEffect, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';
import { orderService } from '../../services/orderService';
import { formatMoney } from '../../utils/format';
import LoadingScreen from '../../components/LoadingScreen';

export default function OrderConfirmation() {
  const { id: orderNumber } = useParams();
  const { settings } = useOutletContext() || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    orderService
      .trackByNumber(orderNumber)
      .then(setOrder)
      .catch(() => setError('We could not find that order.'))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) return <LoadingScreen label="Fetching your order..." />;

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-ink-900">{error || 'Order not found'}</h1>
        <Link to="/menu" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <FiCheckCircle className="mx-auto mb-3 text-5xl text-green-500" />
        <h1 className="text-2xl font-bold text-ink-900">Order Placed!</h1>
        <p className="mt-1 text-sm text-gray-500">
          Thank you, {order.customer_name}. We've received your order.
        </p>
        <p className="mt-3 inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
          Order #{order.order_number}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Order Summary</h2>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-700">
            {order.status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-gray-600">
              <span>
                {item.quantity} × {item.product_name}
              </span>
              <span className="font-medium text-ink-900">
                {formatMoney(item.line_total, settings?.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal, settings?.currency)}</span>
          </div>
          {Number(order.tax) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax</span>
              <span>{formatMoney(order.tax, settings?.currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold text-ink-900">
            <span>Total</span>
            <span>{formatMoney(order.total_amount, settings?.currency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link to="/menu" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Order something else
        </Link>
      </div>
    </div>
  );
}
