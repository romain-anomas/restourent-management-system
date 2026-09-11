import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { settingsService } from '../../services/settingsService';
import LoadingScreen from '../../components/LoadingScreen';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const imageUrl = (p) => (p ? (p.startsWith('http') ? p : `${API_ORIGIN}${p}`) : null);

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    settingsService
      .getAdmin()
      .then((data) => {
        setForm({
          restaurantName: data?.restaurant_name || '',
          phone: data?.phone || '',
          email: data?.email || '',
          address: data?.address || '',
          description: data?.description || '',
          openingHours: data?.opening_hours || '',
          currency: data?.currency || 'RWF',
          taxPercent: data?.tax_percent ?? 0,
          invoicePrefix: data?.invoice_prefix || 'INV',
          orderPrefix: data?.order_prefix || 'ORD',
          allowNegativeStockDefault: !!data?.allow_negative_stock_default,
        });
        setLogoPreview(imageUrl(data?.logo_path));
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update({ ...form, logoFile });
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <LoadingScreen label="Loading settings..." />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-gray-500">Restaurant information and business configuration.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Restaurant info */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Restaurant Information</h2>

          <div className="mb-4 flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">Logo</div>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Upload logo
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Restaurant Name">
              <input type="text" value={form.restaurantName} onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))} className="input" />
            </Field>
            <Field label="Phone">
              <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" />
            </Field>
            <Field label="Opening Hours">
              <input type="text" value={form.openingHours} onChange={(e) => setForm((f) => ({ ...f, openingHours: e.target.value }))} placeholder="Mon-Sun: 7AM - 10PM" className="input" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Address">
              <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="input" />
            </Field>
          </div>
        </div>

        {/* Business settings */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Business Settings</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Currency">
              <input type="text" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="input" />
            </Field>
            <Field label="Tax %">
              <input type="number" min="0" step="0.5" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} className="input" />
            </Field>
            <Field label="Invoice Prefix">
              <input type="text" value={form.invoicePrefix} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))} className="input" />
            </Field>
            <Field label="Order Prefix">
              <input type="text" value={form.orderPrefix} onChange={(e) => setForm((f) => ({ ...f, orderPrefix: e.target.value }))} className="input" />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.allowNegativeStockDefault}
              onChange={(e) => setForm((f) => ({ ...f, allowNegativeStockDefault: e.target.checked }))}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Allow negative stock by default for new products
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
