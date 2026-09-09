import { Link } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { formatMoney } from '../utils/format';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

function imageUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}

export default function ProductCard({ product, currency = 'RWF' }) {
  const { addItem } = useCart();
  const img = imageUrl(product.image_path);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isAvailable) return;
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-300">
            {product.name?.charAt(0)}
          </div>
        )}
        {!product.isAvailable && (
          <span className="absolute left-2 top-2 rounded-full bg-gray-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
            Out of stock
          </span>
        )}
        {product.category_name && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-700">
            {product.category_name}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-ink-900">{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-sm font-bold text-brand-700">{formatMoney(product.selling_price, currency)}</span>
          <button
            onClick={handleAdd}
            disabled={!product.isAvailable}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            aria-label={`Add ${product.name} to cart`}
          >
            <FiPlus size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
