import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, getPublicTenant } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../utils/theme';
import { Utensils, ShoppingBag, Banknote, Smartphone, CreditCard, ShoppingCart, Gem, MapPin, Hash, Truck, Download, CheckCircle } from 'lucide-react';
import LocationPicker from '../components/LocationPicker';

const TRANSLATIONS = {
  en: {
    checkout: "Checkout",
    back: "Back",
    dineIn: "Dine In",
    takeOut: "Take Out",
    cash: "Cash",
    gcash: "GCash",
    maya: "Maya",
    card: "Card",
    nameLabel: "Your Name (Optional)",
    namePlaceholder: "Enter your name",
    orderType: "Order Type",
    paymentMethod: "Payment Method",
    pointsRedemption: "Points Redemption",
    noPaymentNeeded: "No payment needed — using your loyalty points",
    orderNotes: "Order Notes",
    notesPlaceholder: "Any special requests...",
    orderSummary: "Order Summary",
    subtotal: "Subtotal",
    tax: "Tax (12%)",
    total: "Total",
    placingOrder: "Placing Order...",
    insufficientPoints: "Insufficient Points ({pts} Needed)",
    claimPoints: "Claim for {pts} Points",
    orderWithPoints: "Order — {price} + {pts} pts",
    placeOrderTotal: "Place Order — {price}",
    delivery: "Delivery",
    deliveryFee: "Delivery Fee",
    paymentRef: "Payment Reference Number",
    refPlaceholder: "Enter last 4-8 digits of GCash/Maya ID",
    pickLocation: "Pick Delivery Location",
    deliveryContact: "Delivery Contact Info"
  },
  tl: {
    checkout: "Magbayad na",
    back: "Bumalik",
    dineIn: "Kakain Dito",
    takeOut: "Iuuwi",
    cash: "Cash",
    gcash: "GCash",
    maya: "Maya",
    card: "Card",
    nameLabel: "Iyong Pangalan (Opsyonal)",
    namePlaceholder: "Ilagay ang iyong pangalan",
    orderType: "Uri ng Order",
    paymentMethod: "Paraan ng Pagbabayad",
    pointsRedemption: "Redeem ng Puntos",
    noPaymentNeeded: "Walang kailangang bayad — gagamitin ang iyong mga puntos",
    orderNotes: "Habilin sa Order",
    notesPlaceholder: "Iba pang habilin o request...",
    orderSummary: "Buod ng Order",
    subtotal: "Subtotal",
    tax: "Buwis (12%)",
    total: "Kabuuan",
    placingOrder: "Ipinapadala...",
    insufficientPoints: "Kulang ang Puntos ({pts} Kailangan)",
    claimPoints: "Kunin gamit ang {pts} Puntos",
    orderWithPoints: "Order — {price} + {pts} pts",
    placeOrderTotal: "Ipadala ang Order — {price}",
    delivery: "Delivery",
    deliveryFee: "Bayad sa Delivery",
    paymentRef: "Reference Number ng Bayad",
    refPlaceholder: "Ilagay ang huling 4-8 digits ng GCash/Maya ID",
    pickLocation: "Pumili ng Lokasyon",
    deliveryContact: "Impormasyon sa Delivery"
  }
};

export default function Checkout() {
  const { items, getSubtotal, getTotalPointsCost, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || 'project-million';
  const [branding, setBranding] = useState(null);

  const lang = localStorage.getItem('pos_lang') || 'en';
  const t = (key) => TRANSLATIONS[lang][key] || key;

  const ORDER_TYPES = [
    { id: 'dine_in', label: t('dineIn'), icon: <Utensils className="w-6 h-6" /> },
    { id: 'take_out', label: t('takeOut'), icon: <ShoppingBag className="w-6 h-6" /> },
    { id: 'delivery', label: t('delivery'), icon: <MapPin className="w-6 h-6" /> }
  ];

  const PAYMENT_METHODS = [
    { id: 'cash', label: t('cash'), icon: <Banknote className="w-6 h-6" /> },
    { id: 'gcash', label: t('gcash'), icon: <Smartphone className="w-6 h-6" /> },
    { id: 'maya', label: t('maya'), icon: <CreditCard className="w-6 h-6" /> }
  ];

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [orderType, setOrderType] = useState('dine_in');
  const [notes, setNotes] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState({ address: '', lat: null, lng: null, fee: 0 });
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    const slug = tenantSlug || user?.tenantSlug;
    if (slug) {
      getPublicTenant(slug).then(res => {
        if (res.data.success) {
          setBranding(res.data.data);
          applyTheme(res.data.data.primaryColor);
        }
      });
    }
  }, [tenantSlug, user?.tenantSlug]);


  const brandingColor = branding?.primaryColor || '#0a3d01';
  const cartLink = '/cart';
  const menuLink = '/menu';
  const isFullRedemption = items.length > 0 && items.every(item => item.isRedemption);
  const totalPointsCost = getTotalPointsCost();
  const hasInsufficientPoints = totalPointsCost > (user?.points || 0);

  const [paymentMethod, setPaymentMethod] = useState(isFullRedemption ? 'points' : 'cash');

  useEffect(() => {
    if (orderType === 'delivery' && paymentMethod === 'cash') {
      setPaymentMethod('gcash');
    }
  }, [orderType]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = getSubtotal();
  const deliveryFee = orderType === 'delivery' ? deliveryInfo.fee : 0;
  const tax = 0;
  const total = subtotal + deliveryFee;


  if (items.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="mb-4"><ShoppingCart className="w-16 h-16 text-surface-300" /></div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">{t('emptyCartTitle')}</h2>
        <p className="text-surface-500 mb-6">{t('emptyCartDesc')}</p>
        <Link to={menuLink} className="btn-primary px-8" style={{ backgroundColor: brandingColor }}>{t('browseMenu')}</Link>
      </div>
    );
  }

  if (items.length === 0) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (totalPointsCost > 0) {
      if (!user) {
        setError('You must be logged in to claim rewards.');
        return;
      }
      if (hasInsufficientPoints) {
        setError(`Insufficient points. You need ${totalPointsCost} points but only have ${user.points || 0}.`);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const orderItems = items.map(item => ({
        productId: item.id, 
        quantity: item.quantity, 
        size: item.size, 
        flavor: item.flavor,
        notes: item.notes, 
        addons: item.selectedAddons?.map(a => a.id) || [],
        isRedemption: item.isRedemption || false,
        comboChoices: item.comboChoices // Add this!
      }));
      
      const res = await createOrder({ 
        customerId: user?.id,
        customerName: customerName.trim() || user?.name || 'Guest', 
        orderType, 
        paymentMethod, 
        items: orderItems, 
        notes,
        deliveryAddress: orderType === 'delivery' ? deliveryInfo.address : undefined,
        deliveryLat: orderType === 'delivery' ? deliveryInfo.lat : undefined,
        deliveryLng: orderType === 'delivery' ? deliveryInfo.lng : undefined,
        deliveryFee: orderType === 'delivery' ? deliveryInfo.fee : undefined,
        paymentReference: paymentMethod !== 'cash' ? paymentReference : undefined
      });
      const order = res.data.data;
      
      const activeOrdersKey = tenantSlug ? `${tenantSlug}_active_orders` : 'active_orders';
      const lastOrderKey = tenantSlug ? `${tenantSlug}_last_order_number` : 'last_order_number';

      const activeOrders = JSON.parse(localStorage.getItem(activeOrdersKey) || '[]');
      if (!activeOrders.includes(order.orderNumber)) {
        activeOrders.push(order.orderNumber);
        localStorage.setItem(activeOrdersKey, JSON.stringify(activeOrders));
      }
      localStorage.setItem(lastOrderKey, order.orderNumber);

      await refreshUser();
      clearCart();
      navigate(`/order/${order.orderNumber}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order.');
    } finally { setSubmitting(false); }
  };

  const calculateDeliveryFee = (lat, lng) => {
    if (!lat || !lng) return 0;
    const shopLocation = { lat: 14.5995, lng: 120.9842 }; // Shop Location
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat - shopLocation.lat) * Math.PI / 180;
    const dLon = (lng - shopLocation.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(shopLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    // Every 3km is 20 pesos
    return Math.ceil(distanceKm / 3) * 20;
  };

  return (
    <div className="min-h-screen bg-surface-50 pb-8" style={{ '--primary-custom': brandingColor }}>
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-surface-200/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={cartLink} className="text-surface-500 hover:text-surface-700 font-medium text-sm">← {t('back')}</Link>
          <h1 className="font-heading font-bold text-lg text-surface-900">{t('checkout')}</h1>
          <div className="w-16" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>}

        {/* Name */}
        <div className="glass-card p-5 animate-fade-in-up">
          <label className="block text-sm font-semibold text-surface-700 mb-2">{t('nameLabel')}</label>
          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
            className="input-field" placeholder={t('namePlaceholder')} id="customer-name" />
        </div>

        {/* Order Type */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label className="block text-sm font-semibold text-surface-700 mb-3">{t('orderType')}</label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {ORDER_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => setOrderType(t.id)}
                className={`p-3 sm:p-4 rounded-xl border-2 text-center font-semibold transition-all ${orderType === t.id ? 'border-transparent text-white' : 'border-surface-200 hover:border-primary-300 text-surface-600'}`}
                style={orderType === t.id ? { backgroundColor: brandingColor, borderColor: brandingColor, color: '#ffffff' } : {}}>
                <div className="mb-1 flex justify-center">{t.icon}</div>
                <span className="text-xs sm:text-sm">{t.label}</span>
              </button>
            ))}
          </div>

          {orderType === 'delivery' && (
            <div className="mt-6 pt-6 border-t border-surface-100 space-y-4 animate-fade-in">
              <label className="block text-sm font-bold text-surface-900 mb-1">{t('pickLocation')}</label>
              <LocationPicker 
                onLocationSelect={(loc) => {
                  const fee = calculateDeliveryFee(loc.lat, loc.lng);
                  setDeliveryInfo({ ...deliveryInfo, ...loc, fee });
                }}
                initialAddress={deliveryInfo.address}
              />
              {deliveryInfo.fee > 0 && (
                <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-between animate-bounce-in">
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Distance-Based Fee
                  </span>
                  <span className="font-bold text-primary-700">{formatCurrency(deliveryInfo.fee)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Method — hidden for points-only redemptions */}
        {isFullRedemption ? (
          <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl"><Gem className="w-5 h-5 text-emerald-500" /></div>
              <div>
                <p className="font-semibold text-emerald-700">{t('pointsRedemption')}</p>
                <p className="text-xs text-surface-500">{t('noPaymentNeeded')}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <label className="block text-sm font-bold text-surface-900 mb-3">{t('paymentMethod')}</label>
            <div className="grid grid-cols-3 gap-3">
              {PAYMENT_METHODS.map(m => {
                const isSelected = paymentMethod === m.id;
                const isGCash = m.id === 'gcash';
                const isMaya = m.id === 'maya';
                const isCash = m.id === 'cash';

                if (orderType === 'delivery' && isCash) return null;
                
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`h-20 rounded-2xl border-2 transition-all flex items-center justify-center px-4 shadow-sm active:scale-95 ${isSelected ? 'scale-[1.02]' : 'hover:border-slate-300'}`}
                    style={{
                      borderColor: isSelected ? brandingColor : '#e2e8f0',
                      borderWidth: isSelected ? '3px' : '2px',
                      backgroundColor: isSelected ? `${brandingColor}0d` : '#ffffff'
                    }}
                  >
                    {isGCash ? (
                      <img src="/logos/GCash-Logo.png" alt="GCash" className="h-8 max-w-full object-contain" />
                    ) : isMaya ? (
                      <img src="/logos/maya-logo.jpg" alt="Maya" className="h-8 max-w-full object-contain rounded-lg" />
                    ) : (
                      <Banknote className="w-8 h-8 text-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {paymentMethod !== 'cash' && (
              <div className="mt-5 pt-5 border-t border-surface-100 animate-fade-in space-y-4">
                {/* Auto-display QR Code */}
                {(paymentMethod === 'gcash' || paymentMethod === 'maya') && (
                  <div className="bg-surface-50 rounded-2xl p-4 border-2 border-dashed border-surface-200 flex flex-col items-center gap-4 animate-fade-in shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest text-surface-500">Scan or Save to Pay</p>
                    {branding?.[paymentMethod === 'gcash' ? 'gcashQr' : 'mayaQr'] ? (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div className="relative group">
                          <img 
                            src={branding[paymentMethod === 'gcash' ? 'gcashQr' : 'mayaQr']} 
                            alt={`${paymentMethod} QR`}
                            className="w-48 h-48 object-cover rounded-xl shadow-lg border-4 border-white transition-all group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/10 transition-colors rounded-xl pointer-events-none" />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = branding[paymentMethod === 'gcash' ? 'gcashQr' : 'mayaQr'];
                            link.download = `HometownBrew-${paymentMethod}-QR.png`;
                            link.target = "_blank";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="w-full py-3 bg-white border border-surface-200 rounded-xl shadow-sm hover:bg-surface-50 text-surface-700 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Download className="w-4 h-4 text-primary-500" />
                          Save QR Code
                        </button>
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-surface-100 rounded-xl flex flex-col items-center justify-center text-center p-4 border border-surface-200">
                        <Smartphone className="w-8 h-8 text-surface-300 mb-2" />
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tight">QR Code Not Uploaded Yet</p>
                      </div>
                    )}
                    <div className="text-[10px] font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full uppercase tracking-tighter flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                      Pay via {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} App
                    </div>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-surface-900 mb-2">
                    <Hash className="w-4 h-4 text-primary-500" />
                    {t('paymentRef')}
                  </label>
                  <input 
                    type="text" 
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    placeholder={t('refPlaceholder')}
                    className="input-field text-sm"
                    required={orderType === 'delivery'}
                  />
                </div>
              </div>
            )}
          </div>
        )}


        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <label className="block text-sm font-semibold text-surface-700 mb-2">{t('orderNotes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field h-20 resize-none text-sm" placeholder={t('notesPlaceholder')} />
        </div>

        {/* Summary */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="font-heading font-bold text-surface-900 mb-3">{t('orderSummary')}</h3>
          {items.map(item => {
            let price = item.price;
            if (item.selectedAddons) item.selectedAddons.forEach(a => { price += a.price; });
            return (
              <div key={item.cartKey} className="flex justify-between text-sm py-1.5 border-b border-surface-100 last:border-0">
                <span className="text-surface-600">{item.quantity}× {item.name}</span>
                <span className="text-surface-900 font-medium">{formatCurrency(price * item.quantity)}</span>
              </div>
            );
          })}
          <div className="border-t border-surface-200 mt-3 pt-3 space-y-2">
            {orderType === 'delivery' && (
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">{t('deliveryFee')}</span>
                <span className="text-surface-900 font-medium">{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold font-heading">
              <span>{t('total')}</span><span className="text-primary-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting || (totalPointsCost > 0 && hasInsufficientPoints) || (orderType === 'delivery' && (!deliveryInfo.address || !paymentReference))} 
          className={`w-full py-4 text-lg transition-all rounded-xl font-bold ${(hasInsufficientPoints && totalPointsCost > 0) || (orderType === 'delivery' && (!deliveryInfo.address || !paymentReference)) ? 'bg-surface-100 text-surface-400 cursor-not-allowed' : 'btn-primary'}`} 
          id="place-order-btn"
          style={!(hasInsufficientPoints && totalPointsCost > 0) ? { backgroundColor: brandingColor } : {}}
        >
          {submitting ? t('placingOrder') : 
           hasInsufficientPoints && totalPointsCost > 0 ? t('insufficientPoints').replace('{pts}', totalPointsCost) :
           isFullRedemption ? t('claimPoints').replace('{pts}', totalPointsCost) : 
           totalPointsCost > 0 ? t('orderWithPoints').replace('{price}', formatCurrency(total)).replace('{pts}', totalPointsCost) :
           t('placeOrderTotal').replace('{price}', formatCurrency(total))}
        </button>
      </form>
    </div>
  );
}
