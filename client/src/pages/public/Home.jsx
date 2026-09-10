import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { FiArrowRight, FiClock, FiMapPin, FiPhone } from 'react-icons/fi';
import { categoryService } from '../../services/categoryService';
import { productService } from '../../services/productService';
import ProductCard from '../../components/ProductCard';

export default function Home() {
  const { settings } = useOutletContext() || {};
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([categoryService.getAll(), productService.getAll({ limit: 8 })])
      .then(([cats, products]) => {
        if (cancelled) return;
        setCategories(cats);
        setFeatured(products);
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
          setFeatured([]);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 via-white to-orange-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:flex-row">
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              Freshly made, every day
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl lg:text-5xl">
              {settings?.restaurant_name || 'Tasty Bites Restaurant'}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-gray-600 lg:mx-0">
              {settings?.description ||
                'Delicious local and international dishes, prepared fresh and delivered fast. Order online in seconds.'}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/menu"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700"
              >
                Order Now <FiArrowRight />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-gray-50"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="flex-1">
            <div className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-700 text-6xl font-black text-white/90 shadow-xl">
              🍽️
            </div>
          </div>
        </div>
      </section>

      {/* Quick info strip */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6">
          <div className="flex items-center gap-3">
            <FiClock className="text-xl text-brand-600" />
            <div>
              <p className="text-xs text-gray-500">Opening Hours</p>
              <p className="text-sm font-medium text-ink-900">{settings?.opening_hours || 'Mon-Sun: 7AM - 10PM'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FiMapPin className="text-xl text-brand-600" />
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm font-medium text-ink-900">{settings?.address || 'Kigali, Rwanda'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FiPhone className="text-xl text-brand-600" />
            <div>
              <p className="text-xs text-gray-500">Call to order</p>
              <p className="text-sm font-medium text-ink-900">{settings?.phone || '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-bold text-ink-900">Browse Categories</h2>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/menu?category=${c.slug}`}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-brand-500 hover:text-brand-700"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink-900">Popular Right Now</h2>
          <Link to="/menu" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            View full menu <FiArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
            No products available yet. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} currency={settings?.currency} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
