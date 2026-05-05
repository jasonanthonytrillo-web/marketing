import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import { useSocket } from '../context/SocketContext';
import { formatCurrency, unlockAudio } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useDynamicBranding } from '../hooks/useDynamicBranding';

export default function Menu() {
  const { user, logoutUser } = useAuth();
  const isCustomer = user && user.role === 'customer';
  const [categories, setCategories] = useState([]);
  const [tenantName, setTenantName] = useState('Our Menu');
  const [branding, setBranding] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showRewards, setShowRewards] = useState(false);
  const [addOpts, setAddOpts] = useState({ size: '', flavor: '', addons: [], notes: '' });
  const { addToCart, getItemCount, items, getSubtotal } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => { loadProducts(); }, [searchParams]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts();
      setCategories(res.data.data || []);
      if (res.data.tenantName) setTenantName(res.data.tenantName);
      if (res.data.branding) setBranding(res.data.branding);
    } catch (e) { 
      console.error('Failed to load products:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const brandingColor = branding?.primaryColor || '#f97316';
  const itemCount = getItemCount();

  const { joinRoom, connected } = useSocket();

  useEffect(() => {
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

  const handleAddToCart = (product) => {
    addToCart(product, addOpts);
    setSelectedProduct(null);
    setAddOpts({ size: '', flavor: '', addons: [], notes: '' });
  };

  const toggleAddon = (addon) => {
    setAddOpts(prev => ({
      ...prev,
      addons: prev.addons.find(a => a.id === addon.id)
        ? prev.addons.filter(a => a.id !== addon.id)
        : [...prev.addons, { id: addon.id, name: addon.name, price: addon.price }]
    }));
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const [showUserMenu, setShowUserMenu] = useState(false);

  // Dynamic favicon & title
  useDynamicBranding(tenantName, branding?.favicon);

  if (loading) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const filteredCategories = activeCategory === 'all' ? categories : categories.filter(c => String(c.id) === activeCategory);

  return (
    <div className="min-h-screen bg-surface-50 pb-24" style={{ '--primary-custom': brandingColor }}>
      {/* Sticky Top Header Row */}
      <div className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-xl border-b border-surface-200/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:px-8 flex justify-between items-center">
          <Link to={searchParams.get('tenant') ? `/?tenant=${searchParams.get('tenant')}` : '/'} className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-3 bg-white rounded-full text-xs md:text-sm font-bold text-surface-700 shadow-sm border border-surface-200 hover:border-primary-300 hover:shadow-md transition-all active:scale-95">
            <span className="text-lg md:text-xl leading-none">←</span> <span className="hidden sm:inline">Back Home</span><span className="sm:hidden">Back</span>
          </Link>

        {isCustomer && user && (
          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setShowRewards(true)}
              className="animate-fade-in flex items-center gap-3 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl shadow-sm hover:bg-emerald-100 transition-all active:scale-95 group"
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">💎</div>
              <div className="text-left hidden sm:block">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-0.5">Points</p>
                <p className="text-sm font-black text-emerald-900 leading-none">{Math.floor(user.points || 0)}</p>
              </div>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all border-2 border-white"
                style={{ backgroundColor: brandingColor }}
              >
                {getInitials(user.name)}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-surface-100 overflow-hidden z-50 animate-scale-in origin-top-right">
                  <div className="p-4 border-b border-surface-50 bg-surface-50/50">
                    <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1">Signed in as</p>
                    <p className="font-bold text-surface-900 truncate">{user.name}</p>
                  </div>
                  <div className="p-2">
                    <Link 
                      to={searchParams.get('tenant') ? `/account?tenant=${searchParams.get('tenant')}&action=change-password` : '/account?action=change-password'}
                      className="flex items-center gap-3 w-full p-3 rounded-2xl text-surface-600 hover:bg-surface-50 hover:text-primary-600 transition-all font-bold text-sm"
                    >
                      <span>🔒</span> Change Password
                    </Link>
                    <Link 
                      to={searchParams.get('tenant') ? `/account?tenant=${searchParams.get('tenant')}` : '/account'}
                      className="flex items-center gap-3 w-full p-3 rounded-2xl text-surface-600 hover:bg-surface-50 hover:text-primary-600 transition-all font-bold text-sm"
                    >
                      <span>📜</span> Order History
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logoutUser();
                      }}
                      className="flex items-center gap-3 w-full p-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
                    >
                      <span>👋</span> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6 flex flex-col md:flex-row gap-6 lg:gap-8">
        {/* Left Sidebar: Categories */}
        <div className="w-full md:w-48 lg:w-56 flex-shrink-0 animate-fade-in-up relative">
          <div className="md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] flex flex-col">
            <div className="flex-shrink-0 mb-6">
              {branding?.logo ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-white mb-4">
                  <img src={branding.logo} className="w-full h-full object-cover" alt={tenantName} />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl shadow-lg border-2 border-white mb-4" style={{ color: brandingColor }}>
                  💎
                </div>
              )}
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-surface-900 mb-1 uppercase" style={{ color: brandingColor }}>{tenantName}</h1>
              <p className="text-surface-500 text-xs md:text-sm mb-3 md:mb-6">Tap an item to customize and add to cart</p>
            </div>

            <div className="flex overflow-x-auto md:grid md:grid-cols-1 gap-2 md:gap-4 pb-2 md:pb-20 scrollbar-hide px-1 md:overflow-y-auto rounded-xl md:rounded-3xl">
              <button 
                onClick={() => setActiveCategory('all')} 
                className={`flex-shrink-0 w-20 md:w-auto flex flex-col items-center justify-center text-center aspect-square rounded-2xl md:rounded-3xl p-2 md:p-3 transition-all ${activeCategory === 'all' ? 'text-white shadow-lg shadow-primary-500/30 scale-[1.05]' : 'bg-white text-surface-600 border border-surface-200 hover:border-primary-300 hover:bg-surface-50 hover:scale-[1.05]'}`}
                style={activeCategory === 'all' ? { backgroundColor: brandingColor } : {}}
              >
                <span className="text-3xl md:text-4xl lg:text-5xl mb-1 md:mb-2 lg:mb-3">🍽️</span>
                <span className="text-[10px] md:text-sm lg:text-base font-bold leading-tight">All Items</span>
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveCategory(String(cat.id))} 
                  className={`flex-shrink-0 w-20 md:w-auto flex flex-col items-center justify-center text-center aspect-square rounded-2xl md:rounded-3xl p-2 md:p-3 transition-all ${activeCategory === String(cat.id) ? 'text-white shadow-lg shadow-primary-500/30 scale-[1.05]' : 'bg-white text-surface-600 border border-surface-200 hover:border-primary-300 hover:bg-surface-50 hover:scale-[1.05]'}`}
                  style={activeCategory === String(cat.id) ? { backgroundColor: brandingColor } : {}}
                >
                  <span className="text-3xl md:text-4xl lg:text-5xl mb-1 md:mb-2 lg:mb-3">{cat.icon || '📦'}</span>
                  <span className="text-[10px] md:text-sm lg:text-base font-bold leading-tight line-clamp-2">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content: Products Grid */}
        <div className="flex-1 animate-fade-in-up">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="mb-12">
              <h2 className="font-heading text-xl md:text-2xl font-bold text-surface-800 mb-6 flex items-center gap-2">
                <span className="w-2 h-8 rounded-full" style={{ backgroundColor: brandingColor }}></span>
                {cat.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {cat.products?.map((product, idx) => (
                  <button 
                    key={product.id} 
                    onClick={() => { setSelectedProduct(product); setAddOpts({ size: '', flavor: '', addons: [], notes: '' }); }}
                    className={`glass-card text-left overflow-hidden group flex flex-col ${(!product.available || product.stock <= 0) ? 'opacity-75 grayscale-[0.5] cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                    disabled={!product.available || product.stock <= 0}
                  >
                    <div className="h-32 md:h-48 bg-white flex items-center justify-center text-6xl md:text-8xl transition-transform duration-500 w-full relative">
                      <img 
                        src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop'} 
                        className="w-full h-full object-cover" 
                      />
                      {product.pointsCost && isCustomer && (
                        <div className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                          💎 {product.pointsCost} PTS
                        </div>
                      )}
                      {(!product.available || product.stock <= 0) && (
                        <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-red-500 text-white font-black px-4 py-1.5 rounded-xl text-xs uppercase tracking-widest -rotate-12">Sold Out</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 md:p-5 flex flex-col flex-1 w-full bg-white">
                      <h3 className="font-heading font-bold text-surface-900 text-lg md:text-xl mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xs md:text-sm text-surface-500 line-clamp-2 mb-3 md:mb-4 flex-1">{product.description}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="font-heading font-black text-xl md:text-2xl" style={{ color: brandingColor }}>₱{product.price.toFixed(2)}</span>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl font-black transition-all group-hover:scale-110 text-white" style={{ backgroundColor: brandingColor }}>
                          +
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Cart Button */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-6">
          <Link 
            to={searchParams.get('tenant') ? `/cart?tenant=${searchParams.get('tenant')}` : '/cart'} 
            className="flex items-center justify-between w-full h-16 px-6 rounded-3xl text-white shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all animate-bounce-in"
            style={{ backgroundColor: brandingColor }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 8h13l1.5 13H4L5.5 8z" /><path d="M8 11V6a4 4 0 0 1 8 0v5" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">{itemCount} Items</p>
                <p className="text-lg font-black leading-none">₱{getSubtotal().toFixed(2)}</p>
              </div>
            </div>
            <span className="font-black uppercase tracking-widest text-sm">Review Cart →</span>
          </Link>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="h-48 md:h-64 bg-surface-100 flex items-center justify-center text-7xl relative overflow-hidden">
              <img src={selectedProduct.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop'} className="w-full h-full object-cover" />
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="absolute top-6 right-6 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all z-20 group"
              >
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <h2 className="font-heading text-2xl font-bold text-surface-900 mb-1">{selectedProduct.name}</h2>
              <p className="text-surface-500 text-sm mb-6">{selectedProduct.description}</p>
              
              <div className="flex items-center gap-4 mb-8">
                <p className="font-heading text-3xl font-bold" style={{ color: brandingColor }}>₱{selectedProduct.price.toFixed(2)}</p>
                {selectedProduct.pointsCost && isCustomer && (
                  <div className="bg-amber-50 text-amber-600 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-100">
                    💎 Redeem for {selectedProduct.pointsCost} Points
                  </div>
                )}
              </div>

              {/* Add-ons */}
              {selectedProduct.addons && selectedProduct.addons.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-black text-surface-400 uppercase tracking-widest mb-3">Custom Add-ons</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.addons.map(addon => (
                      <button key={addon.id} onClick={() => toggleAddon(addon)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${addOpts.addons.find(a => a.id === addon.id) ? 'border-transparent text-white' : 'bg-surface-50 border-surface-200 text-surface-600 hover:border-primary-300'}`}
                        style={addOpts.addons.find(a => a.id === addon.id) ? { backgroundColor: brandingColor } : {}}>
                        {addon.name} +₱{addon.price}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-8">
                <h3 className="text-xs font-black text-surface-400 uppercase tracking-widest mb-3">Special Instructions</h3>
                <textarea 
                  value={addOpts.notes} 
                  onChange={e => setAddOpts(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-surface-50 border border-surface-200 rounded-2xl p-4 text-surface-900 placeholder-surface-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none h-24 resize-none" 
                  placeholder="e.g. No onions, extra sauce..." 
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => handleAddToCart(selectedProduct)} 
                  className="flex-1 py-4 rounded-2xl font-black text-white uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: brandingColor }}
                  disabled={!selectedProduct.available}
                >
                  Add to Cart
                </button>

                {selectedProduct.pointsCost && isCustomer && (
                  <button
                    disabled={!selectedProduct.available || (user?.points || 0) < selectedProduct.pointsCost}
                    onClick={() => {
                      addToCart(selectedProduct, { ...addOpts, isRedemption: true });
                      setSelectedProduct(null);
                      setAddOpts({ size: '', flavor: '', addons: [], notes: '' });
                    }}
                    className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  >
                    💎 Redeem
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rewards Gallery Modal */}
      {showRewards && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowRewards(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="p-8 bg-emerald-600 text-white flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black tracking-tight uppercase mb-1">Rewards Gallery</h2>
                <p className="text-emerald-100 font-bold">💎 {Math.floor(user?.points || 0)} Points Available</p>
              </div>
              <button onClick={() => setShowRewards(false)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl hover:bg-white/30 transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.flatMap(c => c.products).filter(p => p.pointsCost).map(product => {
                const canAfford = (user?.points || 0) >= product.pointsCost;
                return (
                  <div key={product.id} className={`bg-surface-50 border border-surface-100 rounded-3xl p-4 ${!canAfford && 'opacity-60'}`}>
                    <div className="flex gap-4 items-center mb-4">
                      <img src={product.image || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm" />
                      <div>
                        <h4 className="font-bold text-surface-900 leading-tight mb-1">{product.name}</h4>
                        <p className="text-emerald-600 font-black">💎 {product.pointsCost} Pts</p>
                      </div>
                    </div>
                    <button
                      disabled={!canAfford || !product.available}
                      onClick={() => {
                        addToCart(product, { isRedemption: true });
                        setShowRewards(false);
                      }}
                      className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${canAfford ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-700' : 'bg-surface-200 text-surface-500'}`}
                    >
                      {canAfford ? 'Claim Reward' : `Need ${product.pointsCost - Math.floor(user?.points || 0)} More`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
