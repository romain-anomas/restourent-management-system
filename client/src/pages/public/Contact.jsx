import { useOutletContext } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock } from 'react-icons/fi';

export default function Contact() {
  const { settings } = useOutletContext() || {};

  const items = [
    { icon: FiMapPin, label: 'Address', value: settings?.address || 'Kigali, Rwanda' },
    { icon: FiPhone, label: 'Phone', value: settings?.phone || '—' },
    { icon: FiMail, label: 'Email', value: settings?.email || '—' },
    { icon: FiClock, label: 'Opening Hours', value: settings?.opening_hours || 'Mon-Sun: 7AM - 10PM' },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Get in Touch</h1>
      <p className="mt-2 text-sm text-gray-500">We'd love to hear from you.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <Icon className="mt-0.5 shrink-0 text-lg text-brand-600" />
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-medium text-ink-900">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
