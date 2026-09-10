import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-lg font-semibold text-ink-900">Page not found</h1>
      <p className="text-sm text-gray-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
        Go home
      </Link>
    </div>
  );
}
