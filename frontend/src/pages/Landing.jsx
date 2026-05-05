import { Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getOrder, getPublicTenant } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Landing() {
  const [lastOrder, setLastOrder] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, logoutUser } = useAuth();
  const [searchParams] = useSearchParams();
  const isCustomer = user && user.role === 'customer';
  const { joinRoom, connected } = useSocket();

  useEffect(() => {
    if (tenant?.id) {
      joinRoom('kiosk', tenant.id);
    }
  }, [tenant?.id, connected]);

  useEffect(() => {
    const init = async () => {
      // Check for tenant from URL
      const tenantSlug = searchParams.get('tenant');
      if (tenantSlug && tenantSlug !== 'project-million') {
        try {
          const res = await getPublicTenant(tenantSlug);
          if (res.data.success) {
            setTenant(res.data.data);
          }
        } catch (e) {
          console.error('Failed to load tenant info:', e);
        }
      }

      // Check for last order
      const lastOrderKey = tenantSlug ? `${tenantSlug}_last_order_number` : 'last_order_number';
      const saved = localStorage.getItem(lastOrderKey);
      if (saved) {
        try {
          const res = await getOrder(saved);
          const order = res.data.data;
          if (order && (order.status === 'completed' || order.status === 'cancelled')) {
            localStorage.removeItem('last_order_number');
            setLastOrder(null);
          } else {
            setLastOrder(saved);
          }
        } catch (error) {
          localStorage.removeItem('last_order_number');
          setLastOrder(null);
        }
      }
      setLoading(false);
    };
    init();
  }, [searchParams]);

  const tenantName = tenant ? tenant.name : 'PROJECT MILLION';
  const menuLink = tenant ? `/menu?tenant=${tenant.slug}` : '/menu';
  const queueLink = tenant ? `/queue?tenant=${tenant.slug}` : '/queue';
  const portalLink = tenant ? `/member-portal?tenant=${tenant.slug}` : '/member-portal';
  const primaryColor = tenant?.primaryColor || '#4f46e5';
  const bannerImage = tenant?.bannerImage || 'https://images.unsplash.com/photo-1586816001966-79b736744398?q=80&w=2000&auto=format&fit=crop';

  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
  </div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 flex items-center justify-center relative overflow-hidden" style={{ '--primary-custom': primaryColor }}>
      {/* Video Background & Animated Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-surface-900">

        <style>
          {`
              @keyframes kenburns {
                0% { transform: scale(1) translate(0, 0); }
                50% { transform: scale(1.05) translate(-1%, -1%); }
                100% { transform: scale(1) translate(0, 0); }
              }
              .animate-kenburns {
                animation: kenburns 30s ease-in-out infinite;
              }
              .btn-custom {
                background-color: var(--primary-custom);
                color: white;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
              }
              .btn-custom:hover {
                filter: brightness(1.1);
              }
              .text-custom {
                color: var(--primary-custom);
              }
            `}
        </style>
        <img
          src={bannerImage}
          alt="Delicious Background"
          className="absolute inset-0 w-full h-full object-cover opacity-60 z-0 animate-kenburns"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-950/80 via-surface-950/40 to-surface-950/90 z-10" />

        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px] animate-pulse-slow z-20 opacity-30" style={{ backgroundColor: primaryColor }} />
      </div>

      <div className="relative z-10 text-center px-6 animate-fade-in-up">
        {isCustomer ? (
          <div className="inline-flex flex-col items-center gap-2 mb-8 animate-fade-in">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-full text-emerald-400 font-bold text-sm backdrop-blur-sm">
              👋 Welcome back, {user.name}!
            </div>
            <div className="text-xs text-emerald-500/60 font-black uppercase tracking-widest">
              Available Balance: {Math.floor(user.points)} Points
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm" style={{ color: primaryColor }}>
            ✨ {tenant ? `Exclusive to ${tenant.name}` : 'Self-Service Kiosk v2.0'}
          </div>
        )}

        <h1 className="font-heading text-6xl md:text-8xl font-black text-white leading-tight mb-4 uppercase">
          {tenant ? (
            <span style={{ color: primaryColor }}>
              {tenant.name}
            </span>
          ) : (
            <>
              PROJECT
              <br />
              <span className="bg-gradient-to-r from-primary-400 to-amber-400 bg-clip-text text-transparent">
                MILLION
              </span>
            </>
          )}
        </h1>

        <p className="text-surface-400 text-lg md:text-xl max-w-md mx-auto mb-12">
          {tenant
            ? `Experience the best of ${tenant.name}. Fresh food, fast service.`
            : (isCustomer ? "You're earning points on every order! Ready to eat?" : "Fresh food, fast service. Order right from this screen.")
          }
        </p>

        <div className="flex flex-col gap-4 items-center max-w-xs mx-auto">
          <Link to={menuLink} className="btn-custom w-full text-lg py-4 rounded-2xl tracking-wider uppercase flex items-center justify-center gap-2" id="start-order-btn">
            {isCustomer ? '🚀 Order Now' : 'Start Your Order'}
          </Link>

          {!user && (
            <Link to={portalLink} className="btn-secondary w-full bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all">
              Sign in / Sign up
            </Link>
          )}

          {lastOrder && (
            <Link to={`/order/${lastOrder}`} className="btn-secondary w-full bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 animate-fade-in-up">
              View Receipt
            </Link>
          )}

          <Link to={queueLink} className="btn-secondary w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white" id="view-queue-btn">
            View Order Queue
          </Link>

          {!user ? (
            <Link to={tenant ? `/login?tenant=${tenant.slug}` : '/login'} className="text-surface-500 text-sm hover:text-white transition-colors mt-4">
              Staff Login →
            </Link>
          ) : (
            <button
              onClick={logoutUser}
              className="text-red-400 text-sm hover:text-red-300 transition-colors mt-4 font-bold uppercase tracking-widest"
            >
              Sign Out [{user.role}]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
