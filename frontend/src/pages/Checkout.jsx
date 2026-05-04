import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, createXenditInvoice, getPublicTenant } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const ORDER_TYPES = [{ id: 'dine_in', label: 'Dine In', icon: '🍽️' }, { id: 'take_out', label: 'Take Out', icon: '🥡' }];
const PAYMENT_METHODS = [{ id: 'cash', label: 'Cash', icon: '💵' }, { id: 'gcash', label: 'GCash', icon: '📱' }, { id: 'maya', label: 'Maya', icon: '💳' }, { id: 'card', label: 'Card', icon: '💳' }];

export default function Checkout() {
  const { items, getSubtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const [branding, setBranding] = useState(null);

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [orderType, setOrderType] = useState('dine_in');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (tenantSlug) {
      getPublicTenant(tenantSlug).then(res => {
        if (res.data.success) setBranding(res.data.data);
      });
    }
  }, [tenantSlug]);

  const brandingColor = branding?.primaryColor || '#4f46e5';
  const cartLink = tenantSlug ? `/cart?tenant=${tenantSlug}` : '/cart';
  const menuLink = tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu';
  const isFullRedemption = items.length > 0 && items.every(item => item.isRedemption);
  const [paymentMethod, setPaymentMethod] = useState(isFullRedemption ? 'points' : 'cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = getSubtotal();
  const tax = subtotal * 0.12;
  const total = subtotal + tax;

  if (items.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Your cart is empty</h2>
        <p className="text-surface-500 mb-6">Please add some items from the menu first.</p>
        <Link to={menuLink} className="btn-primary px-8" style={{ backgroundColor: brandingColor }}>View Menu</Link>
      </div>
    );
  }

  if (items.length === 0) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        isRedemption: item.isRedemption || false
      }));
      
      const res = await createOrder({ 
        customerId: user?.id,
        customerName: customerName.trim() || user?.name || 'Guest', 
        orderType, 
        paymentMethod, 
        items: orderItems, 
        notes 
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

      if (paymentMethod === 'gcash' || paymentMethod === 'maya' || paymentMethod === 'card') {
        try {
          const xenditRes = await createXenditInvoice({
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: total,
            customerName: customerName || 'Guest',
            paymentMethod: paymentMethod
          });
          
          if (xenditRes.data.success && xenditRes.data.invoice_url) {
            window.location.href = xenditRes.data.invoice_url;
            return;
          }
        } catch (xErr) {
          console.error('Xendit Error:', xErr);
          setError('Online payment failed to initialize. Please pay at the counter.');
          setSubmitting(false);
          return;
        }
      }
      
      navigate(tenantSlug ? `/order/${order.orderNumber}?tenant=${tenantSlug}` : `/order/${order.orderNumber}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-surface-50 pb-8" style={{ '--primary-custom': brandingColor }}>
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-surface-200/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={cartLink} className="text-surface-500 hover:text-surface-700 font-medium text-sm">← Back</Link>
          <h1 className="font-heading font-bold text-lg text-surface-900">Checkout</h1>
          <div className="w-16" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>}

        {/* Name */}
        <div className="glass-card p-5 animate-fade-in-up">
          <label className="block text-sm font-semibold text-surface-700 mb-2">Your Name (Optional)</label>
          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
            className="input-field" placeholder="Enter your name" id="customer-name" />
        </div>

        {/* Order Type */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label className="block text-sm font-semibold text-surface-700 mb-3">Order Type</label>
          <div className="grid grid-cols-2 gap-3">
            {ORDER_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => setOrderType(t.id)}
                className={`p-4 rounded-xl border-2 text-center font-semibold transition-all ${orderType === t.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-surface-200 hover:border-primary-300 text-surface-600'}`}>
                <div className="text-2xl mb-1">{t.icon}</div>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method — hidden for points-only redemptions */}
        {isFullRedemption ? (
          <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl">💎</div>
              <div>
                <p className="font-semibold text-emerald-700">Points Redemption</p>
                <p className="text-xs text-surface-500">No payment needed — using your loyalty points</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <label className="block text-sm font-semibold text-surface-700 mb-3">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(m => (
                <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                  className={`p-3 rounded-xl border-2 text-center font-medium text-sm transition-all ${paymentMethod === m.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-surface-200 hover:border-primary-300 text-surface-600'}`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <label className="block text-sm font-semibold text-surface-700 mb-2">Order Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field h-20 resize-none text-sm" placeholder="Any special requests..." />
        </div>

        {/* Summary */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="font-heading font-bold text-surface-900 mb-3">Order Summary</h3>
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
          <div className="border-t border-surface-200 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-500">Tax (12%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between text-lg font-bold font-heading mt-2 pt-2 border-t border-surface-200">
              <span>Total</span><span className="text-primary-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-lg" id="place-order-btn">
          {submitting ? 'Placing Order...' : isFullRedemption ? '🎁 Claim Reward' : `Place Order — ${formatCurrency(total)}`}
        </button>
      </form>
    </div>
  );
}
