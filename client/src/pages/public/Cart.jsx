import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { FiMinus, FiPlus, FiTrash2, FiArrowRight, FiShoppingBag } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { formatMoney } from '../../utils/format';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

function imageUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}

export default function Cart() {
  const { settings } = useOutletContext() || {};
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <FiShoppingBag className="mx-auto mb-4 text-5xl text-gray-300" />
        <h1 className="text-lg font-semibold text-ink-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-gray-500">Browse our menu and add something delicious.</p>
        <Link
          to="/menu"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">Your Cart</h1>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
        {items.map((item) => {
          const img = imageUrl(item.imagePath);
          return (
            <div key={item.productId} className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {img ? (
                  <img src={img} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-300">
                    {item.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                <p className="text-xs text-gray-500">{formatMoney(item.unitPrice, settings?.currency)} each</p>
              </div>

              <div className="flex items-center rounded-lg border border-gray-200">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Decrease quantity"
                >
                  <FiMinus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Increase quantity"
                >
                  <FiPlus size={14} />
                </button>
              </div>

              <p className="w-24 shrink-0 text-right text-sm font-bold text-ink-900">
                {formatMoney(item.unitPrice * item.quantity, settings?.currency)}
              </p>

              <button
                onClick={() => removeItem(item.productId)}
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${item.name}`}
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-end gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Grand Total</p>
          <p className="text-2xl font-bold text-ink-900">{formatMoney(subtotal, settings?.currency)}</p>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 sm:w-auto"
        >
          Proceed to Checkout <FiArrowRight />
        </button>
      </div>
    </div>
  );
}
