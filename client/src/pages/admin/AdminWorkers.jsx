import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiKey, FiEye } from 'react-icons/fi';
import { workerService } from '../../services/workerService';
import SearchInput from '../../components/SearchInput';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingScreen from '../../components/LoadingScreen';
import { formatMoney } from '../../utils/format';

const EMPTY_FORM = { fullName: '', email: '', phone: '', password: '' };

export default function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    workerService
      .list({ search: search || undefined })
      .then(setWorkers)
      .catch(() => toast.error('Failed to load workers'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setFormModalOpen(true);
  };

  const openEdit = (w) => {
    setEditing(w);
    setForm({ fullName: w.full_name, email: w.email, phone: w.phone || '', password: '' });
    setError('');
    setFormModalOpen(true);
  };

  const openDetail = async (w) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const data = await workerService.getById(w.id);
      setDetail(data);
    } catch {
      toast.error('Failed to load worker profile');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await workerService.update(editing.id, form);
        toast.success('Worker updated');
        setFormModalOpen(false);
      } else {
        const res = await workerService.create(form);
        toast.success('Worker created');
        setFormModalOpen(false);
        if (res.data?.temporaryPassword) {
          setGeneratedPassword(res.data.temporaryPassword);
        }
      }
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save worker.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (w) => {
    try {
      await workerService.toggleStatus(w.id, w.status === 'active' ? 'disabled' : 'active');
      toast.success(w.status === 'active' ? 'Worker disabled' : 'Worker activated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await workerService.resetPassword(resetTarget.id, resetPassword || undefined);
      setGeneratedPassword(res.data.temporaryPassword);
      setResetTarget(null);
      setResetPassword('');
      toast.success('Password reset');
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Workers</h1>
          <p className="text-sm text-gray-500">Manage staff accounts and access.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FiPlus /> Add Worker
        </button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="mb-4 sm:max-w-xs" />

      {loading ? (
        <LoadingScreen label="Loading workers..." />
      ) : workers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No workers found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{w.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{w.email}</td>
                  <td className="px-4 py-3 text-gray-600">{w.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleStatus(w)}>
                      <Badge status={w.status} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {w.last_login_at ? new Date(w.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openDetail(w)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="View">
                        <FiEye size={15} />
                      </button>
                      <button onClick={() => openEdit(w)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Edit">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => setResetTarget(w)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Reset password">
                        <FiKey size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editing ? 'Edit Worker' : 'Add Worker'}
        footer={
          <>
            <button onClick={() => setFormModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Worker'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Initial Password</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Worker profile detail modal */}
      <Modal open={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Worker Profile">
        {detailLoading || !detail ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-ink-900">{detail.full_name}</p>
              <p className="text-sm text-gray-500">{detail.email}</p>
              <p className="text-sm text-gray-500">{detail.phone || '—'}</p>
              <div className="mt-2"><Badge status={detail.status} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-center">
              <div>
                <p className="text-lg font-bold text-ink-900">{detail.stats.ordersHandled}</p>
                <p className="text-xs text-gray-500">Orders Handled</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink-900">{detail.stats.stockTakings}</p>
                <p className="text-xs text-gray-500">Stock Takings</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink-900">{formatMoney(detail.stats.approvedSalaryDeductions)}</p>
                <p className="text-xs text-gray-500">Deductions</p>
              </div>
            </div>
            {detail.recentActivity?.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Recent Activity</h3>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {detail.recentActivity.map((a, i) => (
                    <div key={i}>{a.description || a.action} — {new Date(a.created_at).toLocaleString()}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset Password: ${resetTarget?.full_name || ''}`}
        footer={
          <>
            <button onClick={() => setResetTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resetting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
          <input
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Leave blank to auto-generate"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <p className="mt-2 text-xs text-gray-500">The worker will be required to change this password at next login.</p>
        </div>
      </Modal>

      {/* Show generated/reset password once */}
      <Modal open={!!generatedPassword} onClose={() => setGeneratedPassword('')} title="Password Set">
        <p className="text-sm text-gray-600">Share this password securely with the worker. It won't be shown again.</p>
        <p className="mt-3 rounded-lg bg-gray-100 px-4 py-3 text-center font-mono text-lg font-bold text-ink-900">
          {generatedPassword}
        </p>
      </Modal>
    </div>
  );
}
