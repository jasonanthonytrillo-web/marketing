import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { getPublicTenant } from '../services/api';

export default function Cart() {
  const { items, updateQuantity, removeFromCart, toggleRedemption, clearCart, getSubtotal, getItemCount, getTotalPointsCost } = useCart();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const [branding, setBranding] = useState(null);
  
  const isCustomer = user && user.role === 'customer';
  const subtotal = getSubtotal();
  const totalPoints = getTotalPointsCost();
  const count = getItemCount();

  useEffect(() => {
    if (tenantSlug) {
      getPublicTenant(tenantSlug).then(res => {
        if (res.data.success) setBranding(res.data.data);
      });
    }
  }, [tenantSlug]);

  const brandingColor = branding?.primaryColor || '#f97316';
  const menuLink = tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu';
  const checkoutLink = tenantSlug ? `/checkout?tenant=${tenantSlug}` : '/checkout';

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="font-heading text-2xl font-bold text-surface-900 mb-2">Your cart is empty</h2>
        <p className="text-surface-500 mb-6">Add some delicious items from our menu!</p>
        <Link to={menuLink} className="btn-primary" style={{ backgroundColor: brandingColor }}>Browse Menu</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-40">
      {/* Top Left Back Button */}
      <div className="p-3 sm:p-4 md:p-6 lg:px-8 pb-0 flex justify-between items-center">
        <Link to={menuLink} className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-3 bg-white rounded-full text-xs sm:text-sm font-bold text-surface-700 shadow-sm border border-surface-200 hover:border-primary-300 hover:shadow-md transition-all">
          <span className="text-lg sm:text-xl leading-none">←</span> Back to Menu
        </Link>
        
        {isCustomer && (
          <div className="bg-white border border-surface-200 px-4 py-2 rounded-2xl shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Your Wallet</p>
            <p className="text-sm font-black text-emerald-600 leading-none">💎 {Math.floor(user.points)} <span className="text-[10px]">PTS</span></p>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        <div className="mb-4 md:mb-6">
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-surface-900 mb-1">Your Cart</h1>
          <p className="text-surface-500 text-base md:text-lg font-medium">{count} item{count !== 1 ? 's' : ''}</p>
        </div>

        <div className="space-y-5">
          {items.map((item, idx) => {
            let itemPrice = item.price;
            if (item.selectedAddons) item.selectedAddons.forEach(a => { itemPrice += a.price; });
            const lineTotal = item.isRedemption ? 0 : itemPrice * item.quantity;

            return (
              <div key={item.cartKey} className={`glass-card p-4 md:p-6 animate-fade-in-up border-2 transition-all ${item.isRedemption ? 'border-emerald-500/50 bg-emerald-50/10' : 'border-transparent'}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="flex gap-3 md:gap-5">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-surface-100 rounded-xl md:rounded-2xl flex items-center justify-center text-3xl md:text-5xl flex-shrink-0 relative overflow-hidden">
                    <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop'} className="w-full h-full object-cover" />
                    {item.isRedemption && (
                      <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[1px] flex items-center justify-center">✅</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-heading font-bold text-surface-900 text-base md:text-xl pr-4">{item.name}</h3>
                        <button onClick={() => removeFromCart(item.cartKey)} className="text-surface-400 hover:text-red-500 text-2xl md:text-3xl w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors -mt-1 -mr-1 md:-mt-2 md:-mr-2">×</button>
                      </div>
                      
                      {item.isRedemption ? (
                        <div className="mt-2 flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full self-start inline-flex">
                          💎 Redeemed for {item.pointsCost * item.quantity} Pts
                        </div>
                      ) : (
                        <>
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <p className="text-xs md:text-sm font-medium mt-1" style={{ color: brandingColor }}>+ {item.selectedAddons.map(a => a.name).join(', ')}</p>
                          )}
                        </>
                      )}
                      
                      {item.notes && <p className="text-xs md:text-sm text-surface-500 mt-1 italic">"{item.notes}"</p>}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 md:mt-4 gap-2 sm:gap-0">
                      <div className="flex items-center gap-2 md:gap-3 bg-surface-100 p-1 md:p-1.5 rounded-xl md:rounded-2xl self-start sm:self-auto">
                        <button onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                          className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white shadow-sm hover:bg-surface-50 flex items-center justify-center text-surface-700 font-bold text-lg md:text-2xl transition-all active:scale-95">−</button>
                        <span className="w-8 md:w-12 text-center font-bold text-lg md:text-xl text-surface-900">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                          className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl shadow-sm hover:brightness-110 flex items-center justify-center text-white font-bold text-lg md:text-2xl transition-all active:scale-95"
                          style={{ backgroundColor: brandingColor }}
                        >+</button>
                      </div>
                      <span className={`font-heading font-black text-xl md:text-3xl self-end sm:self-auto ${item.isRedemption ? 'text-emerald-500' : ''}`} style={!item.isRedemption ? { color: brandingColor } : {}}>
                        {item.isRedemption ? 'FREE' : formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center md:justify-end animate-fade-in-up" style={{ animationDelay: `${items.length * 0.05}s` }}>
          <button onClick={clearCart} className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold text-lg px-6 py-3 rounded-2xl bg-white border-2 border-red-100 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm">
            Clear Cart
          </button>
        </div>
      </div>

      {/* Bottom checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-surface-200 p-4 md:p-6 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs md:text-sm font-semibold text-surface-500 uppercase tracking-wider mb-0.5 md:mb-1">Subtotal</p>
            <p className="font-heading text-2xl md:text-4xl font-black text-surface-900">{formatCurrency(subtotal)}</p>
          </div>
          <Link to={checkoutLink} className="py-3 md:py-5 px-6 md:px-10 text-base md:text-xl rounded-xl md:rounded-2xl shadow-xl shadow-primary-500/30 whitespace-nowrap text-center flex-1 max-w-[200px] md:max-w-none text-white font-black" style={{ backgroundColor: brandingColor }} id="checkout-btn">
            Checkout <span className="hidden sm:inline">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
