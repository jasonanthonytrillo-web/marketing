import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrder, cancelOrder, getPublicTenant, submitFeedback, confirmDeliveryReceived } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, unlockAudio, formatMinutes } from '../utils/helpers';

import { applyTheme, clearTheme } from '../utils/theme';
import { ClipboardList, CheckCircle, ChefHat, Bell, XCircle, AlertTriangle, Clock, Home, ShoppingBag, Gift, Utensils, Star, Sparkles, Gem, ListOrdered, UtensilsCrossed, Download, ArrowLeft, AlertOctagon, Truck, MapPin, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GET_STATUS_STEPS = (orderType) => {
  const steps = [
    { key: 'pending', label: 'Order Received', icon: <ClipboardList className="w-6 h-6" />, activeBg: 'bg-primary-500', activeRing: 'ring-primary-100', inactiveBg: 'bg-primary-50' },
    { key: 'confirmed', label: 'Payment Confirmed', icon: <CheckCircle className="w-6 h-6" />, activeBg: 'bg-emerald-500', activeRing: 'ring-emerald-100', inactiveBg: 'bg-emerald-50' },
    { key: 'preparing', label: 'Preparing', icon: <ChefHat className="w-6 h-6" />, activeBg: 'bg-primary-500', activeRing: 'ring-primary-100', inactiveBg: 'bg-slate-100' },
  ];

  if (orderType === 'delivery') {
    steps.push({ key: 'ready', label: 'Packing Order', icon: <ShoppingBag className="w-6 h-6" />, activeBg: 'bg-amber-500', activeRing: 'ring-amber-100', inactiveBg: 'bg-amber-50' });
    steps.push({ key: 'on_the_way', label: 'On the Way', icon: <Truck className="w-6 h-6" />, activeBg: 'bg-blue-500', activeRing: 'ring-blue-100', inactiveBg: 'bg-blue-50' });
  } else {
    steps.push({ key: 'ready', label: 'Ready for Pickup', icon: <Bell className="w-6 h-6" />, activeBg: 'bg-amber-500', activeRing: 'ring-amber-100', inactiveBg: 'bg-amber-50' });
  }

  return steps;
};

export default function OrderConfirmation() {
  const { user } = useAuth();
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { joinRoom, onEvent, connected } = useSocket();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || 'project-million';
  const [branding, setBranding] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const lastAnnouncedStatusRef = useRef(null);

  // Feedback State
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showArrivalOverlay, setShowArrivalOverlay] = useState(false);

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
        if (res.data.success) {
          setBranding(res.data.data);
          if (res.data.data.primaryColor) {
            applyTheme(res.data.data.primaryColor);
          }
        }
      });
    }
    return () => clearTheme();
  }, [tenantSlug]);

  const brandingColor = branding?.primaryColor || '#0a3d01';
  const homeLink = '/';
  const menuLink = '/menu';
  const queueLink = '/queue';

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
    if (order?.tenantId && orderNumber) {
      joinRoom('kiosk', order.tenantId);
      joinRoom(`order-${orderNumber}`, order.tenantId);
    }
  }, [order?.tenantId, orderNumber, connected]);

  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('order_update', (data) => {
      if (data.order?.orderNumber === orderNumber) {
        if (data.order.status === 'ready' && lastAnnouncedStatusRef.current !== 'ready') {
          lastAnnouncedStatusRef.current = 'ready';
        }
        setOrder(data.order);
        if (data.order.status !== 'pending') {
          setPaymentRequest(null);
        }
      }
    });

    const unsub2 = onEvent('payment_request', (data) => {
      if (data.orderNumber === orderNumber) {
        setPaymentRequest(data);
      }
    });

    const unsub3 = onEvent('rider_arrived', (data) => {
      if (data.orderNumber === orderNumber) {
        setShowArrivalOverlay(true);
        // Play notification sound
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play();
        } catch (err) {
          console.warn('Audio play failed:', err);
        }
      }
    });

    return () => {
      unsub();
      unsub2();
      unsub3();
    };
  }, [onEvent, orderNumber]);

  const [paymentRequest, setPaymentRequest] = useState(null);

  const loadOrder = async () => {
    try {
      const res = await getOrder(orderNumber);
      setOrder(res.data.data);
      if (res.data.data.feedbackRating) setFeedbackSubmitted(true);
    }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return;
    setSubmittingFeedback(true);
    try {
      await submitFeedback({ orderNumber, rating, comment });
      setFeedbackSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) return null;
  if (!order) return <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center"><h2 className="text-xl font-bold mb-4">Order not found</h2><Link to={menuLink} className="btn-primary" style={{ backgroundColor: brandingColor }}>Back to Menu</Link></div>;

  const statusSteps = GET_STATUS_STEPS(order.orderType);
  const currentStep = statusSteps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';
  const isReady = order.status === 'ready';
  const isOnTheWay = order.status === 'on_the_way';

  // Store coordinates (assuming a fixed shop location for now, or we can add it to branding)
  const storeLocation = [branding?.storeLat || 14.5995, branding?.storeLng || 120.9842];
  const deliveryLocation = order.deliveryLat && order.deliveryLng ? [order.deliveryLat, order.deliveryLng] : null;

  return (
    <div className="min-h-screen bg-surface-50 pb-8" style={{ '--primary-custom': brandingColor }}>
      <div className="p-4 md:p-6 pb-0">
        <Link to={homeLink} className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-3 bg-white rounded-full text-xs md:text-sm font-bold text-surface-700 shadow-sm border border-surface-200 hover:border-primary-300 hover:shadow-md transition-all">
          <ArrowLeft className="w-5 h-5 text-surface-500" /> <span>Back Home</span>
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 md:pt-8">

        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 text-center mb-4 sm:mb-6 shadow-xl relative overflow-hidden animate-fade-in-up border-t-[12px] sm:border-t-[16px]" style={{ animationDelay: '0.1s', borderTopColor: isCancelled ? '#ef4444' : brandingColor }}>
          {isCancelled && (
            <div className="absolute top-4 right-4 rotate-12 border-4 border-red-500 text-red-500 font-black px-4 py-1.5 rounded-xl text-xs sm:text-sm uppercase tracking-widest animate-bounce-in shadow-lg bg-white/95 z-20 flex items-center gap-1.5">
              Cancelled <XCircle className="w-4 h-4" />
            </div>
          )}

          <p className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 sm:mb-4">Your Queue Number</p>
          <p className={`font-heading text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter mb-2 leading-none ${isCancelled ? 'text-slate-300 line-through opacity-70' : 'text-slate-900'}`}>
            {order.orderNumber.includes('-') ? order.orderNumber.split('-')[1] : order.orderNumber}
          </p>

          {isCancelled && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-left mb-6 flex gap-3 items-start animate-fade-in">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800 text-sm">Order Cancelled</h4>
                <p className="text-xs text-red-600 font-medium leading-relaxed">
                  This transaction was cancelled by the store. {order.cancellationReason && `Reason: ${order.cancellationReason}. `}
                  If any payments were made, they have been voided. Please proceed to the counter for questions or refunds.
                </p>
              </div>
            </div>
          )}

          {order.estimatedPrepTime && !isCompleted && !isCancelled && (order.orderType === 'delivery' ? !isOnTheWay : !isReady) && (
            <div className="mb-6 animate-bounce-in">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-3 rounded-2xl shadow-lg" style={{ backgroundColor: `${brandingColor}15` }}>
                <Clock className="w-6 h-6" style={{ color: brandingColor }} />
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-0.5" style={{ color: brandingColor }}>
                    {order.orderType === 'delivery' && isReady ? 'Estimated Arrival' : 'Estimated Cooking Time'}
                  </p>
                  <p className="text-xl font-black leading-none" style={{ color: brandingColor }}>{formatMinutes(order.estimatedPrepTime)}</p>
                </div>
              </div>
            </div>
          )}

          <p className={`font-medium mb-6 sm:mb-8 text-xs sm:text-sm md:text-base px-1 sm:px-2 ${isCancelled ? 'text-red-500 font-black' : 'text-slate-700'}`}>
            {isCancelled
              ? "THIS ORDER HAS BEEN VOIDED / CANCELLED"
              : isReady
                ? (order.orderType === 'delivery' ? "YOUR ORDER IS READY! Our team is packing it for delivery." : "YOUR ORDER IS READY! Please proceed to the counter.")
                : "Please wait for your number to be called or displayed on the queue screen."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-2">
            <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 ${order.orderType === 'dine_in' ? 'bg-emerald-100 text-emerald-700' :
              order.orderType === 'delivery' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
              {order.orderType === 'dine_in' ? <><Home className="w-4 h-4" /> Dine In</> :
                order.orderType === 'delivery' ? <><Truck className="w-4 h-4" /> Delivery</> : <><ShoppingBag className="w-4 h-4" /> Take Out</>}
            </span>
            {isCancelled ? (
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-red-100 text-red-700 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 border border-red-200">
                <XCircle className="w-4 h-4" /> VOIDED RECEIPT
              </span>
            ) : order.paymentMethod === 'points' ? (
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Gift className="w-4 h-4" /> Point Redemption
              </span>
            ) : (
              <span className={`font-bold text-xs sm:text-sm flex items-center gap-1.5 ${order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-slate-800'}`}>
                {order.paymentStatus === 'paid' ? (
                  <><CheckCircle className="w-4 h-4" /> PAID</>
                ) : order.orderType === 'delivery' ? (
                  <><Clock className="w-4 h-4" /> CONFIRMING PAYMENT</>
                ) : (
                  <><Clock className="w-4 h-4" /> PAY AT THE COUNTER</>
                )}
              </span>
            )}
          </div>
        </div>

        {(isReady || isCompleted) && !isCancelled && (
          <div className="bg-white rounded-[2rem] p-8 mb-6 shadow-xl border border-surface-100 animate-fade-in-up relative overflow-hidden group">
            {!feedbackSubmitted ? (
              <>
                <div className="relative z-10 text-center">
                  <h4 className="text-2xl font-black text-slate-900 mb-2 flex items-center justify-center gap-2">How was your meal? <Utensils className="w-6 h-6 text-orange-500" /></h4>
                  <p className="text-slate-500 text-xs mb-6">Your feedback helps us make your next visit even better!</p>

                  <div className="flex justify-center gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`transition-all hover:scale-125 active:scale-95 ${rating >= star ? 'drop-shadow-lg scale-110 text-yellow-400' : 'text-slate-200'}`}
                        type="button"
                      >
                        <Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400' : ''}`} />
                      </button>
                    ))}
                  </div>

                  {rating > 0 && (
                    <form onSubmit={handleFeedbackSubmit} className="animate-fade-in">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all mb-4 h-24 resize-none"
                        placeholder="Any comments or suggestions? (Optional)"
                      />
                      <button
                        type="submit"
                        disabled={submittingFeedback}
                        className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        style={{ backgroundColor: brandingColor }}
                      >
                        {submittingFeedback ? 'Sending...' : 'Send Feedback →'}
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-4 animate-bounce-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8" /></div>
                <h4 className="text-xl font-black text-slate-900 mb-1">Thank you!</h4>
                <p className="text-slate-500 text-xs">We've received your feedback. Enjoy your meal!</p>
              </div>
            )}
          </div>
        )}

        {!order.customerId && !isCancelled && !isCompleted && !isReady && (
          <div className="bg-slate-900 rounded-[2rem] p-6 mb-6 text-white shadow-2xl relative overflow-hidden group border border-white/5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-500/30 transition-all duration-500"></div>
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-md border border-white/20"><Gem className="w-6 h-6 text-primary-200" /></div>
              <div className="flex-1">
                <h4 className="text-lg font-black text-white mb-1 tracking-tight">Save this meal to your story!</h4>
                <p className="text-slate-300 text-[11px] leading-relaxed mb-4">Sign up now to start your Personal Timeline and earn <span className="text-amber-400 font-black">{Math.floor(order.total / (branding?.points_rate || 100))} points</span> on this order.</p>
                <Link to={tenantSlug ? `/member-portal?tenant=${tenantSlug}&action=register` : '/member-portal?action=register'} className="inline-block px-8 py-3 bg-white text-slate-900 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-50 transition-all shadow-xl active:scale-95">
                  Create My VIP Account
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Track Map */}
        {order.orderType === 'delivery' && isOnTheWay && deliveryLocation && (
          <div className="bg-white rounded-3xl p-4 mb-6 shadow-xl animate-fade-in-up border border-blue-100 overflow-hidden" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 animate-pulse">
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Your Order is on the way!</h4>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Estimated Arrival: 15-20 mins</p>
              </div>
              <Navigation className="w-5 h-5 text-slate-300" />
            </div>

            <div className="h-[250px] rounded-2xl overflow-hidden border border-slate-100 relative z-0">
              <MapContainer
                center={[(storeLocation[0] + deliveryLocation[0]) / 2, (storeLocation[1] + deliveryLocation[1]) / 2]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={storeLocation}>
                  <Popup>Hometown Brew (Store)</Popup>
                </Marker>
                <Marker position={deliveryLocation}>
                  <Popup>Your Location</Popup>
                </Marker>
                <Polyline positions={[storeLocation, deliveryLocation]} color="#3b82f6" dashArray="10, 10" weight={3} opacity={0.6} />
              </MapContainer>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-center gap-3">
              <MapPin className="w-5 h-5 text-red-500" />
              <p className="text-xs font-medium text-slate-600 line-clamp-1">{order.deliveryAddress}</p>
            </div>

            <button
              onClick={() => setShowReceiveModal(true)}
              className="mt-4 w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
            >
              <CheckCircle className="w-5 h-5" />
              <span>ORDER RECEIVED</span>
            </button>
          </div>
        )}

        {!isCancelled && !isCompleted && (
          <div className="bg-white rounded-3xl p-6 md:p-8 mb-6 animate-fade-in-up shadow-sm" style={{ animationDelay: '0.2s' }}>
            <div className="space-y-6">
              {statusSteps.map((step, idx) => {
                const isActive = idx <= currentStep || (order.status === 'completed' && idx < statusSteps.length);
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
                <span className="text-surface-600 flex-1 min-w-0">
                  {item.quantity}× {item.productName}
                  {item.addons ? ` (${JSON.parse(item.addons).map(a => a.name).join(', ')})` : ''}
                </span>
                <span className="font-medium flex-shrink-0">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-200 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-xs sm:text-sm"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-surface-500">
                <span>Delivery Fee</span>
                <span>{formatCurrency(order.deliveryFee)}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-emerald-600 font-semibold">
                <span>Discount ({order.discountType === 'senior' ? 'Senior Citizen (20%)' : order.discountType === 'pwd' ? 'PWD (20%)' : order.discountType === 'promo' ? 'Promo' : order.discountType})</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                <span>VAT (12%)</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base sm:text-lg font-heading pt-2 border-t border-surface-200">
              <span>{isCancelled ? 'Total (Voided)' : 'Total'}</span>
              <span style={{ color: isCancelled ? '#ef4444' : brandingColor }} className={isCancelled ? 'line-through opacity-60' : ''}>
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>
        </div>

        {order.paymentStatus === 'paid' && order.customerId && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 mb-6 text-white shadow-xl shadow-emerald-200 overflow-hidden relative animate-bounce-in" style={{ animationDelay: '0.4s' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Loyalty Reward</p>
                <h4 className="text-2xl font-black mb-1">+{Math.floor(order.total / (branding?.points_rate || 100))} Points Earned!</h4>
                <p className="text-xs font-medium text-emerald-50">Thanks for being a member, {order.customerName.split(' ')[0]}!</p>
              </div>
              <div className="text-primary-100 opacity-90"><Gem className="w-10 h-10" /></div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up mb-4 no-print" style={{ animationDelay: '0.5s' }}>
          {order.status === 'pending' && order.paymentStatus !== 'paid' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-6 py-3 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 hover:text-red-700 transition-colors border border-red-100"
            >
              Cancel Order
            </button>
          )}
          <Link to={queueLink} className="btn-secondary flex-1 justify-center text-sm sm:text-base py-3 flex items-center gap-2"><ListOrdered className="w-5 h-5" /> View Queue</Link>
          <Link to={menuLink} className="btn-primary flex-1 justify-center text-sm sm:text-base py-3 flex items-center gap-2" style={{ backgroundColor: brandingColor }}><UtensilsCrossed className="w-5 h-5" /> Order Again</Link>
        </div>
      </div>

      {paymentRequest && (() => {
        const isMaya = paymentRequest.method === 'maya';
        const methodLabel = isMaya ? 'Maya' : 'GCash';
        const brandColorGrad = isMaya
          ? 'from-emerald-600 to-teal-800'
          : 'from-blue-600 to-blue-800';
        const logoUrl = isMaya
          ? '/logos/maya-logo.jpg'
          : '/logos/GCash-Logo.png';
        const activeQr = isMaya ? paymentRequest.mayaQr : paymentRequest.gcashQr;

        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
            <div className="bg-white w-full max-w-sm sm:max-w-md rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in border border-white/20 relative my-auto max-h-[95vh] flex flex-col">

              <div className={`bg-gradient-to-br ${brandColorGrad} p-6 sm:p-10 text-white text-center relative overflow-hidden flex-shrink-0`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                <div className="relative z-10 flex flex-col items-center">
                  <div className="bg-white px-5 py-2.5 rounded-2xl shadow-xl mb-4 sm:mb-5 flex items-center justify-center min-h-[44px]">
                    <img src={logoUrl} alt={methodLabel} className="h-6 sm:h-8 object-contain" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black mb-1 sm:mb-2 tracking-tight">Scan to Pay</h3>
                  <p className="text-white/90 text-xs sm:text-sm font-medium opacity-90">Open your {methodLabel} app and scan the code below</p>
                </div>

                <button
                  onClick={() => setPaymentRequest(null)}
                  className="absolute top-4 sm:top-6 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center transition-colors text-white z-20 backdrop-blur-sm text-sm sm:text-base"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 sm:p-8 space-y-5 sm:space-y-8 text-center bg-slate-50 relative overflow-y-auto flex-1">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 w-16 h-1.5 bg-slate-200/80 rounded-full"></div>

                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/60 flex-shrink-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Total Amount Due</p>
                  <p className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter">
                    {formatCurrency(paymentRequest.amount)}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-xl border border-slate-100 flex items-center justify-center max-w-[280px] sm:max-w-full">
                    {activeQr ? (
                      <img
                        src={activeQr.startsWith('http') ? activeQr : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${activeQr}`}
                        alt={`${methodLabel} QR`}
                        className="w-full h-auto max-h-[220px] sm:max-h-[300px] object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs sm:text-sm p-6 sm:p-8 text-center border-2 border-dashed border-slate-200">
                        <p>No QR code uploaded.<br />Please pay at the counter.</p>
                      </div>
                    )}
                  </div>

                  {activeQr && (
                    <button
                      onClick={async () => {
                        const url = activeQr.startsWith('http') ? activeQr : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${activeQr}`;
                        try {
                          const response = await fetch(url);
                          const blob = await response.blob();
                          const blobUrl = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = `${methodLabel}_QR_Order_${orderNumber}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(blobUrl);
                        } catch (error) {
                          console.error('Download failed:', error);
                          // Fallback: open in new tab if blob fails
                          window.open(url, '_blank');
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm ${isMaya ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white'}`}
                    >
                      <Download className="w-4 h-4" /> Save QR Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modern Receive Order Confirmation Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-scale-in border border-white/20 p-6 md:p-8 text-center relative pointer-events-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in shadow-inner">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 tracking-tight">Order Received?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Confirm that you have received your order. This will mark the order as completed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95"
              >
                Not Yet
              </button>
              <button
                onClick={async () => {
                  setShowReceiveModal(false);
                  try {
                    await confirmDeliveryReceived(orderNumber);
                    loadOrder();
                  } catch (e) {
                    alert('Failed to confirm receipt.');
                  }
                }}
                className="flex-1 py-3.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
              >
                Yes, Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-scale-in border border-white/20 p-6 md:p-8 text-center relative pointer-events-auto">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in shadow-inner">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 tracking-tight">Cancel Order?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95"
              >
                No, Keep it
              </button>
              <button
                onClick={async () => {
                  setShowCancelModal(false);
                  try {
                    await cancelOrder(orderNumber);
                    loadOrder();
                  } catch (e) {
                    alert('Failed to cancel order.');
                  }
                }}
                className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all active:scale-95"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rider Arrival Overlay */}
      {showArrivalOverlay && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in border border-white/20 p-10 sm:p-12 text-center relative">
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Rider Arrived!</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 px-2">
                Your rider is now at your location. Please prepare to receive your order <span className="font-black text-slate-900">#{orderNumber.includes('-') ? orderNumber.split('-')[1] : orderNumber}</span>.
              </p>

              <button
                onClick={() => setShowArrivalOverlay(false)}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Okay, I'm going!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
