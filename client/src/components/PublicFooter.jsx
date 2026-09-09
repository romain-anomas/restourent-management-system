import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock } from 'react-icons/fi';

export default function PublicFooter({ settings }) {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-ink-900 text-gray-300">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              TB
            </div>
            <span className="font-bold text-white">{settings?.restaurant_name || 'Tasty Bites'}</span>
          </div>
          <p className="text-sm text-gray-400">
            {settings?.description || 'Fresh, delicious meals made with care, delivered to you.'}
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contact</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            {settings?.address && (
              <li className="flex items-start gap-2">
                <FiMapPin className="mt-0.5 shrink-0" /> {settings.address}
              </li>
            )}
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <FiPhone className="shrink-0" /> {settings.phone}
              </li>
            )}
            {settings?.email && (
              <li className="flex items-center gap-2">
                <FiMail className="shrink-0" /> {settings.email}
              </li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Opening Hours</h3>
          <p className="flex items-start gap-2 text-sm text-gray-400">
            <FiClock className="mt-0.5 shrink-0" />
            {settings?.opening_hours || 'Mon-Sun: 7:00 AM - 10:00 PM'}
          </p>
          <Link to="/menu" className="mt-4 inline-block text-sm font-medium text-brand-400 hover:text-brand-300">
            View our menu →
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {settings?.restaurant_name || 'Tasty Bites Restaurant'}. All rights reserved.
      </div>
    </footer>
  );
}
