import { FiCreditCard, FiDollarSign, FiSmartphone } from 'react-icons/fi';

const STYLES = {
  momo: {
    bg: 'bg-[#FFCB05]', // MTN yellow
    text: 'text-[#1a1a1a]',
    label: 'MTN MoMo',
  },
  airtel_money: {
    bg: 'bg-[#ED1C24]', // Airtel red
    text: 'text-white',
    label: 'Airtel Money',
  },
  card: {
    bg: 'bg-slate-800',
    text: 'text-white',
    label: 'Card · Visa, Mastercard, American Express',
  },
  cash: {
    bg: 'bg-emerald-700',
    text: 'text-white',
    label: 'Cash',
  },
};

export const PAYMENT_METHOD_LABELS = {
  momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  cash: 'Cash',
  card: 'Card · Visa / Mastercard / AmEx',
};

/**
 * A clean, brand-colored icon badge for a payment method. This is an
 * original design (icon + brand color), not a reproduction of MTN's or
 * Airtel's actual trademarked logo artwork.
 */
export default function PaymentMethodBadge({ method, size = 40 }) {
  const style = STYLES[method];
  if (!style) return null;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}
      style={{ width: size, height: size }}
      aria-label={style.label}
    >
      {method === 'card' ? <FiCreditCard size={size * 0.5} /> : method === 'cash' ? <FiDollarSign size={size * 0.5} /> : <FiSmartphone size={size * 0.5} />}
    </div>
  );
}
