import { useEffect, useState, useCallback } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { productService } from '../../services/productService';
import SearchInput from '../../components/SearchInput';
import LoadingScreen from '../../components/LoadingScreen';

export default function WorkerInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    productService
      .getAll({ search: search || undefined })
      .then(setProducts)
      .catch(() => toast.error('Failed to load stock levels'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink-900">Inventory / Stock</h1>
        <p className="text-sm text-gray-500">Current stock levels. Contact an admin to record stock changes.</p>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="mb-4 sm:max-w-xs" />

      {loading ? (
        <LoadingScreen label="Loading stock levels..." />
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
          No products found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Minimum</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className={p.isLowStock ? 'bg-red-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{p.current_stock} {p.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{p.minimum_stock} {p.unit}</td>
                  <td className="px-4 py-3">
                    {p.isLowStock ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                        <FiAlertTriangle size={13} /> Low Stock
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-green-600">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
