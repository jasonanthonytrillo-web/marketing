import React, { useState, useEffect, useMemo } from 'react';
import { getProducts, createOrder, confirmOrder, startPreparing, completeOrder, markServed } from '../../services/api';
import {
  cacheCashierMenu,
  createClientOrderId,
  enqueueOfflineOrder,
  getCachedCashierMenu,
  getOfflineOrderCount,
  syncOfflineOrders
} from '../../services/offlineQueue';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { 
  Search, Plus, Minus, Trash2, ShoppingBag, Utensils, Banknote, 
  Smartphone, CreditCard, CheckCircle, X, ArrowLeft, Printer, 
  Sparkles, Tag, Coffee, Layers, User, Hash, AlertCircle, RefreshCw, Flame, ChefHat
} from 'lucide-react';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';

export default function CashierMenuPOS({ 
  onBackToOrders, 
  activeOrdersCount = 0, 
  cashierName = 'Cashier',
  isRestricted = false,
  onRestrictedAction = () => {},
  onOrderCreated = () => {}
}) {
  // Products & Categories
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Order Form State
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [orderType, setOrderType] = useState('dine_in'); // 'dine_in' | 'take_out'
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'gcash' | 'maya' | 'card'
  const [cashReceived, setCashReceived] = useState('');
  const [showCashKeypad, setShowCashKeypad] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  
  // Customizer Modal for Items with Sizes/Addons/Combos
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [itemNote, setItemNote] = useState('');
  const [comboChoices, setComboChoices] = useState({ group1: '', group2: '' });

  // Submission & Success Modal
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null); // { order, change, amountReceived }
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getOfflineOrderCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadMenuData();
    const handleOnline = () => {
      setIsOffline(false);
      syncPendingOrders();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    syncPendingOrders();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const res = await getProducts();
      const menu = res.data.data || [];
      setCategories(menu);
      cacheCashierMenu(menu);
    } catch (err) {
      console.error('Failed to load menu products for cashier:', err);
      const cachedMenu = getCachedCashierMenu();
      if (cachedMenu.length) setCategories(cachedMenu);
    } finally {
      setLoading(false);
    }
  };

  const syncPendingOrders = async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      await syncOfflineOrders(createOrder, confirmOrder, { startPreparing, completeOrder, markServed });
      setPendingSyncCount(getOfflineOrderCount());
      if (getOfflineOrderCount() === 0) onOrderCreated();
    } finally {
      setSyncing(false);
    }
  };

  // Flatten products for search & filtering
  const allProducts = useMemo(() => {
    const list = [];
    categories.forEach(cat => {
      if (cat.products && Array.isArray(cat.products)) {
        cat.products.forEach(prod => {
          list.push({ ...prod, categoryName: cat.name });
        });
      }
    });
    return list;
  }, [categories]);

  // Filtered products
  const displayedProducts = useMemo(() => {
    let prods = [];
    if (activeCategory === 'all') {
      prods = allProducts;
    } else {
      const cat = categories.find(c => String(c.id) === String(activeCategory));
      prods = cat?.products || [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      prods = prods.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return prods;
  }, [allProducts, categories, activeCategory, searchQuery]);

  // Handle clicking a product in the grid
  const handleProductClick = (product) => {
    if (isRestricted) {
      onRestrictedAction('taking orders');
      return;
    }

    if (product.stock <= 0) return;

    const hasSizes = product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0;
    const hasAddons = product.addons && Array.isArray(product.addons) && product.addons.length > 0;
    const isCombo = product.isCombo;

    if (hasSizes || hasAddons || isCombo) {
      // Open customization modal
      setCustomizingProduct(product);
      setSelectedSize(hasSizes ? product.sizes[0]?.name : '');
      setSelectedFlavor('');
      setSelectedAddons([]);
      setItemNote('');
      setComboChoices({ group1: '', group2: '' });
    } else {
      // Direct add to cart
      addItemToCart({
        product,
        size: null,
        price: product.price,
        flavor: '',
        addons: [],
        comboChoices: null,
        notes: ''
      });
    }
  };

  const addItemToCart = ({ product, size, price, flavor, addons, comboChoices, notes }) => {
    const cartKey = `${product.id}-${size || ''}-${flavor || ''}-${addons.map(a => a.id).sort().join(',')}-${JSON.stringify(comboChoices || {})}`;
    
    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.cartKey === cartKey);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product.id,
          name: product.name,
          categoryId: product.categoryId,
          price: parseFloat(price),
          image: product.image,
          size: size || null,
          flavor: flavor || null,
          addons: addons || [],
          comboChoices: comboChoices || null,
          notes: notes || '',
          quantity: 1
        }
      ];
    });
  };

  const handleConfirmCustomization = (e) => {
    e.preventDefault();
    if (!customizingProduct) return;

    let finalPrice = customizingProduct.price;
    if (selectedSize && customizingProduct.sizes && Array.isArray(customizingProduct.sizes)) {
      const match = customizingProduct.sizes.find(s => s.name === selectedSize);
      if (match) finalPrice = parseFloat(match.price);
    }

    addItemToCart({
      product: customizingProduct,
      size: selectedSize,
      price: finalPrice,
      flavor: selectedFlavor,
      addons: selectedAddons,
      comboChoices: customizingProduct.isCombo ? comboChoices : null,
      notes: itemNote
    });

    setCustomizingProduct(null);
  };

  const updateItemQty = (cartKey, delta) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.cartKey === cartKey) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeItem = (cartKey) => {
    setCartItems(prev => prev.filter(i => i.cartKey !== cartKey));
  };

  const clearCurrentCart = () => {
    setCartItems([]);
    setCustomerName('Walk-in Customer');
    setOrderNotes('');
    setCashReceived('');
    setReferenceNumber('');
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      let itemPrice = item.price;
      if (item.addons && Array.isArray(item.addons)) {
        item.addons.forEach(a => { itemPrice += (parseFloat(a.price) || 0); });
      }
      return acc + (itemPrice * item.quantity);
    }, 0);
  }, [cartItems]);

  const total = subtotal;

  const calculatedChange = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    const received = parseFloat(cashReceived) || 0;
    return received >= total ? received - total : 0;
  }, [cashReceived, total, paymentMethod]);

  const isCashInsufficient = useMemo(() => {
    if (paymentMethod !== 'cash') return false;
    const received = parseFloat(cashReceived) || 0;
    return total > 0 && received < total;
  }, [cashReceived, total, paymentMethod]);

  // Order Submission
  const handlePlaceOrder = async (autoConfirmPaid = true) => {
    if (isRestricted) {
      onRestrictedAction('placing orders');
      return;
    }

    if (cartItems.length === 0) {
      alert('Cart is empty. Please add items to place an order.');
      return;
    }

    if (!navigator.onLine && paymentMethod !== 'cash') {
      alert('Online payment methods are unavailable offline. Please use cash or reconnect to the internet.');
      return;
    }

    if (autoConfirmPaid && paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || total;
      if (received < total) {
        alert(`Insufficient cash amount. Total is ${formatCurrency(total)}, received is ${formatCurrency(received)}`);
        return;
      }
    }

    setSubmitting(true);
    const clientOrderId = createClientOrderId();
    try {
      const orderItems = cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        flavor: item.flavor,
        notes: item.notes,
        addons: item.addons?.map(a => a.id) || [],
        comboChoices: item.comboChoices
      }));

      const salePayload = {
        customerName: customerName.trim() || 'Walk-in Customer',
        orderType,
        paymentMethod,
        items: orderItems,
        notes: orderNotes,
        status: 'confirmed', // Directly sends ticket to kitchen display
        paymentReference: paymentMethod !== 'cash' ? referenceNumber : undefined,
        clientOrderId
      };
      const localOrder = {
        id: clientOrderId,
        clientOrderId,
        orderNumber: `OFFLINE-${clientOrderId.slice(-6).toUpperCase()}`,
        customerName: customerName.trim() || 'Walk-in Customer',
        orderType,
        paymentMethod,
        paymentStatus: 'paid',
        status: 'confirmed',
        subtotal: total,
        total,
        notes: orderNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: cartItems.map(item => ({
          id: `${clientOrderId}-${item.cartKey}`,
          productId: item.productId,
          productName: item.name,
          productPrice: item.price,
          quantity: item.quantity,
          subtotal: (item.price + (item.addons || []).reduce((sum, addon) => sum + (parseFloat(addon.price) || 0), 0)) * item.quantity,
          size: item.size,
          flavor: item.flavor,
          notes: item.notes
        }))
      };

      if (!navigator.onLine) {
        enqueueOfflineOrder({
          ...salePayload,
          payment: {
            amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total,
            paymentMethod,
            referenceNumber: referenceNumber || undefined
          }
        }, localOrder);
        setPendingSyncCount(getOfflineOrderCount());
        onOrderCreated();
        setOrderSuccess({
          order: { orderNumber: `OFFLINE-${clientOrderId.slice(-6).toUpperCase()}` },
          items: cartItems,
          total,
          amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total,
          change: calculatedChange,
          paymentMethod,
          orderType,
          customerName: customerName.trim() || 'Walk-in Customer',
          isPaid: true,
          isOffline: true
        });
        clearCurrentCart();
        return;
      }

      const payment = {
        amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total,
        paymentMethod,
        referenceNumber: referenceNumber || undefined
      };
      const resOrder = await createOrder(salePayload);

      const newOrder = resOrder.data.data;

      let finalPaidAmount = total;
      let finalChange = 0;

      if (autoConfirmPaid) {
        finalPaidAmount = paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total;
        finalChange = paymentMethod === 'cash' ? (finalPaidAmount - total) : 0;

        // Auto-confirm payment so it goes directly to shift sales & kitchen
        await confirmOrder(newOrder.id, payment);
      }

      // Notify parent to refresh cashier orders
      onOrderCreated();

      // Show receipt success modal
      setOrderSuccess({
        order: newOrder,
        items: cartItems,
        total,
        amountReceived: finalPaidAmount,
        change: finalChange,
        paymentMethod,
        orderType,
        customerName: customerName.trim() || 'Walk-in Customer',
        isPaid: autoConfirmPaid
      });

      // Clear the cart
      clearCurrentCart();

    } catch (err) {
      console.error('Failed to place cashier counter order:', err);
      if (!err.response || !navigator.onLine) {
        const orderItems = cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          flavor: item.flavor,
          notes: item.notes,
          addons: item.addons?.map(a => a.id) || [],
          comboChoices: item.comboChoices
        }));
        const localOrder = {
          id: clientOrderId,
          clientOrderId,
          orderNumber: `OFFLINE-${clientOrderId.slice(-6).toUpperCase()}`,
          customerName: customerName.trim() || 'Walk-in Customer',
          orderType,
          paymentMethod,
          paymentStatus: 'paid',
          status: 'confirmed',
          subtotal: total,
          total,
          notes: orderNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: cartItems.map(item => ({
            id: `${clientOrderId}-${item.cartKey}`,
            productId: item.productId,
            productName: item.name,
            productPrice: item.price,
            quantity: item.quantity,
            subtotal: (item.price + (item.addons || []).reduce((sum, addon) => sum + (parseFloat(addon.price) || 0), 0)) * item.quantity,
            size: item.size,
            flavor: item.flavor,
            notes: item.notes
          }))
        };
        enqueueOfflineOrder({
          customerName: customerName.trim() || 'Walk-in Customer', orderType, paymentMethod,
          items: orderItems, notes: orderNotes, status: 'confirmed', clientOrderId,
          paymentReference: paymentMethod !== 'cash' ? referenceNumber : undefined,
          payment: { amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total, paymentMethod, referenceNumber: referenceNumber || undefined }
        }, localOrder);
        setPendingSyncCount(getOfflineOrderCount());
        onOrderCreated();
        setOrderSuccess({ order: { orderNumber: `OFFLINE-${clientOrderId.slice(-6).toUpperCase()}` }, items: cartItems, total, amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || total) : total, change: calculatedChange, paymentMethod, orderType, customerName: customerName.trim() || 'Walk-in Customer', isPaid: true, isOffline: true });
        clearCurrentCart();
        return;
      }
      alert(err.response?.data?.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-surface-100 relative">
      {(isOffline || pendingSyncCount > 0 || syncing) && (
        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full text-[11px] font-black shadow-lg ${isOffline ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
          {isOffline ? 'Offline mode: sales are saved on this device' : syncing ? 'Syncing offline sales...' : `${pendingSyncCount} sale${pendingSyncCount === 1 ? '' : 's'} waiting to sync`}
        </div>
      )}
      
      {/* LEFT PANEL: Fast Cashier Menu Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-50 border-r border-surface-200 overflow-hidden no-print">
        
        {/* Streamlined Single-Row Toolbar with Categories & Search */}
        <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-surface-200 flex items-center justify-between gap-3 flex-shrink-0 shadow-xs">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 flex-1 min-w-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0 ${
                activeCategory === 'all'
                  ? 'bg-primary-600 text-white shadow-sm scale-[1.02]'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> All Items
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase tracking-wider flex-shrink-0 ${
                  String(activeCategory) === String(cat.id)
                    ? 'bg-primary-600 text-white shadow-sm scale-[1.02]'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-36 sm:w-48 lg:w-56 flex-shrink-0">
            <Search className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-surface-100 border border-surface-200 rounded-xl text-xs font-semibold text-surface-800 placeholder-surface-400 focus:bg-white focus:border-primary-500 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-surface-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
              <p className="text-sm font-bold">Loading Menu...</p>
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-surface-400 gap-2">
              <Coffee className="w-12 h-12 text-surface-300" />
              <p className="text-sm font-bold">No products found in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
              {displayedProducts.map(product => {
                const isOutOfStock = product.stock <= 0;
                const hasVariants = (product.sizes && product.sizes.length > 0) || (product.addons && product.addons.length > 0) || product.isCombo;

                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    disabled={isOutOfStock}
                    className={`group text-left bg-white border border-surface-200/90 rounded-2xl p-2.5 flex flex-col justify-between transition-all relative overflow-hidden shadow-xs active:scale-95 ${
                      isOutOfStock 
                        ? 'opacity-50 grayscale cursor-not-allowed' 
                        : 'hover:border-primary-500 hover:shadow-md hover:scale-[1.01]'
                    }`}
                  >
                    <div>
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-100 mb-2 relative">
                        <img 
                          src={product.image || DEFAULT_IMAGE} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { e.currentTarget.src = DEFAULT_IMAGE; }}
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                            <span className="px-2 py-1 bg-red-600 text-white font-black text-[10px] rounded-lg uppercase tracking-wider">Sold Out</span>
                          </div>
                        )}
                        {hasVariants && !isOutOfStock && (
                          <div className="absolute bottom-1 right-1 bg-surface-900/80 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            Options
                          </div>
                        )}
                      </div>
                      <h4 className="font-heading font-bold text-surface-900 text-xs sm:text-sm line-clamp-2 leading-tight mb-1">
                        {product.name}
                      </h4>
                      {product.categoryName && (
                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
                          {product.categoryName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-surface-100">
                      <span className="font-heading font-black text-primary-600 text-xs sm:text-sm">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform flex-shrink-0">
                        <Plus className="w-4 h-4" strokeWidth={3} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Live Order & Fast Cashier Checkout */}
      <div className="w-full md:w-[330px] lg:w-[370px] xl:w-[410px] flex flex-col bg-white border-l border-surface-200 flex-shrink-0 z-10 shadow-lg overflow-hidden no-print">
        
        {/* Cart Header */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-white/90" />
            <h3 className="font-heading font-black text-sm text-white">Counter Order</h3>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={clearCurrentCart}
              className="text-[11px] text-white/90 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded-lg border border-white/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Compact Customer & Order Type Bar */}
        <div className="p-2.5 bg-surface-50 border-b border-surface-200 flex flex-col gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Dine in / Take out */}
            <div className="flex items-center p-0.5 bg-surface-200 rounded-lg flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setOrderType('dine_in')}
                className={`px-2 py-1 rounded-md font-black text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all ${
                  orderType === 'dine_in' 
                    ? 'bg-white text-surface-900 shadow-xs' 
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Utensils className="w-3 h-3 text-emerald-600" /> Dine In
              </button>
              <button
                type="button"
                onClick={() => setOrderType('take_out')}
                className={`px-2 py-1 rounded-md font-black text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all ${
                  orderType === 'take_out' 
                    ? 'bg-white text-surface-900 shadow-xs' 
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <ShoppingBag className="w-3 h-3 text-amber-600" /> Take Out
              </button>
            </div>

            {/* Customer Name */}
            <div className="relative flex-1 min-w-0">
              <User className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name..."
                className="w-full pl-7 pr-2 py-1 bg-white border border-surface-200 rounded-lg text-xs font-semibold text-surface-800 placeholder-surface-400 focus:border-primary-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Cart Items List (Maximized Vertical Space) */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-[140px]">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-400 p-4 text-center">
              <Coffee className="w-10 h-10 text-surface-300 mb-1.5" />
              <p className="font-bold text-xs text-surface-600">No items in order</p>
              <p className="text-[11px] text-surface-400 mt-0.5">Tap products on the menu to add them.</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const itemTotal = (item.price + (item.addons?.reduce((s, a) => s + a.price, 0) || 0)) * item.quantity;

              return (
                <div 
                  key={item.cartKey}
                  className="bg-white border border-surface-200 rounded-xl p-2 flex items-center justify-between gap-2 shadow-xs hover:border-surface-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className="font-bold text-surface-900 text-xs truncate leading-tight">
                        {item.name}
                      </h5>
                      <span className="font-heading font-black text-surface-900 text-xs whitespace-nowrap">
                        {formatCurrency(itemTotal)}
                      </span>
                    </div>

                    <div className="text-[10px] text-surface-500 font-medium space-y-0.5 mt-0.5 leading-none">
                      {item.size && <span className="mr-1">Size: <strong className="text-surface-700">{item.size}</strong></span>}
                      {item.flavor && <span className="mr-1">Flavor: <strong className="text-surface-700">{item.flavor}</strong></span>}
                      {item.addons && item.addons.length > 0 && (
                        <span className="text-primary-600 block truncate">
                          + {item.addons.map(a => a.name).join(', ')}
                        </span>
                      )}
                      {item.comboChoices && (
                        <span className="text-primary-600 block truncate">
                          Combo: {item.comboChoices.group1} / {item.comboChoices.group2}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => updateItemQty(item.cartKey, -1)}
                      className="w-5 h-5 rounded-md bg-white text-surface-700 hover:bg-surface-200 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-black text-xs text-surface-900 w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateItemQty(item.cartKey, 1)}
                      className="w-5 h-5 rounded-md bg-white text-surface-700 hover:bg-surface-200 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Compact Order Summary & Checkout Box */}
        {cartItems.length > 0 && (
          <div className="p-2.5 bg-surface-50 border-t border-surface-200 space-y-2 flex-shrink-0 shadow-lg">
            
            {/* Total Due Row */}
            <div className="flex items-center justify-between bg-primary-600 text-white px-3 py-1.5 rounded-xl shadow-xs">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Total Due</span>
                <span className="text-[10px] text-white/90 ml-1.5 font-semibold">({cartItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
              </div>
              <span className="font-heading font-black text-lg text-white font-mono">
                {formatCurrency(total)}
              </span>
            </div>

            {/* Payment Method Selector (Compact Segmented Tabs) */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cash', label: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
                { id: 'gcash', label: 'GCash', icon: <Smartphone className="w-3.5 h-3.5" /> },
                { id: 'maya', label: 'Maya', icon: <CreditCard className="w-3.5 h-3.5" /> }
              ].map(method => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (method.id !== 'cash') {
                      setCashReceived(total.toString());
                    }
                  }}
                  className={`py-1 px-1 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 border transition-all ${
                    paymentMethod === method.id 
                      ? 'bg-surface-900 border-surface-900 text-white shadow-xs' 
                      : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-100'
                  }`}
                >
                  {method.icon}
                  <span>{method.label}</span>
                </button>
              ))}
            </div>

            {/* Cash Input & Change Calculation */}
            {paymentMethod === 'cash' ? (
              <div className="bg-white p-2 rounded-xl border border-surface-200 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-surface-700 whitespace-nowrap">Cash:</span>
                  
                  {/* Native System Numpad Input */}
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-surface-400">₱</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="w-full pl-6 pr-2 py-1.5 bg-surface-50 border border-surface-200 rounded-lg text-xs font-black text-right text-surface-900 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all font-mono"
                    />
                  </div>

                  {/* Quick Exact Button */}
                  <button
                    type="button"
                    onClick={() => setCashReceived(total.toString())}
                    className="px-2.5 py-1.5 bg-surface-900 hover:bg-surface-800 text-white font-bold text-[10px] rounded-lg transition-colors whitespace-nowrap active:scale-95 shadow-xs"
                  >
                    Exact
                  </button>
                </div>

                {/* Change Row */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-100">
                  <span className="font-bold text-surface-600 text-[11px]">Change (Sukli):</span>
                  <span className={`font-black font-mono text-sm ${calculatedChange > 0 ? 'text-emerald-600' : 'text-surface-800'}`}>
                    {formatCurrency(calculatedChange)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Ref # (Optional)"
                  className="w-full pl-7 pr-2 py-1 bg-white border border-surface-200 rounded-lg text-xs font-bold text-surface-800 placeholder-surface-400 focus:border-primary-500 outline-none shadow-xs"
                />
              </div>
            )}            {/* Action Buttons */}
            <div className="flex pt-0.5">
              <button
                type="button"
                onClick={() => handlePlaceOrder()}
                disabled={submitting || isCashInsufficient}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{submitting ? 'Placing...' : `Confirm Order (${formatCurrency(total)})`}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CUSTOMIZER MODAL FOR PRODUCTS WITH VARIANTS */}
      {customizingProduct && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-in border border-surface-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-primary-600 to-primary-700 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/20 flex-shrink-0">
                  <img 
                    src={customizingProduct.image || DEFAULT_IMAGE} 
                    alt={customizingProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base leading-tight">{customizingProduct.name}</h3>
                  <p className="text-xs text-white/90 font-bold mt-0.5">
                    Base Price: {formatCurrency(customizingProduct.price)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCustomizingProduct(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmCustomization} className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Size Selection */}
              {customizingProduct.sizes && Array.isArray(customizingProduct.sizes) && customizingProduct.sizes.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-surface-600 uppercase tracking-wider mb-2">
                    Choose Size Variant
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {customizingProduct.sizes.map(size => (
                      <button
                        key={size.name}
                        type="button"
                        onClick={() => setSelectedSize(size.name)}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          selectedSize === size.name 
                            ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/20' 
                            : 'bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100'
                        }`}
                      >
                        <span className="block font-black text-xs">{size.name}</span>
                        <span className="block text-[11px] font-semibold mt-0.5 opacity-90">₱{size.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Addons Selection */}
              {customizingProduct.addons && Array.isArray(customizingProduct.addons) && customizingProduct.addons.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-surface-600 uppercase tracking-wider mb-2">
                    Optional Add-ons
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {customizingProduct.addons.map(addon => {
                      const isSelected = selectedAddons.some(a => a.id === addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAddons(prev => prev.filter(a => a.id !== addon.id));
                            } else {
                              setSelectedAddons(prev => [...prev, addon]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                              : 'bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100'
                          }`}
                        >
                          <span className="text-xs font-bold">{addon.name}</span>
                          <span className="text-[11px] font-black text-primary-600">+₱{addon.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Combo Options */}
              {customizingProduct.isCombo && customizingProduct.comboOptions && (
                <div className="space-y-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs font-black text-surface-900 uppercase tracking-wider block">
                    Mix & Match Combo Selections
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-surface-700 mb-1">
                      {customizingProduct.comboGroup1Name || 'Option 1'}:
                    </label>
                    <select
                      value={comboChoices.group1}
                      onChange={e => setComboChoices({ ...comboChoices, group1: e.target.value })}
                      className="w-full p-2.5 bg-white border border-surface-200 rounded-xl text-xs font-bold text-surface-800 outline-none"
                    >
                      <option value="">Select Option...</option>
                      {customizingProduct.comboOptions.filter(o => o.groupNumber === 1).map(opt => (
                        <option key={opt.id} value={opt.product?.name || `Product #${opt.productId}`}>
                          {opt.product?.name} {opt.priceBonus > 0 ? `(+₱${opt.priceBonus})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-surface-700 mb-1">
                      {customizingProduct.comboGroup2Name || 'Option 2'}:
                    </label>
                    <select
                      value={comboChoices.group2}
                      onChange={e => setComboChoices({ ...comboChoices, group2: e.target.value })}
                      className="w-full p-2.5 bg-white border border-surface-200 rounded-xl text-xs font-bold text-surface-800 outline-none"
                    >
                      <option value="">Select Option...</option>
                      {customizingProduct.comboOptions.filter(o => o.groupNumber === 2).map(opt => (
                        <option key={opt.id} value={opt.product?.name || `Product #${opt.productId}`}>
                          {opt.product?.name} {opt.priceBonus > 0 ? `(+₱${opt.priceBonus})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Item Notes */}
              <div>
                <label className="block text-xs font-black text-surface-600 uppercase tracking-wider mb-1.5">
                  Special Instructions (Optional)
                </label>
                <input 
                  type="text"
                  value={itemNote}
                  onChange={e => setItemNote(e.target.value)}
                  placeholder="e.g. Less ice, extra hot, no mayo"
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-xs font-semibold text-surface-800 placeholder-surface-400 focus:bg-white focus:border-primary-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCustomizingProduct(null)}
                  className="flex-1 py-3 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-primary-600/20 transition-all"
                >
                  Add to Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT / SUCCESS MODAL */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-surface-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-surface-100">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative no-print">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-heading font-black text-xl tracking-tight mb-1">Order #{orderSuccess.order.orderNumber}</h3>
              <p className="text-white/90 text-xs font-semibold">
                {orderSuccess.isPaid ? 'Payment Confirmed & Sent to Kitchen' : 'Saved as Pending'}
              </p>
            </div>

            {/* Printable Receipt Card Body */}
            <div className="p-6 space-y-4 print:p-0 print:space-y-2 text-xs text-surface-800">
              <div className="text-center pb-3 border-b border-dashed border-surface-300">
                <h4 className="font-heading font-black text-sm uppercase tracking-wider text-surface-900">Hometown Brew POS</h4>
                <p className="text-[10px] text-surface-500 mt-0.5">{formatDate(new Date())}</p>
                <div className="flex justify-between text-[11px] font-bold text-surface-700 mt-2">
                  <span>Order: <strong>{orderSuccess.order.orderNumber}</strong></span>
                  <span className="capitalize">{orderSuccess.orderType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-[11px] text-surface-600">
                  <span>Customer: {orderSuccess.customerName}</span>
                  <span>Cashier: {cashierName}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {orderSuccess.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-surface-900">{item.quantity}x {item.name}</span>
                      {item.size && <span className="text-[10px] text-surface-500 block">Size: {item.size}</span>}
                    </div>
                    <span className="font-mono font-bold text-surface-900">
                      {formatCurrency((item.price + (item.addons?.reduce((s, a) => s + a.price, 0) || 0)) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="border-t border-dashed border-surface-300 pt-3 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-surface-900 text-sm">
                  <span>Total Amount:</span>
                  <span className="font-mono font-black">{formatCurrency(orderSuccess.total)}</span>
                </div>
                {orderSuccess.isPaid && (
                  <>
                    <div className="flex justify-between text-surface-600">
                      <span>Paid via ({orderSuccess.paymentMethod.toUpperCase()}):</span>
                      <span className="font-mono">{formatCurrency(orderSuccess.amountReceived)}</span>
                    </div>
                    {orderSuccess.change > 0 && (
                      <div className="flex justify-between font-black text-emerald-700 text-sm pt-1 border-t border-surface-100">
                        <span>Change (Sukli):</span>
                        <span className="font-mono">{formatCurrency(orderSuccess.change)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons (Hidden when printing) */}
              <div className="space-y-2 pt-3 no-print">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderSuccess(null)}
                    className="py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Next Order
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSuccess(null);
                      onBackToOrders();
                    }}
                    className="py-2.5 bg-surface-100 hover:bg-surface-200 active:scale-95 text-surface-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    View Orders
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
