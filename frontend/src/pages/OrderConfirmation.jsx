import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrder, cancelOrder, getPublicTenant } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useCart } from '../context/CartContext';
import { formatCurrency, formatDate, playNotificationSound, unlockAudio, formatMinutes } from '../utils/helpers';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Received', icon: '📋', activeBg: 'bg-orange-500', activeRing: 'ring-orange-100', inactiveBg: 'bg-orange-50' },
  { key: 'confirmed', label: 'Payment Confirmed', icon: '✅', activeBg: 'bg-emerald-500', activeRing: 'ring-emerald-100', inactiveBg: 'bg-emerald-50' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳', activeBg: 'bg-primary-500', activeRing: 'ring-primary-100', inactiveBg: 'bg-slate-100' },
  { key: 'ready', label: 'Ready for Pickup', icon: '🔔', activeBg: 'bg-amber-500', activeRing: 'ring-amber-100', inactiveBg: 'bg-amber-50' },
];

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { joinRoom, onEvent, connected } = useSocket();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    clearCart();
    const unlock = () => unlockAudio();
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  useEffect(() => {
    if (branding?.id) {
      joinRoom('kiosk', branding.id);
    }
  }, [branding?.id, connected]);

  useEffect(() => {
    if (tenantSlug) {
      getPublicTenant(tenantSlug).then(res => {
        if (res.data.success) setBranding(res.data.data);
      });
    }
  }, [tenantSlug]);

  const brandingColor = branding?.primaryColor || '#f97316';
  const homeLink = tenantSlug ? `/?tenant=${tenantSlug}` : '/';
  const menuLink = tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu';
  const queueLink = tenantSlug ? `/queue?tenant=${tenantSlug}` : '/queue';

  useEffect(() => {
    if (order && (order.status === 'completed' || order.status === 'cancelled')) {
      const activeOrdersKey = tenantSlug ? `${tenantSlug}_active_orders` : 'active_orders';
      const lastOrderKey = tenantSlug ? `${tenantSlug}_last_order_number` : 'last_order_number';

      if (order.status === 'cancelled') {
        if (localStorage.getItem(lastOrderKey) === order.orderNumber) {
          localStorage.removeItem(lastOrderKey);
        }
        const activeOrders = JSON.parse(localStorage.getItem(activeOrdersKey) || '[]');
        const updatedOrders = activeOrders.filter(num => num !== order.orderNumber);
        localStorage.setItem(activeOrdersKey, updatedOrders.length > 0 ? JSON.stringify(updatedOrders) : '[]');
        if (updatedOrders.length === 0) localStorage.removeItem(activeOrdersKey);
      }
    }
  }, [order?.status, tenantSlug]);

  useEffect(() => {
    loadOrder();
    const interval = setInterval(loadOrder, 5000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  useEffect(() => {
    if (order?.tenantId) {
      joinRoom('kiosk', order.tenantId);
    }
  }, [order?.tenantId, connected]);

  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('order_update', (data) => {
      if (data.order?.orderNumber === orderNumber) {
        setOrder(data.order);
      }
    });
    return unsub;
  }, [onEvent, orderNumber]);

  const loadOrder = async () => {
    try { const res = await getOrder(orderNumber); setOrder(res.data.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-surface-50 flex items-center justify-center"><p className="text-surface-400">Loading...</p></div>;
  if (!order) return <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center"><h2 className="text-xl font-bold mb-4">Order not found</h2><Link to={menuLink} className="btn-primary" style={{ backgroundColor: brandingColor }}>Back to Menu</Link></div>;

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await cancelOrder(orderNumber);
      loadOrder();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to cancel order');
    }
  };

  const currentStep = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';
  const canCancel = order.status === 'pending' && order.paymentStatus === 'unpaid';

  return (
    <div className="min-h-screen bg-surface-50 pb-8" style={{ '--primary-custom': brandingColor }}>
      <div className="p-4 md:p-6 pb-0">
        <Link to={homeLink} className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-3 bg-white rounded-full text-xs md:text-sm font-bold text-surface-700 shadow-sm border border-surface-200 hover:border-primary-300 hover:shadow-md transition-all">
          <span className="text-lg md:text-xl leading-none">←</span> <span>Back Home</span>
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 md:pt-8">

        {/* Cancelled Banner */}


        {/* Queue Ticket */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 text-center mb-4 sm:mb-6 shadow-xl relative animate-fade-in-up border-t-[12px] sm:border-t-[16px]" style={{ animationDelay: '0.1s', borderTopColor: brandingColor }}>
          <p className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 sm:mb-4">Your Queue Number</p>
          <p className="font-heading text-6xl sm:text-8xl md:text-9xl font-black text-slate-900 tracking-tighter mb-2 leading-none">
            {order.orderNumber.includes('-') ? order.orderNumber.split('-')[1] : order.orderNumber}
          </p>
          <p className="text-[10px] text-slate-400 mb-6 sm:mb-8 font-mono break-all px-4">Full ID: {order.orderNumber}</p>

          {order.estimatedPrepTime && (
            <div className="mb-6 animate-bounce-in">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 px-4 py-2 rounded-2xl shadow-sm">
                <span className="text-xl">🕒</span>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-400 leading-none mb-1">Estimated Wait</p>
                  <p className="text-lg font-black text-primary-600 leading-none">{formatMinutes(order.estimatedPrepTime)}</p>
                </div>
              </div>
            </div>
          )}

          <p className="text-slate-700 font-medium mb-6 sm:mb-8 text-xs sm:text-sm md:text-base px-1 sm:px-2">
            Please wait for your number to be called or displayed on the queue screen.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-2">
            <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm ${order.orderType === 'dine_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {order.orderType === 'dine_in' ? '🏠 Dine In' : '🥡 Take Out'}
            </span>
            {order.paymentMethod === 'points' ? (
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs sm:text-sm">
                🎁 Point Redemption
              </span>
            ) : (
              <span className={`font-bold text-xs sm:text-sm flex items-center gap-2 ${order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-slate-800'}`}>
                {order.paymentStatus === 'paid' ? '✅ OFFICIAL RECEIPT' : '⏳ ORDER SLIP - PAY AT COUNTER'}
              </span>
            )}
          </div>
        </div>

        {/* Progress Tracker */}
        {!isCancelled && !isCompleted && (
          <div className="bg-white rounded-3xl p-6 md:p-8 mb-6 animate-fade-in-up shadow-sm" style={{ animationDelay: '0.2s' }}>
            <div className="space-y-6">
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx <= currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-all ${isCurrent ? `${step.activeBg} text-white ring-8 ${step.activeRing}` : isActive ? `${step.activeBg} text-white` : `${step.inactiveBg} opacity-50 grayscale`}`}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm md:text-base ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                    </div>
                    {isActive && <span className="text-emerald-500 text-xl">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Details */}
        <div className="glass-card p-4 sm:p-5 mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-heading font-bold text-surface-900 mb-3 text-sm sm:text-base">Order Details</h3>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between py-1"><span className="text-surface-500">Customer</span><span className="font-medium">{order.customerName}</span></div>
            <div className="flex justify-between py-1"><span className="text-surface-500">Payment</span><span className="font-medium uppercase">{order.paymentMethod}</span></div>
            <div className="flex justify-between py-1"><span className="text-surface-500">Placed</span><span className="font-medium">{formatDate(order.createdAt)}</span></div>
          </div>
          <div className="border-t border-surface-100 mt-3 pt-3">
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between text-xs sm:text-sm py-1 gap-2">
                <span className="text-surface-600 flex-1 min-w-0">{item.quantity}× {item.productName}{item.addons ? ` (${JSON.parse(item.addons).map(a => a.name).join(', ')})` : ''}</span>
                <span className="font-medium flex-shrink-0">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-200 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-xs sm:text-sm"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.discountAmount > 0 && <div className="flex justify-between text-xs sm:text-sm text-emerald-600"><span>Discount ({order.discountType})</span><span>-{formatCurrency(order.discountAmount)}</span></div>}
            <div className="flex justify-between text-xs sm:text-sm"><span className="text-surface-500">Tax</span><span>{formatCurrency(order.taxAmount)}</span></div>
            <div className="flex justify-between font-bold text-base sm:text-lg font-heading pt-2 border-t border-surface-200"><span>Total</span><span style={{ color: brandingColor }}>{formatCurrency(order.total)}</span></div>
          </div>
        </div>

        {/* Points Reward Card */}
        {order.paymentStatus === 'paid' && order.customerId && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 mb-6 text-white shadow-xl shadow-emerald-200 overflow-hidden relative animate-bounce-in" style={{ animationDelay: '0.4s' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Loyalty Reward</p>
                <h4 className="text-2xl font-black mb-1">+{Math.floor(order.total / 100)} Points Earned!</h4>
                <p className="text-xs font-medium text-emerald-50">Thanks for being a member, {order.customerName.split(' ')[0]}!</p>
              </div>
              <div className="text-4xl">💎</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up mb-4" style={{ animationDelay: '0.5s' }}>
          <Link to={queueLink} className="btn-secondary flex-1 justify-center text-sm sm:text-base py-3">📋 View Queue</Link>
          <Link to={menuLink} className="btn-primary flex-1 justify-center text-sm sm:text-base py-3" style={{ backgroundColor: brandingColor }}>🍽️ Order Again</Link>
        </div>

        {canCancel && (
          <button
            onClick={handleCancelOrder}
            className="w-full py-3 mb-8 text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all animate-fade-in-up border border-transparent hover:border-red-100 rounded-xl"
            style={{ animationDelay: '0.45s' }}
          >
            ✕ Cancel This Order
          </button>
        )}

        {/* Other Active Orders Switcher */}
        {(() => {
          const activeOrdersKey = tenantSlug ? `${tenantSlug}_active_orders` : 'active_orders';
          const activeOrders = JSON.parse(localStorage.getItem(activeOrdersKey) || '[]');
          const otherOrders = activeOrders.filter(num => num !== orderNumber);
          if (otherOrders.length === 0) return null;

          return (
            <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-surface-200"></div>
                <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">My Other Active Orders</span>
                <div className="h-px flex-1 bg-surface-200"></div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {otherOrders.map(num => (
                  <Link
                    key={num}
                    to={tenantSlug ? `/order/${num}?tenant=${tenantSlug}` : `/order/${num}`}
                    className="flex items-center justify-between p-4 bg-white rounded-2xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-sm group-hover:bg-primary-100 transition-colors">📄</div>
                      <span className="font-bold text-surface-700 group-hover:text-primary-700">{num}</span>
                    </div>
                    <span className="text-primary-500 font-bold text-sm">View Ticket →</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
