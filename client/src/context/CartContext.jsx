import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'tastybites_cart';
const TABLE_STORAGE_KEY = 'tastybites_selected_table';
const TABLE_SESSION_STORAGE_KEY = 'tastybites_active_table_session';

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);
  const [selectedTable, setSelectedTableState] = useState(() => {
    try {
      const raw = localStorage.getItem(TABLE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeTableSession, setActiveTableSessionState] = useState(() => {
    try {
      const raw = localStorage.getItem(TABLE_SESSION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (selectedTable) localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(selectedTable));
    else localStorage.removeItem(TABLE_STORAGE_KEY);
  }, [selectedTable]);

  useEffect(() => {
    if (activeTableSession) localStorage.setItem(TABLE_SESSION_STORAGE_KEY, JSON.stringify(activeTableSession));
    else localStorage.removeItem(TABLE_SESSION_STORAGE_KEY);
  }, [activeTableSession]);

  const setSelectedTable = useCallback((table) => setSelectedTableState(table), []);
  const setActiveTableSession = useCallback((session) => setActiveTableSessionState(session), []);

  const addItem = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.selling_price),
          imagePath: product.image_path,
          quantity,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  );

  const value = { items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal, selectedTable, setSelectedTable, activeTableSession, setActiveTableSession };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
