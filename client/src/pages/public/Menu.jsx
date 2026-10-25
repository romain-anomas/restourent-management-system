import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { FiSearch, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCart } from '../../context/CartContext';
import { tableService } from '../../services/tableService';
import { formatMoney, formatTableLabel } from '../../utils/format';
import { categoryService } from '../../services/categoryService';
import { productService } from '../../services/productService';
import ProductCard from '../../components/ProductCard';

export default function Menu() {
  const { settings } = useOutletContext() || {};
  const { activeTableSession, setActiveTableSession, setSelectedTable } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') || '';

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openTableBill, setOpenTableBill] = useState(null);

  useEffect(() => {
    if (!activeTableSession?.sessionId || !activeTableSession?.accessToken) {
      setOpenTableBill(null);
      return;
    }
    let active = true;
    tableService.getGuestSession(activeTableSession.sessionId, activeTableSession.accessToken)
      .then((bill) => active && setOpenTableBill(bill))
      .catch((err) => {
        if (err.response?.status === 404 && active) {
          setActiveTableSession(null);
          setSelectedTable(null);
          setOpenTableBill(null);
          toast('That table session has closed. Choose an available table to start a new order.');
        }
      });
    return () => { active = false; };
  }, [activeTableSession?.sessionId, activeTableSession?.accessToken]);

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productService
      .getAll({ category: activeCategory || undefined, search: debouncedSearch || undefined })
      .then((data) => !cancelled && setProducts(data))
      .catch(() => !cancelled && setProducts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeCategory, debouncedSearch]);

  const setCategory = (slug) => {
    if (slug) {
      setSearchParams({ category: slug });
    } else {
      setSearchParams({});
    }
  };

  const activeCategoryName = useMemo(
    () => categories.find((c) => c.slug === activeCategory)?.name,
    [categories, activeCategory]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Our Menu</h1>
        <p className="mt-1 text-sm text-gray-500">
          {activeCategoryName ? `Showing: ${activeCategoryName}` : 'Browse everything we offer'}
        </p>
      </div>

      {activeTableSession && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900"><FiClock /> Your table is open · {formatTableLabel(activeTableSession.table)}</p>
            <p className="mt-1 text-xs text-brand-800">Add dishes whenever you like. They will be added to this table's running bill and paid together when you leave.</p>
          </div>
          {openTableBill && <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm"><p className="text-[11px] font-medium text-gray-500">Current table bill</p><p className="text-lg font-bold text-ink-900">{formatMoney(openTableBill.totalAmount, settings?.currency)}</p></div>}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search dishes..."
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {/* Category filter pills */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setCategory('')}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            !activeCategory ? 'bg-brand-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-brand-400'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.slug)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCategory === c.slug
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:border-brand-400'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No dishes found. Try a different search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} currency={settings?.currency} />
          ))}
        </div>
      )}
    </div>
  );
}
