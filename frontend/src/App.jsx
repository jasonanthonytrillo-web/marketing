import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { unlockAudio } from './utils/helpers';

// Components
import GlobalNotification from './components/GlobalNotification';
import SocketListener from './components/SocketListener';
import GlobalThankYou from './components/GlobalThankYou';

// Pages
import Landing from './pages/Landing';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import QueueDisplay from './pages/QueueDisplay';
import Login from './pages/Login';
import CashierDashboard from './pages/CashierDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MemberPortal from './pages/MemberPortal';
import CustomerAccount from './pages/CustomerAccount';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Marketing from './pages/Marketing';
import { PrivacyPolicy, TermsOfService, DataDeletion } from './pages/Legal';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface-50"><div className="text-surface-400">Loading...</div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
}

function App() {
  // Global audio unlocker - required for browser autoplay policies
  useEffect(() => {
    const handleInteraction = () => {
      unlockAudio();
      console.log('🔊 Audio & Speech synthesis successfully unlocked by user gesture.');
      
      // Cleanup: remove listeners after unlock
      const events = ['mousedown', 'touchstart', 'keydown'];
      events.forEach(event => window.removeEventListener(event, handleInteraction));
    };

    const events = ['mousedown', 'touchstart', 'keydown'];
    events.forEach(event => window.addEventListener(event, handleInteraction, { once: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleInteraction));
    };
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <Router>
            <GlobalNotification />
            <SocketListener />
            <GlobalThankYou />
            <Routes>
              {/* Marketing & Advertisement */}
              <Route path="/advertise" element={<Marketing />} />
              <Route path="/welcome" element={<Marketing />} />

              {/* Kiosk Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
              <Route path="/member-portal" element={<MemberPortal />} />
              <Route path="/account" element={<CustomerAccount />} />

              {/* Public Queue Display */}
              <Route path="/queue" element={<QueueDisplay />} />

              {/* Legal Pages */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/data-deletion" element={<DataDeletion />} />

              {/* Staff Login */}
              <Route path="/login" element={<Login />} />

              {/* Cashier */}
              <Route path="/cashier" element={<ProtectedRoute roles={['cashier', 'admin']}><CashierDashboard /></ProtectedRoute>} />

              {/* Kitchen */}
              <Route path="/kitchen" element={<ProtectedRoute roles={['kitchen', 'admin']}><KitchenDashboard /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

              {/* Superadmin */}
              <Route path="/superadmin" element={<ProtectedRoute roles={['superadmin']}><SuperAdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
