import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { expenseService } from '../../services/expenseService';
import { formatMoney } from '../../utils/format';
import SearchInput from '../../components/SearchInput';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingScreen from '../../components/LoadingScreen';

const CATEGORIES = [
  { value: 'food_supplies', label: 'Food Supplies' },
  { value: 'transport', label: 'Transport' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'rent', label: 'Rent' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { title: '', category: 'other', amount: '', description: '', reference: '', expenseDate: todayStr() };

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    expenseService
      .list({ search: search || undefined, category: categoryFilter || undefined, from: fromDate || undefined, to: toDate || undefined })
      .then(({ items, total: t }) => {
        setExpenses(items);
        setTotal(t);
      })
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, [search, categoryFilter, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditing(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      description: exp.description || '',
      reference: exp.reference || '',
      expenseDate: exp.expense_date,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) {
      setError('Title and a positive amount are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await expenseService.update(editing.id, form);
        toast.success('Expense updated');
      } else {
        await expenseService.create(form);
        toast.success('Expense recorded');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expenseService.remove(deleteTarget.id);
      toast.success('Expense deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Expenses</h1>
          <p className="text-sm text-gray-500">Track business expenses that factor into your profit calculation.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FiPlus /> Add Expense
        </button>
      </div>

      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        Total for current filter: {formatMoney(total)}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title..." className="sm:max-w-xs" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          placeholder="To"
        />
      </div>

      {loading ? (
        <LoadingScreen label="Loading expenses..." />
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No expenses found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{e.title}</td>
                  <td className="px-4 py-3 text-gray-600">{categoryLabel(e.category)}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{formatMoney(e.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{e.expense_date}</td>
                  <td className="px-4 py-3 text-gray-500">{e.recorded_by_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(e)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Edit">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(e)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Expense'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Amount *</label>
              <input
                type="number" min="0" step="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reference / Receipt #</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
