import { useOutletContext, Link } from 'react-router-dom';

// Fallbacks used when these fields aren't present on `settings` yet.
const DEFAULTS = {
  name: 'Tic Tac Restaurant',
  description:
    "Tucked into Cyimihurura's quiet streets, Tic Tac has been plating honest, generous meals since 2014 — the kind of place regulars bring first dates and then, a year later, bring the whole family.",
  neighborhood: 'Cyimihurura, Kigali',
  address: 'KG 9 Ave, Cyimihurura, Kigali, Rwanda',
  phone: '0788 123 456',
  email: 'hello@tictacrestaurant.rw',
  hours: [
    { day: 'Monday – Friday', time: '7:00 AM – 10:00 PM' },
    { day: 'Saturday – Sunday', time: '8:00 AM – 11:00 PM' },
  ],
  // Approximate coordinates for Cyimihurura, Kigali.
  lat: -1.9536,
  lng: 30.0865,
};

export default function About() {
  const { settings } = useOutletContext() || {};
  const s = { ...DEFAULTS, ...settings };

  const bbox = [s.lng - 0.008, s.lat - 0.006, s.lng + 0.008, s.lat + 0.006].join(',');
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${s.lat},${s.lng}`;
  const directionsUrl = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-[#FBF7F2]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-medium text-brand-600">{s.neighborhood}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
            {s.name}
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed text-gray-600">{s.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/menu"
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              View our menu
            </Link>
            <Link
              to="/contact"
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-ink-900 transition hover:border-gray-400"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { title: 'Fresh', desc: 'Produce sourced from Kigali markets every morning.' },
            { title: 'Fast', desc: 'Order to table, without the wait.' },
            { title: 'Friendly', desc: 'A team that remembers your name and your order.' },
          ].map((v) => (
            <div key={v.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-xl font-bold text-brand-600">{v.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Location & Map */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-0 sm:px-6 md:grid-cols-2">
          <div className="flex flex-col justify-center px-4 py-14 sm:px-0">
            <h2 className="text-2xl font-bold text-ink-900">Find us in {s.neighborhood.split(',')[0]}</h2>
            <p className="mt-3 max-w-sm leading-relaxed text-gray-600">
              We're a short walk from the main avenue, with parking right outside and a quiet garden
              seating area out back.
            </p>

            <dl className="mt-8 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <PinIcon />
                <dd className="text-gray-700">{s.address}</dd>
              </div>
              <div className="flex items-start gap-3">
                <PhoneIcon />
                <dd className="text-gray-700">{s.phone}</dd>
              </div>
              <div className="flex items-start gap-3">
                <MailIcon />
                <dd className="text-gray-700">{s.email}</dd>
              </div>
              <div className="flex items-start gap-3">
                <ClockIcon />
                <dd className="text-gray-700">
                  {s.hours.map((h) => (
                    <div key={h.day}>
                      <span className="font-medium text-ink-900">{h.day}:</span> {h.time}
                    </div>
                  ))}
                </dd>
              </div>
            </dl>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Get directions
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="h-72 w-full overflow-hidden sm:h-auto sm:rounded-xl sm:my-8 sm:shadow-sm md:my-14">
            <iframe
              title={`Map showing ${s.name} in ${s.neighborhood}`}
              src={mapSrc}
              className="h-full w-full min-h-[320px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-ink-900">Hungry already?</h2>
        <p className="mt-2 text-gray-600">Browse the menu and order ahead for pickup or delivery.</p>
        <Link
          to="/menu"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          View our menu
        </Link>
      </section>
    </div>
  );
}

function PinIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}