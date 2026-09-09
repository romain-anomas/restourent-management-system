import { NavLink } from 'react-router-dom';

/**
 * `items` = [{ to, label, icon: IconComponent }]
 * `open` / `onClose` control the mobile drawer behaviour.
 */
export default function Sidebar({ items, open, onClose, title, subtitle }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-ink-900 text-gray-200 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            TB
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{title}</p>
            <p className="text-xs text-gray-400 leading-tight">{subtitle}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {Icon && <Icon className="text-lg" />}
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
