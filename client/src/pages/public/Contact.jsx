import { useOutletContext } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock } from 'react-icons/fi';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';

// Turns a local Rwandan number like "0793450646" into "250793450646" for wa.me links.
function toWhatsAppNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('250')) return digits;
  if (digits.startsWith('0')) return `250${digits.slice(1)}`;
  return digits;
}

const DEFAULT_PHONE = '0793450646';
const DEFAULT_INSTAGRAM = 'https://www.instagram.com/kali_romain250/';

export default function Contact() {
  const { settings } = useOutletContext() || {};

  const phone = settings?.phone || DEFAULT_PHONE;
  const instagram = settings?.instagram_url || DEFAULT_INSTAGRAM;
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(phone)}`;

  const items = [
    {
      icon: FiMapPin,
      label: 'Address',
      value: settings?.address || 'Kigali, Rwanda',
      badgeClass: 'bg-brand-50 text-brand-600',
    },
    {
      icon: FiPhone,
      label: 'Phone',
      value: phone,
      href: `tel:${phone.replace(/\s/g, '')}`,
      badgeClass: 'bg-brand-50 text-brand-600',
    },
    {
      icon: FiMail,
      label: 'Email',
      value: settings?.email || '—',
      href: settings?.email ? `mailto:${settings.email}` : undefined,
      badgeClass: 'bg-brand-50 text-brand-600',
    },
    {
      icon: FiClock,
      label: 'Opening Hours',
      value: settings?.opening_hours || 'Mon-Sun: 7AM - 10PM',
      badgeClass: 'bg-brand-50 text-brand-600',
    },
    {
      icon: FaWhatsapp,
      label: 'WhatsApp',
      value: phone,
      href: whatsappUrl,
      external: true,
      badgeClass: 'bg-[#25D366] text-white',
    },
    {
      icon: FaInstagram,
      label: 'Instagram',
      value: '@kali_romain250',
      href: instagram,
      external: true,
      badgeClass: 'bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Get in Touch</h1>
      <p className="mt-2 text-sm text-gray-500">We'd love to hear from you.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value, href, external, badgeClass }) => {
          const content = (
            <>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
                <Icon className="text-base" />
              </span>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium text-ink-900">{value}</p>
              </div>
            </>
          );

          const cardClasses =
            'flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200 hover:shadow-md';

          return href ? (
            <a
              key={label}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className={cardClasses}
            >
              {content}
            </a>
          ) : (
            <div key={label} className={cardClasses}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}