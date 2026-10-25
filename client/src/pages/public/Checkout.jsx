import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiCopy, FiXCircle, FiLoader, FiGrid, FiCreditCard, FiDollarSign } from 'react-icons/fi';
import PaymentMethodBadge from '../../components/PaymentMethodBadge';
import { useCart } from '../../context/CartContext';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { tableService } from '../../services/tableService';
import { formatMoney, formatTableLabel } from '../../utils/format';

function CopyableRow({ label, value }) {
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left hover:bg-gray-50"
    >
      <span>
        <span className="block text-[11px] text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-ink-900">{value || '—'}</span>
      </span>
      <FiCopy className="shrink-0 text-gray-400" size={14} />
    </button>
  );
}

const CARD_BRANDS = {
  visa: { label: 'Visa', wordmark: 'VISA', background: 'from-[#173B78] via-[#1767B2] to-[#62B5E5]' },
  mastercard: { label: 'Mastercard', wordmark: 'mastercard', background: 'from-[#202433] via-[#262B39] to-[#B83232]' },
  amex: { label: 'American Express', wordmark: 'AMERICAN EXPRESS', background: 'from-[#07529B] via-[#1476C5] to-[#72B8E8]' },
};

function CardPreview({ brand, customerName }) {
  const selected = CARD_BRANDS[brand];
  return (
    <div className={`relative mx-auto aspect-[1.65/1] w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br ${selected.background} p-5 text-white shadow-lg`}>
      <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full border border-white/20" />
      <div className="absolute -right-2 -top-7 h-44 w-44 rounded-full border border-white/10" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-12 items-center justify-center rounded-md border border-white/40 bg-white/20">
            <span className="text-[10px] font-bold tracking-widest">CHIP</span>
          </div>
          <span className={`text-right font-extrabold ${brand === 'amex' ? 'text-[9px] leading-tight tracking-wider' : 'text-lg italic tracking-tight'}`}>
            {selected.wordmark}
          </span>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-lg tracking-[0.2em] sm:text-xl">
            <FiCreditCard className="shrink-0" size={19} /> <span>•••• •••• •••• ••••</span>
          </div>
          <div className="flex justify-between gap-3 text-[10px] uppercase tracking-widest text-white/80">
            <span className="truncate">{customerName || 'Cardholder name'}</span>
            <span>•• / ••</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { settings } = useOutletContext() || {};
  const { items, subtotal, clearCart, selectedTable, setSelectedTable, activeTableSession, setActiveTableSession } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', notes: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [cardBrand, setCardBrand] = useState('visa');
  const [orderType, setOrderType] = useState(selectedTable ? 'DINE_IN' : 'ONLINE');
  const [tables, setTables] = useState([]);
  const [phoneValidation, setPhoneValidation] = useState(null); // 'checking' | true | false | null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isContinuingTableSession = orderType === 'DINE_IN'
    && Boolean(activeTableSession?.accessToken)
    && Number(activeTableSession?.table?.id) === Number(selectedTable?.id);

  useEffect(() => {
    if (orderType !== 'DINE_IN') return;
    tableService.getPublicTables()
      .then((result) => {
        setTables(result || []);
        const ownSessionTable = (result || []).find((table) => Number(table.id) === Number(activeTableSession?.table?.id)
          && Number(table.session_id) === Number(activeTableSession?.sessionId));
        if (ownSessionTable) setSelectedTable(ownSessionTable);
        else if (activeTableSession) {
          setActiveTableSession(null);
          setSelectedTable(null);
        } else if (selectedTable && !(result || []).some((table) => Number(table.id) === Number(selectedTable.id)
          && table.status === 'AVAILABLE' && !table.session_id)) {
          setSelectedTable(null);
        }
      })
      .catch(() => setTables([]));
  }, [orderType]);

  useEffect(() => {
    if (!isContinuingTableSession) return;
    let cancelled = false;
    tableService.getGuestSession(activeTableSession.sessionId, activeTableSession.accessToken)
      .then((result) => {
        if (cancelled) return;
        if (result.guest) {
          setForm((current) => ({
            ...current,
            customerName: result.guest.customerName || current.customerName,
            customerPhone: result.guest.customerPhone === 'N/A' ? '' : (result.guest.customerPhone || current.customerPhone),
          }));
        }
        if (result.paymentMethod) setPaymentMethod((current) => current || result.paymentMethod);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the guest details for this table. Please refresh or ask a team member for help.');
      });
    return () => { cancelled = true; };
  }, [isContinuingTableSession, activeTableSession?.sessionId, activeTableSession?.accessToken]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Live-validate the phone number as a real MoMo account once the
  // customer picks MoMo and types a plausible number - catches typos
  // before checkout instead of a silent failed payment prompt.
  useEffect(() => {
    if (paymentMethod !== 'momo' || orderType === 'DINE_IN' || form.customerPhone.replace(/\D/g, '').length < 9) {
      setPhoneValidation(null);
      return;
    }
    setPhoneValidation('checking');
    const timer = setTimeout(async () => {
      try {
        const valid = await paymentService.validateMomoNumber(form.customerPhone);
        setPhoneValidation(valid);
      } catch {
        setPhoneValidation(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [paymentMethod, form.customerPhone, orderType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isContinuingTableSession && (!form.customerName.trim() || !form.customerPhone.trim())) {
      setError('Please enter your name and phone number.');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!paymentMethod) {
      setError('Please choose a payment method.');
      return;
    }
    if (paymentMethod === 'card' && orderType !== 'DINE_IN' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      setError('Enter a valid email address for your secure card payment receipt.');
      return;
    }
    if (orderType === 'DINE_IN' && !selectedTable?.id) {
      setError('Please choose your table before placing the order.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await orderService.create({
        ...form,
        paymentMethod,
        paymentReference,
        orderType,
        tableId: orderType === 'DINE_IN' ? selectedTable.id : null,
        ...(orderType === 'DINE_IN' && activeTableSession && Number(activeTableSession.table?.id) === Number(selectedTable.id)
          ? { tableSessionId: activeTableSession.sessionId, tableSessionToken: activeTableSession.accessToken }
          : {}),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      clearCart();
      if (orderType === 'DINE_IN') {
        const table = { ...selectedTable, status: 'ORDERING', session_id: order.tableSessionId };
        setSelectedTable(table);
        if (order.tableSessionAccessToken || activeTableSession?.accessToken) {
          setActiveTableSession({
            table,
            sessionId: order.tableSessionId,
            accessToken: order.tableSessionAccessToken || activeTableSession.accessToken,
          });
        }
      } else {
        setSelectedTable(null);
      }
      if (paymentMethod === 'card' && orderType !== 'DINE_IN' && order.cardCheckoutUrl) {
        window.location.assign(order.cardCheckoutUrl);
        return;
      }
      const addedToBill = orderType === 'DINE_IN' && order.isAdditionalOrder;
      toast.success(addedToBill ? 'Items added to your table bill.' : 'Order placed successfully!');
      const confirmationParams = new URLSearchParams();
      if (paymentMethod === 'card' && orderType !== 'DINE_IN') {
        confirmationParams.set('payment', 'card');
        confirmationParams.set('pending', '1');
      }
      if (addedToBill) confirmationParams.set('added', '1');
      const query = confirmationParams.toString();
      navigate(`/order-confirmation/${order.orderNumber}${query ? `?${query}` : ''}`, { replace: true });
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
            <p className="mb-2 block text-sm font-medium text-gray-700">How would you like your order?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setOrderType('ONLINE'); if (paymentMethod === 'card') setPaymentMethod(''); }} className={`rounded-xl border-2 p-3 text-left ${orderType === 'ONLINE' ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}>
                <span className="block text-sm font-semibold text-ink-900">Delivery</span><span className="mt-1 block text-xs text-gray-500">Send it to your address</span>
              </button>
              <button type="button" onClick={() => setOrderType('DINE_IN')} className={`rounded-xl border-2 p-3 text-left ${orderType === 'DINE_IN' ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}>
                <span className="block text-sm font-semibold text-ink-900">Dine in</span><span className="mt-1 block text-xs text-gray-500">Order for a restaurant table</span>
              </button>
            </div>
          </div>

          {orderType === 'DINE_IN' && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900"><FiGrid className="text-brand-600" /> Choose your table</div>
              {tables.length === 0 ? (
                <p className="text-sm text-gray-600">No tables are available for online ordering. <Link to="/seating" className="font-semibold text-brand-600">View seating plan</Link></p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tables.map((table) => {
                    const available = table.status === 'AVAILABLE' && !table.session_id;
                    const ownSession = Number(activeTableSession?.table?.id) === Number(table.id)
                      && Number(activeTableSession?.sessionId) === Number(table.session_id);
                    const active = (available || ownSession) && Number(selectedTable?.id) === Number(table.id);
                    return <button key={table.id} type="button" disabled={!available && !ownSession} onClick={() => setSelectedTable(table)} className={`rounded-lg border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-brand-600 bg-white ring-1 ring-brand-600' : 'border-gray-200 bg-white hover:border-brand-300'}`}>
                      <span className="block text-sm font-semibold text-ink-900">{formatTableLabel(table)}</span>
                      <span className={`mt-0.5 block text-[11px] font-medium ${available ? 'text-emerald-700' : table.status === 'RESERVED' ? 'text-sky-700' : table.status === 'PAYMENT_PENDING' ? 'text-orange-700' : 'text-red-700'}`}>
                        {ownSession ? 'Your table · bill is open' : available ? 'Available' : table.status === 'RESERVED' ? 'Reserved' : table.status === 'PAYMENT_PENDING' ? 'Occupied · payment pending' : 'Occupied · ordering closed'} · {table.capacity} seats
                      </span>
                    </button>;
                  })}
                </div>
              )}
              {selectedTable && <p className="mt-2 text-xs font-medium text-brand-700">Selected: {formatTableLabel(selectedTable)}</p>}
            </div>
          )}

          {isContinuingTableSession && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              Adding to your existing table bill. Guest details are reused from the first order.
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={update('customerName')}
              placeholder="Your name"
              readOnly={isContinuingTableSession}
              required={!isContinuingTableSession}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number *</label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={update('customerPhone')}
              placeholder="078xxxxxxx"
              readOnly={isContinuingTableSession}
              required={!isContinuingTableSession}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            {paymentMethod === 'momo' && phoneValidation === 'checking' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <FiLoader className="animate-spin" size={11} /> Checking MoMo number...
              </p>
            )}
            {paymentMethod === 'momo' && phoneValidation === true && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <FiCheckCircle size={11} /> Active MoMo number
              </p>
            )}
            {paymentMethod === 'momo' && phoneValidation === false && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <FiXCircle size={11} /> This number doesn't have an active MoMo account. Double-check it, or you can still pay manually using the details below.
              </p>
            )}
          </div>

          {paymentMethod === 'card' && orderType !== 'DINE_IN' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email for payment receipt *</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={update('customerEmail')}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}

          {orderType === 'ONLINE' && <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Delivery Address</label>
            <input
              type="text"
              value={form.customerAddress}
              onChange={update('customerAddress')}
              placeholder="Street, area, landmark (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Order Notes</label>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              placeholder="Any special requests? (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Payment Method *</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                  paymentMethod === 'momo' ? 'border-[#FFCB05] bg-[#FFCB05]/10' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <PaymentMethodBadge method="momo" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900">MTN MoMo</span>
                    {paymentMethod === 'momo' && <FiCheckCircle className="shrink-0 text-brand-600" />}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{orderType === 'DINE_IN' ? 'Settle the table bill with staff when leaving' : 'Automatic payment prompt to your phone'}</p>
                </div>
              </button>

              <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                    paymentMethod === 'card' ? 'border-slate-700 bg-slate-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <PaymentMethodBadge method="card" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink-900">Credit or Debit Card</span>
                      {paymentMethod === 'card' && <FiCheckCircle className="shrink-0 text-brand-600" />}
                    </div>
                  <p className="mt-0.5 text-xs text-gray-500">{orderType === 'DINE_IN' ? 'Pay at the restaurant terminal' : 'Secure online payment with Visa, Mastercard, American Express and more'}</p>
                  </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('airtel_money')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                  paymentMethod === 'airtel_money' ? 'border-[#ED1C24] bg-[#ED1C24]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <PaymentMethodBadge method="airtel_money" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900">Airtel Money</span>
                    {paymentMethod === 'airtel_money' && <FiCheckCircle className="shrink-0 text-brand-600" />}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{orderType === 'DINE_IN' ? 'Settle the table bill with staff when leaving' : 'Pay with the number shown below'}</p>
                </div>
              </button>

              {orderType === 'DINE_IN' && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${paymentMethod === 'cash' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <PaymentMethodBadge method="cash" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink-900">Cash</span>
                      {paymentMethod === 'cash' && <FiCheckCircle className="shrink-0 text-emerald-700" />}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">Pay the full table bill when leaving</p>
                  </div>
                </button>
              )}
            </div>

            {paymentMethod === 'cash' && orderType === 'DINE_IN' && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <FiDollarSign className="shrink-0" /> Cash will be collected by staff when you finish. All orders at this table will be included in the bill.
              </div>
            )}

            {paymentMethod === 'momo' && (
              orderType === 'DINE_IN' ? (
                <div className="mt-3 rounded-xl bg-[#FFCB05]/10 p-3 text-sm text-gray-700">This order will be added to your table bill. Pay the full bill with staff when you are ready to leave.</div>
              ) : <div className="mt-3 space-y-1.5 rounded-xl bg-[#FFCB05]/10 p-3">
                <p className="px-1 text-xs font-medium text-ink-900">
                  After placing your order, you'll get a payment prompt on your phone to approve. If you don't see it, you can also pay directly using the details below.
                </p>
                <CopyableRow label="MoMo Code" value={settings?.momo_code} />
                <CopyableRow label="MoMo Number" value={settings?.momo_number} />
                <CopyableRow label="Registered Name" value={settings?.momo_name} />
              </div>
            )}

            {paymentMethod === 'airtel_money' && (
              orderType === 'DINE_IN' ? (
                <div className="mt-3 rounded-xl bg-[#ED1C24]/5 p-3 text-sm text-gray-700">This order will be added to your table bill. Pay the full bill with staff when you are ready to leave.</div>
              ) : <div className="mt-3 space-y-1.5 rounded-xl bg-[#ED1C24]/5 p-3">
                <p className="px-1 text-xs font-medium text-[#ED1C24]">
                  Send payment via Airtel Money to the number below, then enter the confirmation SMS code.
                </p>
                <CopyableRow label="Airtel Money Number" value={settings?.airtel_money_number} />
              </div>
            )}

            {paymentMethod === 'card' && (
              orderType === 'DINE_IN' ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-medium">This order will be added to your table bill.</p>
                  <p className="mt-1 text-xs">Pay the full bill with your card at the restaurant when you are ready to leave. Card details are not collected on this website.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink-900">Choose your card style</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {Object.entries(CARD_BRANDS).map(([brand, option]) => (
                        <button key={brand} type="button" onClick={() => setCardBrand(brand)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${cardBrand === brand ? 'border-brand-600 bg-white text-brand-700 ring-1 ring-brand-600' : 'border-gray-200 bg-white text-gray-600'}`}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <CardPreview brand={cardBrand} customerName={form.customerName} />
                  </div>
                  <p className="text-xs leading-relaxed text-gray-600">
                    Your card number, expiry date, and security code are entered on Flutterwave's secure checkout page. They are never sent to or stored by this restaurant website.
                    {!settings?.card_payments_enabled && <span className="mt-1 block font-medium text-amber-700">Online card checkout still needs to be enabled by the restaurant.</span>}
                  </p>
                </div>
              )
            )}

            {paymentMethod && paymentMethod !== 'card' && orderType !== 'DINE_IN' && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Transaction Reference <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. MP240912.1234.A56789"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? (paymentMethod === 'card' && orderType !== 'DINE_IN' ? 'Opening secure checkout...' : 'Placing order...') : paymentMethod === 'card' && orderType !== 'DINE_IN' ? 'Continue to secure card payment' : 'Place Order'}
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
