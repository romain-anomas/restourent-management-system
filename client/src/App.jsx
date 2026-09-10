import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import ComingSoon from './components/ComingSoon';

// Public
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/public/Home';
import Menu from './pages/public/Menu';
import ProductDetails from './pages/public/ProductDetails';
import Cart from './pages/public/Cart';
import Checkout from './pages/public/Checkout';
import OrderConfirmation from './pages/public/OrderConfirmation';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';

// Admin
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminWorkers from './pages/admin/AdminWorkers';
import AdminInventory from './pages/admin/AdminInventory';
import AdminWorkerStock from './pages/admin/AdminWorkerStock';
import AdminSalaryDeductions from './pages/admin/AdminSalaryDeductions';
import AdminInvoices from './pages/admin/AdminInvoices';
import AdminReports from './pages/admin/AdminReports';

// Worker
import WorkerLayout from './layouts/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerOrders from './pages/worker/WorkerOrders';
import WorkerInventory from './pages/worker/WorkerInventory';
import WorkerStockTaking from './pages/worker/WorkerStockTaking';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          {/* ---------- Public site ---------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
            <Route path="/contact" element={<Contact />} />
          </Route>

          {/* ---------- Auth ---------- */}
          <Route path="/login" element={<Login />} />

          {/* ---------- Admin (protected) ---------- */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="workers" element={<AdminWorkers />} />
            <Route path="worker-stock" element={<AdminWorkerStock />} />
            <Route path="salary-deductions" element={<AdminSalaryDeductions />} />
            <Route path="expenses" element={<ComingSoon title="Expenses" />} />
            <Route path="invoices" element={<AdminInvoices />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="notifications" element={<ComingSoon title="Notifications" />} />
            <Route path="settings" element={<ComingSoon title="Settings" />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* ---------- Worker (protected) ---------- */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['worker']}>
                <WorkerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<WorkerDashboard />} />
            <Route path="orders" element={<WorkerOrders />} />
            <Route path="inventory" element={<WorkerInventory />} />
            <Route path="stock-taking" element={<WorkerStockTaking />} />
            <Route path="activity" element={<ComingSoon title="My Activity" />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<ComingSoon title="Settings" />} />
          </Route>

          {/* ---------- Fallbacks ---------- */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
