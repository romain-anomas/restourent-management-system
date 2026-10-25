import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiUser } from 'react-icons/fi';
import Modal from '../../components/Modal';
import { orderService } from '../../services/orderService';
import { tableService } from '../../services/tableService';
import { formatMoney, formatTableLabel } from '../../utils/format';

const statusColors = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  ORDERING: 'bg-amber-100 text-amber-700',
  PAYMENT_PENDING: 'bg-orange-100 text-orange-700',
  RESERVED: 'bg-sky-100 text-sky-700',
};

const cardColors = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50',
  OCCUPIED: 'border-red-200 bg-red-50',
  ORDERING: 'border-amber-200 bg-amber-50',
  PAYMENT_PENDING: 'border-orange-200 bg-orange-50',
  RESERVED: 'border-sky-200 bg-sky-50',
};

const diningAreas = ['Main dining area', 'Left dining area', 'Right dining area'];

export default function AdminTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [section, setSection] = useState('Main dining area');
  const [positionX, setPositionX] = useState('');
  const [positionY, setPositionY] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [status, setStatus] = useState('AVAILABLE');
  const [editingId, setEditingId] = useState(null);
  const [viewingTable, setViewingTable] = useState(null);
  const [tableOrderData, setTableOrderData] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await tableService.list({ all: 1 });
      setTables(data || []);
    } catch {
      toast.error('Failed to load table data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setName('');
    setNumber('');
    setSection('Main dining area');
    setPositionX('');
    setPositionY('');
    setCapacity(4);
    setStatus('AVAILABLE');
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!number.trim()) return toast.error('Table number is required.');
    try {
      const payload = { tableNumber: number, tableName: name || null, capacity: Number(capacity || 2), section: section.trim() || null, status, positionX: positionX === '' ? null : Number(positionX), positionY: positionY === '' ? null : Number(positionY) };
      if (editingId) await tableService.update(editingId, payload);
      else await tableService.create(payload);
      toast.success(editingId ? 'Table updated.' : 'Table created.');
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save table.');
    }
  };

  const startEdit = (table) => {
    setEditingId(table.id);
    setNumber(table.table_number || '');
    setName(table.table_name || '');
    setCapacity(table.capacity || 2);
    const savedArea = diningAreas.find((area) => area.toLowerCase() === String(table.section || '').toLowerCase());
    const hasPosition = table.position_x != null && table.position_y != null
      && Number.isFinite(Number(table.position_x)) && Number.isFinite(Number(table.position_y))
      && (Number(table.position_x) !== 0 || Number(table.position_y) !== 0);
    const areaFromPosition = !hasPosition ? 'Main dining area'
      : Number(table.position_x) < 38 ? 'Left dining area'
        : Number(table.position_y) >= 62 || (Number(table.position_x) >= 38 && Number(table.position_x) < 67) ? 'Main dining area'
          : 'Right dining area';
    setSection(savedArea || areaFromPosition);
    setPositionX(table.position_x ?? '');
    setPositionY(table.position_y ?? '');
    setStatus(table.effective_status || table.status || 'AVAILABLE');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeactivate = async (table) => {
    try {
      await tableService.remove(table.id);
      toast.success('Table deactivated.');
      if (Number(editingId) === Number(table.id)) resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate table.');
    }
  };

  const handleSession = async (table) => {
    try {
      if (table.session_id) await tableService.closeSession(table.id);
      else await tableService.openSession(table.id);
      toast.success(table.session_id ? 'Table is available again.' : 'Table marked occupied.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update table session.');
    }
  };

  const viewOrders = async (table) => {
    setViewingTable(table);
    setTableOrderData(null);
    setLoadingOrders(true);
    try {
      setTableOrderData(await tableService.getOrders(table.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load table orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const markOrderPaid = async (order) => {
    setPayingOrderId(order.id);
    try {
      const result = await orderService.updatePaymentStatus(order.id, 'paid');
      if (result.tableSessionClosed) {
        toast.success('All table orders are paid. The table is available again.');
        setViewingTable(null);
        setTableOrderData(null);
      } else {
        toast.success(`${order.order_number} marked paid.`);
        await viewOrders(viewingTable);
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payment.');
    } finally {
      setPayingOrderId(null);
    }
  };

  const closeViewedSession = async () => {
    if (!viewingTable) return;
    try {
      await tableService.closeSession(viewingTable.id);
      toast.success('Payment complete. Table session closed and table is available.');
      setViewingTable(null);
      setTableOrderData(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Table session could not be closed.');
    }
  };

  const viewedOrders = tableOrderData?.orders || [];
  const viewedTotal = viewedOrders.reduce((total, order) => total + Number(order.total_amount || 0), 0);
  const unpaidTotal = viewedOrders.reduce((total, order) => total + (order.payment_status === 'paid' ? 0 : Number(order.total_amount || 0)), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Tables & Seating Plan</h1>
        <p className="text-sm text-gray-500">Add, edit, reserve, occupy, and deactivate tables here. Occupied tables are blocked from new guest orders until their session is closed.</p>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-4 xl:grid-cols-8">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Table Number</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="input" placeholder="Table 4" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Window side" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Capacity</label>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Dining area</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="input">
            {diningAreas.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Map X (%)</label>
          <input type="number" min="0" max="100" value={positionX} onChange={(e) => setPositionX(e.target.value)} className="input" placeholder="Auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Map Y (%)</label>
          <input type="number" min="0" max="100" value={positionY} onChange={(e) => setPositionY(e.target.value)} className="input" placeholder="Auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input" disabled={Boolean(editingId && tables.find((table) => Number(table.id) === Number(editingId))?.session_id)}>
            {Object.keys(statusColors).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleSave} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            <FiPlus size={14} /> {editingId ? 'Save changes' : 'Add table'}
          </button>
        </div>
        <p className="col-span-full text-xs text-gray-500">Map positions are optional. Leave both empty to place the table automatically in the floor plan; set X and Y from 0–100 to position it precisely.</p>
        {editingId && <button type="button" onClick={resetForm} className="text-sm font-medium text-gray-500 hover:text-gray-800">Cancel edit</button>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-600">
        {Object.entries(statusColors).map(([status, cls]) => (
          <span key={status} className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{status}</span>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading tables...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tables.map((table) => (
            <div key={table.id} className={`rounded-2xl border p-4 shadow-sm ${table.is_active ? (cardColors[table.effective_status || table.status] || cardColors.AVAILABLE) : 'border-gray-200 bg-gray-100 opacity-75'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-ink-900">{formatTableLabel(table)}</p>
                  <p className="text-xs text-gray-500">Capacity: {table.capacity} · {table.section || 'Main floor'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${table.is_active ? (statusColors[table.effective_status || table.status] || statusColors.AVAILABLE) : 'bg-gray-200 text-gray-700'}`}>
                  {table.is_active ? (table.effective_status || table.status || 'AVAILABLE') : 'INACTIVE'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between"><span>Session</span><span className="font-medium text-ink-900">{table.session_number || 'No active session'}</span></div>
                <div className="flex items-center justify-between"><span>Orders</span><span className="font-medium text-ink-900">{table.active_order_count || 0}</span></div>
                <div className="flex items-center justify-between"><span>Total</span><span className="font-medium text-ink-900">{formatMoney(table.session_total || 0)}</span></div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500"><FiUser size={12} /> {table.section || 'Main floor'}</div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button onClick={() => startEdit(table)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">Edit</button>
                  <button onClick={() => viewOrders(table)} className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">Orders & payment</button>
                  <button onClick={() => handleSession(table)} disabled={!table.is_active || (!table.session_id && (table.effective_status || table.status) !== 'AVAILABLE') || (table.session_id && Number(table.unpaid_order_count) > 0)} title={table.session_id && Number(table.unpaid_order_count) > 0 ? 'Mark all orders paid before closing this table.' : ''} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${table.session_id ? 'border-emerald-200 bg-white text-emerald-700' : 'border-amber-200 bg-white text-amber-700'} disabled:cursor-not-allowed disabled:opacity-50`}>
                    {table.session_id ? 'Close session' : 'Occupy'}
                  </button>
                  {table.is_active ? <button onClick={() => handleDeactivate(table)} disabled={Boolean(table.session_id)} className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Deactivate</button> : <button onClick={() => tableService.update(table.id, { tableNumber: table.table_number, tableName: table.table_name, capacity: table.capacity, section: table.section, status: 'AVAILABLE' }).then(() => { toast.success('Table reactivated.'); load(); }).catch((err) => toast.error(err.response?.data?.message || 'Failed to reactivate table.'))} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Reactivate</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(viewingTable)}
        onClose={() => { setViewingTable(null); setTableOrderData(null); }}
        title={viewingTable ? `${formatTableLabel(viewingTable)} · Orders & payment` : 'Table orders'}
        maxWidth="max-w-2xl"
        footer={tableOrderData?.session ? (
          <button type="button" onClick={closeViewedSession} disabled={unpaidTotal > 0} title={unpaidTotal > 0 ? 'All orders must be paid before this session can close.' : ''} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {unpaidTotal > 0 ? `Payment due ${formatMoney(unpaidTotal)}` : 'Payment complete · close table'}
          </button>
        ) : null}
      >
        {loadingOrders ? <p className="py-8 text-center text-sm text-gray-500">Loading table orders…</p> : !tableOrderData?.session ? (
          <div className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-600">There is no active session or open order for this table.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Table status</p><p className="mt-1 font-semibold text-ink-900">{tableOrderData.session.status}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Ordered amount</p><p className="mt-1 font-semibold text-ink-900">{formatMoney(viewedTotal)}</p></div>
              <div className={`rounded-xl p-3 ${unpaidTotal > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><p className="text-xs text-gray-500">Amount still due</p><p className={`mt-1 font-semibold ${unpaidTotal > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(unpaidTotal)}</p></div>
            </div>

            {viewedOrders.length === 0 ? <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">No orders have been placed in this session.</p> : viewedOrders.map((order) => (
              <section key={order.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-ink-900">{order.order_number} · {order.customer_name}</p><p className="text-xs text-gray-500">{order.customer_phone} · {new Date(order.created_at).toLocaleString()}</p></div>
                  <div className="text-right"><p className="font-bold text-ink-900">{formatMoney(order.total_amount)}</p><p className={`text-xs font-semibold ${order.payment_status === 'paid' ? 'text-emerald-700' : 'text-red-700'}`}>{order.payment_status === 'paid' ? 'Paid' : 'Payment due'}</p><p className="text-[11px] capitalize text-gray-500">{order.payment_method?.replace('_', ' ') || 'Payment method not selected'}</p></div>
                </div>
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
                  {order.items.map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between gap-3 text-gray-600"><span>{item.quantity} × {item.name}</span><span className="shrink-0">{formatMoney(item.line_total)}</span></div>)}
                </div>
                {order.payment_status !== 'paid' && <button type="button" onClick={() => markOrderPaid(order)} disabled={payingOrderId === order.id} className="mt-3 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{payingOrderId === order.id ? 'Saving…' : 'Mark payment received'}</button>}
              </section>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
