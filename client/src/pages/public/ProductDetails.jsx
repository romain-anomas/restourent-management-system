import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import { FiMinus, FiPlus, FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { productService } from '../../services/productService';
import { useCart } from '../../context/CartContext';
import { formatMoney } from '../../utils/format';
import LoadingScreen from '../../components/LoadingScreen';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useOutletContext() || {};
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    productService
      .getById(id)
      .then((data) => !cancelled && setProduct(data))
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingScreen label="Loading dish..." />;

  if (notFound || !product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-lg font-semibold text-ink-900">Product not found</h1>
        <p className="mt-2 text-sm text-gray-500">This dish may have been removed from the menu.</p>
        <Link to="/menu" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Back to menu
        </Link>
      </div>
    );
  }

  const img = product.image_path
    ? product.image_path.startsWith('http')
      ? product.image_path
      : `${API_ORIGIN}${product.image_path}`
    : null;

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    addItem({ id: product.id, name: product.name, selling_price: product.selling_price, image_path: product.image_path }, quantity);
    toast.success(`${quantity} × ${product.name} added to cart`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-ink-900"
      >
        <FiArrowLeft /> Back
      </button>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
          {img ? (
            <img src={img} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-gray-300">
              {product.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.category_name && (
            <span className="mb-2 w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {product.category_name}
            </span>
          )}
          <h1 className="text-2xl font-bold text-ink-900">{product.name}</h1>
          <p className="mt-3 text-gray-600">{product.description || 'No description available.'}</p>

          <p className="mt-6 text-2xl font-bold text-brand-700">
            {formatMoney(product.selling_price, settings?.currency)}
          </p>

          {!product.isAvailable ? (
            <p className="mt-4 w-fit rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              Currently out of stock
            </p>
          ) : (
            <>
              <div className="mt-6 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="flex items-center rounded-lg border border-gray-300">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <FiMinus />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-10 w-10 items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <FiPlus />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 sm:w-fit"
              >
                <FiShoppingCart /> Add to Cart
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
