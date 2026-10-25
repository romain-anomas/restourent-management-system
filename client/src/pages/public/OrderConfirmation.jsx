import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiLoader, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { formatMoney } from '../../utils/format';
import LoadingScreen from '../../components/LoadingScreen';
import PaymentMethodBadge from '../../components/PaymentMethodBadge';
import { formatTableLabel } from '../../utils/format';
import { useCart } from '../../context/CartContext';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000; // stop auto-polling after 2 minutes

export default function OrderConfirmation() {
  const { id: orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const { settings } = useOutletContext() || {};
  const { activeTableSession } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [momoStatus, setMomoStatus] = useState(null); // PENDING | SUCCESSFUL | FAILED | NOT_SENT | NOT_CONFIGURED
  const [resending, setResending] = useState(false);
  const [cardStatus, setCardStatus] = useState(null);
  const [retryingCard, setRetryingCard] = useState(false);
  const pollTimer = useRef(null);
  const pollStartedAt = useRef(null);

  useEffect(() => {
    orderService
      .trackByNumber(orderNumber)
      .then(setOrder)
      .catch(() => setError('We could not find that order.'))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  useEffect(() => {
    if (!order || searchParams.get('payment') !== 'card') return;
    if (searchParams.get('pending') === '1') {
      setCardStatus('PENDING');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    const result = searchParams.get('status');
    const transactionId = searchParams.get('transaction_id');
    const txRef = searchParams.get('tx_ref');
    if (result === 'successful' && transactionId && txRef) {
      setCardStatus('VERIFYING');
      paymentService.verifyCardPayment(orderNumber, { transactionId, txRef })
        .then((verification) => {
          if (verification.successful) {
            setCardStatus('SUCCESSFUL');
            setOrder((prev) => ({ ...prev, payment_status: 'paid' }));
            toast.success('Card payment received!');
          } else setCardStatus('FAILED');
        })
        .catch(() => setCardStatus('FAILED'));
    } else if (result === 'failed' || result === 'cancelled') {
      setCardStatus('CANCELLED');
    } else {
      setCardStatus('PENDING');
    }
    window.history.replaceState({}, '', window.location.pathname);
  // The callback parameters are read once after the order loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // Poll MTN MoMo status while payment is pending
  useEffect(() => {
    if (!order || order.order_type === 'DINE_IN' || order.payment_method !== 'momo' || order.payment_status === 'paid') return;

    pollStartedAt.current = Date.now();

    const poll = async () => {
      try {
        const result = await paymentService.checkMomoStatus(orderNumber);
        setMomoStatus(result.status);
        if (result.status === 'SUCCESSFUL') {
          setOrder((prev) => ({ ...prev, payment_status: 'paid' }));
          toast.success('Payment received!');
          return; // stop polling
        }
      } catch {
        // non-fatal - just try again next interval
      }
      if (Date.now() - pollStartedAt.current < POLL_TIMEOUT_MS) {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    poll();

    return () => clearTimeout(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.payment_method, order?.payment_status]);

  const handleResend = async () => {
    setResending(true);
    try {
      await paymentService.retryMomoRequest(orderNumber);
      toast.success('Payment request sent. Check your phone.');
      setMomoStatus('PENDING');
      pollStartedAt.current = Date.now();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend payment request.');
    } finally {
      setResending(false);
    }
  };

  const handleRetryCard = async () => {
    setRetryingCard(true);
    try {
      const checkoutUrl = await paymentService.retryCardCheckout(orderNumber);
      window.location.assign(checkoutUrl);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open secure card checkout.');
      setRetryingCard(false);
    }
  };

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

  const isPaid = order.payment_status === 'paid';
  const addedToBill = searchParams.get('added') === '1';
  const isMomoWaiting = order.order_type !== 'DINE_IN' && order.payment_method === 'momo' && !isPaid;
  const isOnlineCard = order.payment_method === 'card' && order.order_type !== 'DINE_IN';

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <FiCheckCircle className="mx-auto mb-3 text-5xl text-green-500" />
        <h1 className="text-2xl font-bold text-ink-900">{addedToBill ? 'Added to Your Table Bill' : 'Order Placed!'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {addedToBill ? `Your new items were added to the existing bill for ${order.customer_name}.` : `Thank you, ${order.customer_name}. We've received your order.`}
        </p>
        <p className="mt-3 inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
          Order #{order.order_number}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        {order.order_type === 'DINE_IN' && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5 text-sm">
            <span className="font-medium text-gray-600">Dine-in table</span>
            <span className="font-bold text-brand-700">{formatTableLabel(order)}</span>
          </div>
        )}
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

      {order.payment_method && (
        <div
          className={`mt-4 rounded-xl border p-5 ${
            isPaid ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="mb-3 flex items-center gap-3">
            <PaymentMethodBadge method={order.payment_method} size={32} />
            <div>
              <h2 className={`text-sm font-semibold ${isPaid ? 'text-green-800' : 'text-amber-800'}`}>
                {isPaid ? 'Payment Confirmed' : 'Complete Your Payment'}
              </h2>
              {isMomoWaiting && momoStatus === 'PENDING' && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <FiLoader className="animate-spin" size={12} /> Waiting for you to approve on your phone...
                </p>
              )}
            </div>
          </div>

          {!isPaid && (
            <>
              {order.order_type === 'DINE_IN' ? (
                <div className="space-y-1 text-sm text-amber-800">
                  <p>This order has been added to your table's running bill.</p>
                  <p>You can add more dishes whenever you like. Pay the full bill with staff when you are ready to leave.</p>
                </div>
              ) : order.payment_method === 'momo' ? (
                <div className="space-y-1 text-sm text-amber-800">
                  <p>If you didn't get a prompt, pay manually via MTN MoMo:</p>
                  <p>MoMo Code: <span className="font-semibold">{settings?.momo_code}</span></p>
                  <p>Or send to: <span className="font-semibold">{settings?.momo_number}</span> ({settings?.momo_name})</p>
                </div>
              ) : order.payment_method === 'airtel_money' ? (
                <div className="space-y-1 text-sm text-amber-800">
                  <p>Pay via Airtel Money:</p>
                  <p>Number: <span className="font-semibold">{settings?.airtel_money_number}</span></p>
                </div>
              ) : order.payment_method === 'cash' ? (
                <div className="space-y-1 text-sm text-amber-800">
                  <p>Pay the full table bill in cash with staff when you are ready to leave.</p>
                  <p>All orders placed during this table session will be included.</p>
                </div>
              ) : isOnlineCard ? (
                <div className="space-y-1 text-sm text-amber-800">
                  {cardStatus === 'VERIFYING' ? (
                    <p className="flex items-center gap-2"><FiLoader className="animate-spin" /> Verifying your card payment securely…</p>
                  ) : cardStatus === 'FAILED' ? (
                    <p>We couldn't verify the payment. If your bank shows a completed charge, contact the restaurant before trying again. Otherwise, you can reopen secure checkout.</p>
                  ) : cardStatus === 'CANCELLED' ? (
                    <p>The card payment was cancelled or declined. You can reopen secure checkout to try again.</p>
                  ) : (
                    <p>Complete payment securely with your card to confirm this order.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-sm text-amber-800">
                  <p>Pay with Visa, Mastercard, or American Express at the restaurant terminal.</p>
                  <p>Staff will confirm your payment after it is received. Card details are not collected online.</p>
                </div>
              )}
              {order.payment_reference && (
                <p className="mt-2 text-xs text-amber-700">Your reference: {order.payment_reference}</p>
              )}

              {order.order_type !== 'DINE_IN' && order.payment_method === 'momo' && (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  <FiRefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                  {resending ? 'Sending...' : 'Resend payment request'}
                </button>
              )}

              {order.order_type !== 'DINE_IN' && isOnlineCard && cardStatus !== 'VERIFYING' && (
                <button
                  onClick={handleRetryCard}
                  disabled={retryingCard}
                  className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  <FiRefreshCw size={12} className={retryingCard ? 'animate-spin' : ''} />
                  {retryingCard ? 'Opening secure checkout...' : 'Pay by card / Try again'}
                </button>
              )}

              {order.order_type !== 'DINE_IN' && !isOnlineCard && order.payment_method !== 'card' && <p className="mt-2 text-xs text-amber-700">We'll confirm your payment automatically once received.</p>}
            </>
          )}
        </div>
      )}

      <div className="mt-6 text-center">
        {order.order_type === 'DINE_IN' && activeTableSession
          && Number(activeTableSession.table?.id) === Number(order.table_id) ? (
            <Link to="/menu" className="inline-flex items-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
              Add more items to this table
            </Link>
          ) : (
            <Link to="/menu" className="text-sm font-medium text-brand-600 hover:text-brand-700">← Order something else</Link>
          )}
      </div>
    </div>
  );
}
