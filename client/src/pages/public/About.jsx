import { useOutletContext, Link } from 'react-router-dom';

export default function About() {
  const { settings } = useOutletContext() || {};

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">About {settings?.restaurant_name || 'Us'}</h1>
      <p className="mt-4 leading-relaxed text-gray-600">
        {settings?.description ||
          'We are passionate about serving fresh, delicious meals made from quality ingredients. Whether you\'re dining in or ordering online, we aim to bring great food to your table every time.'}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-2xl font-bold text-brand-600">Fresh</p>
          <p className="mt-1 text-sm text-gray-500">Ingredients prepared daily</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-2xl font-bold text-brand-600">Fast</p>
          <p className="mt-1 text-sm text-gray-500">Quick order processing</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-2xl font-bold text-brand-600">Friendly</p>
          <p className="mt-1 text-sm text-gray-500">Service that cares</p>
        </div>
      </div>
      <div className="mt-10 text-center">
        <Link to="/menu" className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          View Our Menu
        </Link>
      </div>
    </div>
  );
}
