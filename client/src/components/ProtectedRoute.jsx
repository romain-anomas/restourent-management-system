import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

/**
 * Wraps a route (or subtree) that requires authentication.
 * Pass `allowedRoles` to additionally restrict by role (e.g. ['admin']).
 * NOTE: this is a UX convenience only - the real access control lives
 * in the backend's authenticate/authorize middleware, since a client-side
 * check can always be bypassed.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in, but wrong portal - send them to their own dashboard
    const home = user.role === 'admin' ? '/admin' : '/worker';
    return <Navigate to={home} replace />;
  }

  return children;
}
