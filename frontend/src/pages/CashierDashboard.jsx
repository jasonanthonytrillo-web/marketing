import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCashierOrders, confirmOrder, cashierCancelOrder, calculatePayment, markServed, startPreparing, completeOrder, updateOrderStatus, getCashierActiveShift, cashierTimeIn, cashierTimeOut } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getElapsedMinutes, playNotificationSound, unlockAudio, updateAppBadge, requestNotificationPermission, showSystemNotification } from '../utils/helpers';
import { useDynamicBranding } from '../hooks/useDynamicBranding';
import { applyTheme, clearTheme } from '../utils/theme';
import { Clock, AlertTriangle, Store, User, CreditCard, Gift, Banknote, Smartphone, CheckCircle, Navigation, Printer, ChefHat, ShoppingBag, Truck, MapPin, LogOut, Tag, Timer, DollarSign, Lock, Unlock, ShieldAlert, Coins, Sparkles } from 'lucide-react';
import CashierMenuPOS from '../components/cashier/CashierMenuPOS';

export default function CashierDashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, confirmed, preparing, ready
  const [viewMode, setViewMode] = useState('orders'); // 'orders' | 'menu'
  const [paymentData, setPaymentData] = useState({ received: '', method: 'cash', discountType: '', discountPercent: '', referenceNumber: '' });
  const [calcResult, setCalcResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer changed mind');
  const [qrStatus, setQrStatus] = useState(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showRefKeypad, setShowRefKeypad] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [showServeModal, setShowServeModal] = useState(false);
  const [prepTime, setPrepTime] = useState(15);
  
  // Shift & Cash Register State
  const [activeShift, setActiveShift] = useState(null);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [showTimeInModal, setShowTimeInModal] = useState(false);
  const [timeInStep, setTimeInStep] = useState('prompt'); // 'prompt' | 'inputCash'
  const [startingCash, setStartingCash] = useState('');
  const [timeInLoading, setTimeInLoading] = useState(false);
  const [showTimeOutModal, setShowTimeOutModal] = useState(false);
  const [endingCash, setEndingCash] = useState('');
  const [timeOutNotes, setTimeOutNotes] = useState('');
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [restrictionModal, setRestrictionModal] = useState(null);

  const handleRestrictedAction = (actionName = 'perform this action') => {
    setRestrictionModal({
      message: `You must Time In before ${actionName}.`
    });
  };

  const { joinRoom, onEvent, connected } = useSocket();
  const { logoutUser, user } = useAuth();

  // Dynamic favicon & title
  useDynamicBranding('Hometown Brew Cashier Dashboard', user?.tenantFavicon || '/favicon.png');

  useEffect(() => {
    if (user?.tenantColor) applyTheme(user.tenantColor);
    return () => clearTheme();
  }, [user?.tenantColor]);

  useEffect(() => {
    loadOrders();
    checkShiftStatus();
    if (user?.tenantId) {
      joinRoom('cashier', user.tenantId);
    }

    // Request system push notification permissions
    requestNotificationPermission();

    // Unlock audio for dashboard notifications
    const unlock = () => {
      unlockAudio();
      setAudioUnlocked(true);
      console.log('Audio unlocked for Cashier Dashboard');
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, [connected, user?.tenantId]);

  useEffect(() => {
    if (!onEvent) return;

    const unsub = onEvent('new_order', (data) => {
      console.log('🔔 new_order event received:', data);
      playNotificationSound('newOrder');

      const displayNum = data.order?.orderNumber?.includes('-') ? data.order.orderNumber.split('-')[1] : data.order?.orderNumber;
      showSystemNotification('New Order Received! 💵', `Order #${displayNum} is waiting for payment/confirmation.`);

      loadOrders(); // Refresh list to show the new order
    });

    const unsub2 = onEvent('order_update', (data) => {
      console.log('🔔 order_update event received:', data);
      loadOrders(); // Refresh list when order status changes
    });

    return () => { unsub(); unsub2(); };
  }, [onEvent]);

  useEffect(() => {
    if (selectedOrder && selectedOrder.status === 'pending') {
      calculateTotals();
    }
  }, [paymentData.received, paymentData.method, paymentData.discountType, paymentData.discountPercent, selectedOrder]);

  const loadOrders = async () => {
    try {
      const res = await getCashierOrders();
      
      // Clear completed/cancelled orders from previous days (midnight reset)
      const today = new Date().setHours(0,0,0,0);
      const filteredOrders = res.data.data.filter(o => {
        if (o.status !== 'completed' && o.status !== 'cancelled') return true;
        return new Date(o.createdAt).setHours(0,0,0,0) === today || new Date(o.updatedAt).setHours(0,0,0,0) === today;
      });

      setOrders(filteredOrders);
      if (selectedOrder) {
        const updated = filteredOrders.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
        else setSelectedOrder(null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Auto-fill amount for online payments
  useEffect(() => {
    if (!selectedOrder) return;

    if (paymentData.method !== 'cash') {
      // For GCash/Maya/Card, assume exact amount
      setPaymentData(p => ({ ...p, received: selectedOrder.total.toString() }));
    } else {
      // When switching back to Cash, clear it so cashier can type actual cash received
      setPaymentData(p => ({ ...p, received: '' }));
      setCalcResult(null);
    }
  }, [paymentData.method, selectedOrder?.id]);

  useEffect(() => {
    if (selectedOrder) {
      setQrStatus(null);
      setPaymentData(p => ({
        ...p,
        method: selectedOrder.paymentMethod,
        received: selectedOrder.paymentStatus === 'paid' ? selectedOrder.total.toString() : ''
      }));
    }
  }, [selectedOrder?.id]);

  // Update native PWA app badge with pending orders count
  useEffect(() => {
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    updateAppBadge(pendingCount);
    return () => {
      updateAppBadge(0);
    };
  }, [orders]);

  const calculateTotals = async () => {
    if (!selectedOrder) return;
    try {
      const hasExistingDiscount = Number(selectedOrder.discountAmount || 0) > 0;
      const effectiveDiscountType = paymentData.discountType || (hasExistingDiscount ? (selectedOrder.discountType || 'promo') : '');
      const effectiveDiscountPercent = paymentData.discountPercent || (
        hasExistingDiscount && selectedOrder.subtotal
          ? ((Number(selectedOrder.discountAmount || 0) / Number(selectedOrder.subtotal || 1)) * 100).toFixed(2)
          : undefined
      );

      const res = await calculatePayment({
        subtotal: selectedOrder.subtotal,
        deliveryFee: selectedOrder.deliveryFee,
        discountType: effectiveDiscountType,
        discountPercent: effectiveDiscountPercent,
        amountReceived: parseFloat(paymentData.received) || 0
      });
      setCalcResult(res.data.data);
    } catch (e) { console.error(e); }
  };

  const checkShiftStatus = async () => {
    try {
      setIsShiftLoading(true);
      const res = await getCashierActiveShift();
      if (res.data?.data) {
        setActiveShift(res.data.data);
        setIsRestricted(false);
        setShowTimeInModal(false);
      } else {
        setActiveShift(null);
        setIsRestricted(true);
        setShowTimeInModal(true);
        setTimeInStep('prompt');
      }
    } catch (err) {
      console.error('Error checking shift status:', err);
      setIsRestricted(true);
    } finally {
      setIsShiftLoading(false);
    }
  };

  const handleOpenTimeIn = () => {
    setTimeInStep('prompt');
    setShowTimeInModal(true);
  };

  const handleProceedToCashInput = () => {
    setTimeInStep('inputCash');
  };

  const handleCancelTimeIn = () => {
    setShowTimeInModal(false);
    setIsRestricted(true);
  };

  const handleConfirmTimeIn = async (e) => {
    if (e) e.preventDefault();
    const amount = parseFloat(startingCash);
    if (isNaN(amount) || amount < 0) {
      return alert('Please enter a valid starting cash amount (₱0 or more).');
    }
    setTimeInLoading(true);
    try {
      const res = await cashierTimeIn({ startingCash: amount });
      setActiveShift(res.data.data);
      setIsRestricted(false);
      setShowTimeInModal(false);
      setStartingCash('');
      setTimeInStep('prompt');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start shift.');
    } finally {
      setTimeInLoading(false);
    }
  };

  const handleOpenTimeOut = async () => {
    try {
      const res = await getCashierActiveShift();
      if (res.data?.data) {
        setActiveShift(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setEndingCash('');
    setTimeOutNotes('');
    setShowTimeOutModal(true);
  };

  const handleConfirmTimeOut = async (e) => {
    if (e) e.preventDefault();
    const amount = parseFloat(endingCash);
    if (isNaN(amount) || amount < 0) {
      return alert('Please enter the money currently counted in the cash register.');
    }
    setTimeOutLoading(true);
    try {
      const res = await cashierTimeOut({ endingCash: amount, notes: timeOutNotes });
      const closed = res.data.data;
      
      setShiftSummary(closed);

      setActiveShift(null);
      setIsRestricted(true);
      setShowTimeOutModal(false);
      setEndingCash('');
      setTimeOutNotes('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close shift.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('processing payments');
      return;
    }
    if (!selectedOrder) return;
    if (!calcResult) {
       await calculateTotals(); // Try calculating again 
       return;
    }
    if (!paymentData.received) return;
    if (calcResult.isInsufficient) return;

    // Enforce reference number for online payments (except for delivery orders where customer provides it)
    if ((paymentData.method === 'gcash' || paymentData.method === 'maya') && selectedOrder.orderType !== 'delivery' && !paymentData.referenceNumber) {
      return;
    }

    setProcessing(true);
    try {
      const hasExistingDiscount = Number(selectedOrder.discountAmount || 0) > 0;
      const effectiveDiscountType = paymentData.discountType || (hasExistingDiscount ? (selectedOrder.discountType || 'promo') : undefined);
      const effectiveDiscountPercent = paymentData.discountPercent || (
        hasExistingDiscount && selectedOrder.subtotal
          ? ((Number(selectedOrder.discountAmount || 0) / Number(selectedOrder.subtotal || 1)) * 100).toFixed(2)
          : undefined
      );

      await confirmOrder(selectedOrder.id, {
        amountReceived: parseFloat(paymentData.received) || calcResult.total,
        paymentMethod: paymentData.method,
        discountType: effectiveDiscountType,
        discountPercent: effectiveDiscountPercent ? parseFloat(effectiveDiscountPercent) : undefined,
        referenceNumber: paymentData.referenceNumber || undefined
      });
      setSelectedOrder(null);
      setPaymentData({ received: '', method: 'cash', discountType: '', discountPercent: '', referenceNumber: '' });
      setCalcResult(null);
      loadOrders();
    } catch (e) {
      console.error('Failed to confirm order:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleServeOrder = async () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('completing or serving orders');
      return;
    }
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      await markServed(selectedOrder.id);
      setShowServeModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      console.error('Failed to mark order as served:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleStartPreparing = () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('updating kitchen orders');
      return;
    }
    setPrepTime(15); // reset default
    setShowPrepModal(true);
  };

  const handleConfirmPrep = async (minutes) => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('updating kitchen orders');
      return;
    }
    if (!selectedOrder) return;
    const time = parseInt(minutes) || 15;
    setProcessing(true);
    try {
      await startPreparing(selectedOrder.id, time);
      setShowPrepModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      console.error('Failed to start preparing:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('completing orders');
      return;
    }
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      await completeOrder(selectedOrder.id);
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      console.error('Failed to mark order as ready:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatchOrder = async () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('dispatching delivery orders');
      return;
    }
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      await updateOrderStatus(selectedOrder.id, 'on_the_way');
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      console.error('Failed to dispatch order:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isRestricted || !activeShift) {
      handleRestrictedAction('managing or cancelling orders');
      return;
    }
    if (!selectedOrder) return;
    setCancelReason('Customer changed mind');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    setProcessing(true);
    try {
      const orderId = selectedOrder.id;
      // Clear panel immediately for better UX
      setSelectedOrder(null);
      setShowCancelModal(false);
      setPaymentData({ method: 'cash', received: '', discountType: '', discountAmount: 0, referenceNumber: '' });
      setCalcResult(null);

      await cashierCancelOrder(orderId, { reason: cancelReason });
      loadOrders();
    } catch (e) {
      alert('Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  // Quick cash buttons
  const addCash = (amount) => {
    const current = parseFloat(paymentData.received) || 0;
    setPaymentData(p => ({ ...p, received: (current + amount).toString() }));
  };
  const exactCash = () => {
    if (calcResult) setPaymentData(p => ({ ...p, received: calcResult.total.toString() }));
  };

  const filteredOrders = orders.filter(o => o.status === activeTab);

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col bg-surface-100 overflow-hidden relative">

      {/* Prep Time Modal */}
      {showPrepModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
            <div className="bg-amber-50 p-6 sm:p-8 border-b border-amber-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><Clock className="w-6 h-6" /></div>
              <div>
                <h3 className="font-heading font-black text-xl text-slate-900">Set Prep Time Estimate</h3>
                <p className="text-amber-700 text-xs font-semibold">How long will this order take?</p>
              </div>
            </div>
            
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20, 30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setPrepTime(mins);
                      handleConfirmPrep(mins);
                    }}
                    className={`py-3.5 px-2 rounded-2xl text-base font-black border transition-all hover:scale-[1.02] active:scale-[0.98] ${prepTime === mins ? 'bg-amber-500 border-transparent text-white shadow-lg shadow-amber-500/20' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              
              <div className="border-t border-slate-100 pt-5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Custom Wait Time (Minutes)</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={prepTime}
                      onChange={e => setPrepTime(e.target.value)}
                      placeholder="e.g. 25"
                      className="input-field w-full py-3.5 px-4 text-base font-black font-heading pr-12"
                      min="1"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">mins</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleConfirmPrep(prepTime)}
                    disabled={processing || !prepTime}
                    className="px-6 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPrepModal(false)}
                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
              <div>
                <h3 className="font-heading font-bold text-xl text-red-900">Cancel Order</h3>
                <p className="text-red-600 text-sm">This action cannot be undone.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-2">Reason for cancellation:</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Out of stock, customer changed mind..."
                  className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder-surface-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none h-32"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {['Out of stock', 'Customer changed mind', 'Wrong order', 'Payment failed'].map(r => (
                  <button
                    key={r}
                    onClick={() => setCancelReason(r)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${cancelReason === r ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3.5 bg-white border border-surface-200 text-surface-700 font-bold rounded-2xl hover:bg-surface-100 transition-all"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || processing}
                className="flex-[1.5] py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {processing ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-In Modal */}
      {showTimeInModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
            {timeInStep === 'prompt' ? (
              <>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white text-center relative overflow-hidden">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Timer className="w-9 h-9 text-white" />
                  </div>
                  <h3 className="font-heading font-black text-2xl tracking-tight mb-1">Start Cashier Shift</h3>
                  <p className="text-white/90 text-xs font-semibold">You are about to time in to begin your shift</p>
                </div>

                <div className="p-6 sm:p-8 space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed font-medium">
                      Timing in records your attendance and opens the cash register drawer. If you choose <strong>Cancel</strong>, the dashboard will operate in <strong>Read-Only mode</strong> (order actions and payments remain restricted until you time in).
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={handleProceedToCashInput}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                    >
                      <Timer className="w-5 h-5" />
                      <span>Time In</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleCancelTimeIn}
                      className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold rounded-2xl transition-all text-xs uppercase tracking-widest"
                    >
                      Cancel (Read-Only Mode)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-7 text-white text-center relative overflow-hidden">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Coins className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-heading font-black text-xl tracking-tight mb-1">Cash Register Float</h3>
                  <p className="text-white/90 text-xs font-semibold">How much money is in the cash register?</p>
                </div>

                <form onSubmit={handleConfirmTimeIn} className="p-6 sm:p-8 space-y-5">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Starting Cash Amount (₱)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₱</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={startingCash}
                        onChange={(e) => setStartingCash(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        required
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-2xl font-black font-mono text-slate-900 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Quick Select Starting Float
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 500, 1000, 2000, 3000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setStartingCash(amt.toString())}
                          className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                            startingCash === amt.toString()
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ₱{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="submit"
                      disabled={timeInLoading || startingCash === ''}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                    >
                      {timeInLoading ? 'Recording Time In...' : 'Confirm & Start Shift'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setTimeInStep('prompt')}
                      disabled={timeInLoading}
                      className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                      ← Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {shiftSummary && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-scale-in">
            <div className="bg-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-black text-2xl tracking-tight">Shift Completed!</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Time In</span>
                  <span className="font-bold text-slate-800">{formatDate(shiftSummary.startTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Time Out</span>
                  <span className="font-bold text-slate-800">{formatDate(shiftSummary.endTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Starting Cash Float</span>
                  <span className="font-bold text-slate-800">{formatCurrency(shiftSummary.startingCash)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Shift Cash Sales</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(shiftSummary.cashSales)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Shift Online (GCash/Maya)</span>
                  <span className="font-bold text-blue-600">{formatCurrency(shiftSummary.onlineSales || 0)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Total Shift Sales</span>
                  <span className="font-black text-slate-900">{formatCurrency(shiftSummary.totalSales || 0)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Expected Register Cash</span>
                  <span className="font-bold text-slate-800">{formatCurrency(shiftSummary.expectedCash)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Counted Ending Cash</span>
                  <span className="font-bold text-slate-800">{formatCurrency(shiftSummary.endingCash)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="font-black text-slate-700">Cash Variance</span>
                  <span className={`font-black ${shiftSummary.cashDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {shiftSummary.cashDifference >= 0 ? '+' : ''}{formatCurrency(shiftSummary.cashDifference)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShiftSummary(null);
                  setShowTimeInModal(true);
                  setTimeInStep('prompt');
                }}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition-all"
              >
                Okay, Got it
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Time-Out Modal */}
      {showTimeOutModal && activeShift && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
            <div className="bg-gradient-to-br from-rose-600 to-pink-700 p-7 text-white text-center relative overflow-hidden">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Timer className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-heading font-black text-xl tracking-tight mb-1">Time Out & End Shift</h3>
              <p className="text-white/90 text-xs font-semibold">Count register and record ending cash drawer float</p>
            </div>

            <form onSubmit={handleConfirmTimeOut} className="p-6 sm:p-8 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Shift Started:</span>
                  <span className="font-bold text-slate-900">{formatDate(activeShift.startTime)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Opening Float:</span>
                  <span className="font-bold font-mono text-slate-900">{formatCurrency(activeShift.startingCash)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Sales (Shift):</span>
                  <span className="font-bold font-mono text-emerald-600">+{formatCurrency(activeShift.liveStats?.cashSales || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Online Sales (GCash/Maya):</span>
                  <span className="font-bold font-mono text-blue-600">+{formatCurrency(activeShift.liveStats?.onlineSales || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Sales (Shift):</span>
                  <span className="font-bold font-mono text-slate-900">{formatCurrency(activeShift.liveStats?.totalSales || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-800 pt-2 border-t border-slate-200 font-bold">
                  <span>Expected Cash in Drawer:</span>
                  <span className="font-mono text-primary-600 text-sm">{formatCurrency(activeShift.liveStats?.expectedCash || activeShift.startingCash)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Counted Ending Cash in Register (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₱</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={endingCash}
                    onChange={(e) => setEndingCash(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-200 focus:border-rose-500 focus:bg-white rounded-2xl text-2xl font-black font-mono text-slate-900 transition-all outline-none"
                  />
                </div>
                {endingCash !== '' && !isNaN(parseFloat(endingCash)) && (
                  <div className="mt-2 text-xs font-bold flex justify-between px-1">
                    <span className="text-slate-500">Variance:</span>
                    <span className={parseFloat(endingCash) - (activeShift.liveStats?.expectedCash || activeShift.startingCash) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {parseFloat(endingCash) - (activeShift.liveStats?.expectedCash || activeShift.startingCash) >= 0 ? '+' : ''}
                      {formatCurrency(parseFloat(endingCash) - (activeShift.liveStats?.expectedCash || activeShift.startingCash))}
                      {parseFloat(endingCash) - (activeShift.liveStats?.expectedCash || activeShift.startingCash) === 0 ? ' (Exact)' : parseFloat(endingCash) - (activeShift.liveStats?.expectedCash || activeShift.startingCash) > 0 ? ' (Surplus)' : ' (Shortage)'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Shift Notes (Optional)
                </label>
                <textarea
                  value={timeOutNotes}
                  onChange={(e) => setTimeOutNotes(e.target.value)}
                  placeholder="e.g. Cash dropped to safe, reason for discrepancy..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={timeOutLoading || endingCash === ''}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-rose-600/25 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  {timeOutLoading ? 'Closing Shift...' : 'Confirm Time Out & End Shift'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowTimeOutModal(false)}
                  disabled={timeOutLoading}
                  className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Cancel / Stay on Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-surface-200 px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between flex-shrink-0 z-10 no-print gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <img src="/hb_logo.jpg" className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0" alt="Hometown Brew" onError={(e) => { e.currentTarget.src = '/favicon.png'; }} />
          <div className="flex flex-col">
            <h2 className="font-heading font-black text-sm sm:text-base lg:text-lg text-primary-600 tracking-tight uppercase leading-tight whitespace-nowrap">Hometown Brew</h2>
            <span className="text-[9px] sm:text-[10px] font-bold text-surface-400 uppercase tracking-widest leading-none">Cashier Dashboard</span>
          </div>
        </div>

        {/* Mode Toggle: Orders vs Show Menu (Desktop / Tablet) */}
        <div className="hidden md:flex items-center p-1 bg-surface-100 rounded-2xl border border-surface-200 shadow-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('orders')}
            className={`px-3 lg:px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              viewMode === 'orders'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-primary-600" />
            <span>Orders</span>
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 bg-primary-500 text-white rounded-full text-[10px] font-black animate-pulse">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewMode('menu')}
            className={`px-3 lg:px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              viewMode === 'menu'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Show Menu</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          {activeShift ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-emerald-800">Shift Active</span>
              <span className="text-emerald-600 font-medium font-mono text-[11px]">₱{Number(activeShift.startingCash || 0).toLocaleString()}</span>
            </div>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
              <Lock className="w-3 h-3" /> Not Timed In
            </span>
          )}

          {activeShift ? (
            <button
              onClick={handleOpenTimeOut}
              className="px-2.5 sm:px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-95 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <Timer className="w-3.5 h-3.5 text-rose-600" />
              <span>Time Out</span>
            </button>
          ) : (
            <button
              onClick={handleOpenTimeIn}
              className="px-2.5 sm:px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20 whitespace-nowrap"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Time In</span>
            </button>
          )}

          <span className="text-xs font-semibold text-surface-600 hidden lg:flex items-center gap-1"><User className="w-3.5 h-3.5" /> {user?.name}</span>
          <button onClick={logoutUser} title="Logout" className="text-surface-400 hover:text-red-500 text-xs font-medium transition-colors p-1"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      {/* MOBILE-ONLY DEDICATED VIEW SWITCHER (Always visible and easily tap-able on mobile phones) */}
      <div className="md:hidden bg-surface-900 px-3 py-2 flex items-center gap-2 shadow-md z-20 flex-shrink-0 no-print">
        <button
          type="button"
          onClick={() => setViewMode('orders')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'orders'
              ? 'bg-white text-surface-900 shadow-md scale-[1.01]'
              : 'bg-surface-800 text-surface-300 hover:text-white'
          }`}
        >
          <Store className="w-4 h-4 text-primary-600" />
          <span>Orders</span>
          {orders.filter(o => o.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 bg-primary-500 text-white rounded-full text-[10px] font-black animate-pulse">
              {orders.filter(o => o.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setViewMode('menu')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'menu'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25 scale-[1.01]'
              : 'bg-surface-800 text-surface-300 hover:text-white'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Show Menu</span>
        </button>
      </div>

      {/* Restricted Mode Alert Banner */}
      {isRestricted && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 animate-fade-in no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black tracking-wide uppercase">Restricted Read-Only Mode</p>
              <p className="text-[11px] sm:text-xs text-white/90 font-medium">You are not timed in. Order taking and cash register actions are locked until you time in.</p>
            </div>
          </div>
          <button
            onClick={handleOpenTimeIn}
            className="px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
          >
            <Timer className="w-4 h-4" /> Time In Now
          </button>
        </div>
      )}

      {viewMode === 'menu' ? (
        <CashierMenuPOS
          onBackToOrders={() => setViewMode('orders')}
          activeOrdersCount={orders.filter(o => o.status === 'pending').length}
          cashierName={user?.name || 'Cashier'}
          isRestricted={isRestricted}
          onRestrictedAction={handleRestrictedAction}
          onOrderCreated={loadOrders}
        />
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Order List */}
        <div className={`${selectedOrder ? 'hidden md:flex' : 'flex'} md:w-1/2 flex-col border-r border-surface-200 bg-surface-50 flex-1 md:flex-none min-w-0 no-print`}>
          <div className="p-2 sm:p-4 border-b border-surface-200 flex gap-1.5 sm:gap-2 overflow-x-auto bg-white flex-shrink-0 scrollbar-hide">
            {['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'completed'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-all ${activeTab === tab ? 'bg-primary-500 text-white shadow-md' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                {tab === 'on_the_way' ? 'Delivering' : tab}
                <span className={`ml-1.5 sm:ml-2 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] sm:text-xs ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-surface-200 text-surface-500'}`}>
                  {orders.filter(o => o.status === tab).length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-surface-400 font-medium text-sm">No {activeTab === 'on_the_way' ? 'delivering' : activeTab} orders</div>
            ) : (
              filteredOrders.map((order, idx) => (
                <button key={order.id} onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className={`w-full text-left glass-card p-3 sm:p-4 transition-all animate-fade-in-up hover:-translate-y-1 ${selectedOrder?.id === order.id ? 'border-primary-500 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/50' : ''}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-heading font-bold text-base sm:text-lg text-surface-900">{order.orderNumber}</h3>
                      <p className="text-xs sm:text-sm text-surface-500">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`badge text-[10px] sm:text-xs mb-1 ${order.orderType === 'dine_in' ? 'bg-emerald-100 text-emerald-700' : order.orderType === 'delivery' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.orderType === 'dine_in' ? 'Dine In' : order.orderType === 'delivery' ? (order.status === 'on_the_way' ? 'Out for Delivery' : 'Delivery') : 'Take Out'}
                      </span>
                      {order.paymentMethod === 'points' && (
                        <span className="badge text-[10px] sm:text-xs bg-purple-100 text-purple-700 ml-1 inline-flex items-center gap-1"><Gift className="w-3 h-3" /> Reward</span>
                      )}
                      <p className="text-[10px] sm:text-xs text-surface-400">{getElapsedMinutes(order.createdAt)} min ago</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-surface-100">
                    <span className="text-xs sm:text-sm font-medium text-surface-600">{order.items?.length || 0} items</span>
                    <span className="font-heading font-bold text-primary-600 text-sm sm:text-base inline-flex items-center gap-1.5">
                      {order.paymentMethod === 'points' ? <><Gift className="w-4 h-4" /> FREE</> : formatCurrency(order.total)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Order Details & Cash Register */}
        <div className={`${selectedOrder ? 'flex' : 'hidden md:flex'} md:w-1/2 flex-col bg-white overflow-hidden relative flex-1 md:flex-none`}>
          {/* Mobile back button */}
          {selectedOrder && (
            <button onClick={() => setSelectedOrder(null)} className="no-print md:hidden flex items-center gap-2 px-4 py-3 text-sm font-bold text-surface-600 border-b border-surface-200 bg-surface-50">
              <span className="text-lg">←</span> Back to Orders
            </button>
          )}
          {!selectedOrder ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-400 no-print">
              <div className="mb-4"><CreditCard className="w-16 h-16 text-surface-300" /></div>
              <p className="font-medium">Select an order to view details</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden animate-slide-in">
              {/* Order Header */}
              <div className="p-6 border-b border-surface-200 bg-surface-50 flex-shrink-0 flex justify-between items-start no-print">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-surface-900 mb-1">{selectedOrder.orderNumber}</h2>
                  <p className="text-surface-500">{selectedOrder.customerName} • {formatDate(selectedOrder.createdAt)}</p>
                </div>
                <span className={`badge text-sm px-3 py-1 badge-${selectedOrder.status}`}>{selectedOrder.status.toUpperCase()}</span>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto flex flex-col no-print">
                {/* Delivery Info Banner */}
                {selectedOrder.orderType === 'delivery' && (
                  <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col gap-3 flex-shrink-0 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5 text-blue-600" /></div>
                      <div>
                        <p className="font-bold text-blue-700 text-sm">Delivery Order</p>
                        <p className="text-xs text-blue-500 font-medium">{selectedOrder.deliveryAddress || 'No address provided'}</p>
                      </div>
                    </div>
                    {selectedOrder.deliveryLat && selectedOrder.deliveryLng && (
                      <a 
                        href={`https://www.google.com/maps?q=${selectedOrder.deliveryLat},${selectedOrder.deliveryLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-100 transition-all shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5" /> View on Google Maps
                      </a>
                    )}
                  </div>
                )}

                {/* Payment Reference Banner */}
                {selectedOrder.paymentReference && (
                  <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between flex-shrink-0 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-2">
                       <Smartphone className="w-4 h-4 text-blue-600" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Customer Payment Ref</span>
                    </div>
                    <span className="text-sm font-mono font-black text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200">{selectedOrder.paymentReference}</span>
                  </div>
                )}
                {/* Promo detection (notes may include "(Promo: CODE)") */}
                {(() => {
                  const notes = selectedOrder.notes || '';
                  const promoMatch = notes.match(/\(Promo:\s*([^\)]+)\)/i);
                  const promoOnly = notes.trim().match(/^\(Promo:\s*[^\)]+\)\s*$/i);
                  return (
                    <>
                      {/* Promo Code Banner (separate from global notes) */}
                      {promoMatch && (
                        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between flex-shrink-0 animate-fade-in shadow-sm">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Promo Code</span>
                          </div>
                          <span className="text-sm font-mono font-black text-emerald-800 bg-white px-3 py-1 rounded-lg border border-emerald-200">{promoMatch[1].trim()}</span>
                        </div>
                      )}

                      {/* Only show global order note when it's not just a promo marker */}
                      {!promoOnly && selectedOrder.notes && (
                        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 flex-shrink-0 animate-fade-in shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 leading-none mb-1">Global Order Note</p>
                            <p className="text-sm font-medium text-amber-900">{selectedOrder.notes}</p>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Points Redemption Banner */}
                {selectedOrder.paymentMethod === 'points' && (
                  <div className="mx-6 mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3 flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0"><Gift className="w-5 h-5 text-purple-600" /></div>
                    <div>
                      <p className="font-bold text-purple-700 text-sm">Points Redemption Order</p>
                      <p className="text-xs text-purple-500">This order was claimed using loyalty points — no cash payment needed.</p>
                    </div>
                  </div>
                )}

                {/* Order Items Area */}
                <div className="p-6 border-b border-surface-200 bg-white flex-shrink-0">
                  <h3 className="font-semibold text-surface-700 mb-4">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items?.map(item => (
                      <div key={item.id} className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-surface-900"><span className="text-surface-500 mr-2">{item.quantity}×</span>{item.productName}</p>
                          {item.size && <p className="text-xs font-bold text-surface-600 ml-6">{item.size}</p>}
                          {item.addons && <p className="text-xs text-surface-500 ml-6">+ {JSON.parse(item.addons).map(a => a.name).join(', ')}</p>}
                          {item.comboChoices && (
                            <p className="text-xs text-primary-500 ml-6 font-semibold">
                              + {(() => {
                                try {
                                  const choices = JSON.parse(item.comboChoices);
                                  return Object.values(choices).filter(Boolean).map(c => c.name).join(' + ');
                                } catch (e) { return ''; }
                              })()}
                            </p>
                          )}
                          {item.notes && <p className="text-xs text-amber-600 ml-6 italic">Note: {item.notes}</p>}
                        </div>
                        <span className="font-medium text-surface-900">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cash Register / Payment Section */}
                <div className="p-6 bg-surface-50 flex-1">
                  {selectedOrder.status === 'pending' ? (
                    <div className="space-y-4">
                      {/* Payment Calculator */}
                      {calcResult && (
                        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm space-y-2">
                          <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(calcResult.subtotal)}</span></div>
                          {selectedOrder.deliveryFee > 0 && <div className="flex justify-between text-sm text-surface-500"><span>Delivery Fee</span><span>{formatCurrency(selectedOrder.deliveryFee)}</span></div>}
                          {calcResult.discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Discount{selectedOrder.notes && (selectedOrder.notes.match(/\(Promo:\s*([^\)]+)\)/i) ? ` (${selectedOrder.notes.match(/\(Promo:\s*([^\)]+)\)/i)[1].trim()})` : '')}</span><span>-{formatCurrency(calcResult.discountAmount)}</span></div>}
                          {calcResult.taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-surface-500">Tax ({calcResult.taxRate}%)</span><span>{formatCurrency(calcResult.taxAmount)}</span></div>}
                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-surface-100">
                            <span className="font-bold text-surface-900">Total Due</span>
                            <span className="font-heading text-2xl font-black text-primary-600">{formatCurrency(calcResult.total)}</span>
                          </div>

                          <div className="pt-4 border-t border-surface-200 mt-4">
                            <div className="flex justify-between items-end mb-2">
                              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">Amount Received</label>
                              <button onClick={exactCash} className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Exact Amount</button>
                            </div>

                            {/* Display Screen (Clickable to toggle keypad) */}
                            <button
                              type="button"
                              onClick={() => setShowKeypad(!showKeypad)}
                              className={`w-full p-4 mb-4 rounded-2xl border-2 flex items-center justify-between shadow-inner transition-all hover:scale-[1.01] active:scale-[0.99] focus:outline-none ${calcResult.isInsufficient && paymentData.received
                                ? 'bg-red-50 border-red-300 text-red-600'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                }`}
                            >
                              <span className="text-xl font-bold opacity-50">₱</span>
                              <span className="text-4xl font-heading font-black tracking-tighter">
                                {(() => {
                                  if (!paymentData.received) return '0.00';
                                  const parts = paymentData.received.split('.');
                                  const formattedInt = parseFloat(parts[0] || '0').toLocaleString('en-US');
                                  return parts.length > 1 ? `${formattedInt}.${parts[1]}` : `${formattedInt}.00`;
                                })()}
                              </span>
                            </button>

                            {/* Numeric Keypad (Collapsible) */}
                            {showKeypad && (
                              <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                  <button key={num} onClick={() => setPaymentData(p => ({ ...p, received: p.received === '0' ? num.toString() : p.received + num }))} className="py-4 bg-white border border-surface-200 hover:bg-surface-50 active:bg-surface-100 rounded-2xl text-2xl font-black text-surface-800 transition-all shadow-sm active:scale-95">
                                    {num}
                                  </button>
                                ))}
                                <button onClick={() => {
                                  if (!paymentData.received.includes('.')) {
                                    setPaymentData(p => ({ ...p, received: p.received ? p.received + '.' : '0.' }));
                                  }
                                }} className="py-4 bg-surface-100 border border-surface-200 hover:bg-surface-200 rounded-2xl text-2xl font-black text-surface-800 transition-all shadow-sm active:scale-95">
                                  .
                                </button>
                                <button onClick={() => setPaymentData(p => ({ ...p, received: p.received === '0' ? '0' : p.received + '0' }))} className="py-4 bg-white border border-surface-200 hover:bg-surface-50 active:bg-surface-100 rounded-2xl text-2xl font-black text-surface-800 transition-all shadow-sm active:scale-95">
                                  0
                                </button>
                                <button onClick={() => setPaymentData(p => ({ ...p, received: p.received.slice(0, -1) }))} className="py-4 bg-surface-200 border border-surface-300 hover:bg-surface-300 rounded-2xl text-2xl font-black text-surface-900 transition-all shadow-sm flex items-center justify-center active:scale-95">
                                  ⌫
                                </button>
                                <button
                                  onClick={() => setPaymentData(p => ({ ...p, received: '' }))}
                                  className="col-span-3 py-3 mt-1 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest text-xs shadow-sm transition-all active:scale-[0.98]"
                                >
                                  Clear Amount
                                </button>
                              </div>
                            )}

                            <div className={`flex justify-between items-center mt-4 p-4 rounded-2xl shadow-sm border ${calcResult.isInsufficient && paymentData.received ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                              <span className="font-bold text-sm uppercase tracking-wider">{calcResult.isInsufficient ? 'Insufficient' : 'Change Due'}</span>
                              <span className="font-heading text-2xl font-black">{calcResult.isInsufficient ? '-' : formatCurrency(calcResult.change)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment controls — simplified for points redemption */}
                      {selectedOrder.paymentMethod === 'points' ? (
                        <div className="flex gap-3 pt-2">
                          <button onClick={handleCancel} disabled={processing} className="btn-danger flex-1 py-4">Cancel Order</button>
                          <button
                            onClick={() => {
                              setPaymentData(p => ({ ...p, received: '0', method: 'points' }));
                              setTimeout(() => handleConfirmPayment(), 100);
                            }}
                            disabled={processing}
                            className="flex-[2] py-4 shadow-xl font-bold transition-all btn-primary bg-purple-600 hover:bg-purple-700 inline-flex items-center justify-center gap-2"
                          >
                            {processing ? 'Processing...' : <><Gift className="w-5 h-5" /> Confirm Reward Claim</>}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Payment Method</label>
                            <div className="grid grid-cols-3 gap-3">
                              <button
                                type="button"
                                onClick={() => setPaymentData(p => ({ ...p, method: 'cash' }))}
                                className={`py-3 px-4 rounded-2xl border-2 font-black transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 ${paymentData.method === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                              >
                                <Banknote className="w-8 h-8 mb-1" />
                                <span className="text-xs uppercase tracking-wider font-bold">Cash</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentData(p => ({ ...p, method: 'gcash' }))}
                                className={`py-3 px-4 rounded-2xl border-2 font-black transition-all flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 min-h-[76px] ${paymentData.method === 'gcash' ? 'border-blue-500 bg-blue-50/50 shadow-inner scale-[1.02]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                              >
                                <img src="/logos/GCash-Logo.png" alt="GCash" className="h-8 object-contain" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentData(p => ({ ...p, method: 'maya' }))}
                                className={`py-3 px-4 rounded-2xl border-2 font-black transition-all flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 min-h-[76px] ${paymentData.method === 'maya' ? 'border-emerald-500 bg-emerald-50/50 shadow-inner scale-[1.02]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                              >
                                <img src="/logos/maya-logo.jpg" alt="Maya" className="h-8 object-contain rounded-xl" />
                              </button>
                            </div>

                            <div className="flex gap-3 pt-1">
                              <div className="w-full">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Discount Type</label>
                                <select value={paymentData.discountType} onChange={e => setPaymentData(p => ({ ...p, discountType: e.target.value }))} className="input-field py-3.5 bg-white w-full text-sm font-semibold cursor-pointer">
                                  <option value="">No Discount</option>
                                  <option value="senior">Senior Citizen (20%)</option>
                                  <option value="pwd">PWD (20%)</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {(paymentData.method === 'gcash' || paymentData.method === 'maya') && selectedOrder.orderType !== 'delivery' && (
                            <div className="animate-fade-in space-y-4 mt-2">
                              <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-3 text-center">
                                  Enter {paymentData.method.toUpperCase()} Ref No.
                                </label>

                                {/* Display Screen (Clickable) */}
                                <button
                                  onClick={() => setShowRefKeypad(!showRefKeypad)}
                                  className="w-full flex justify-center gap-3 mb-2 focus:outline-none transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                  type="button"
                                >
                                  {[0, 1, 2, 3].map(i => (
                                    <div key={i} className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-mono font-black transition-all duration-200 ${paymentData.referenceNumber[i]
                                      ? 'bg-blue-50 text-blue-700 border-2 border-blue-500 shadow-sm scale-105'
                                      : 'bg-surface-100 text-surface-300 border-2 border-transparent'
                                      }`}>
                                      {paymentData.referenceNumber[i] || '•'}
                                    </div>
                                  ))}
                                </button>


                                {/* Keypad (Collapsible) */}
                                {showRefKeypad && (
                                  <div className="grid grid-cols-3 gap-2 px-2 sm:px-6 pt-3 border-t border-surface-100 animate-fade-in-up">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                      <button
                                        key={num}
                                        type="button"
                                        onClick={() => setPaymentData(p => ({ ...p, referenceNumber: (p.referenceNumber + num).slice(0, 4) }))}
                                        className="py-3 sm:py-4 bg-surface-50 hover:bg-surface-100 active:bg-surface-200 active:scale-95 rounded-xl text-xl font-bold text-surface-700 transition-all shadow-sm border border-surface-200/60"
                                      >
                                        {num}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setPaymentData(p => ({ ...p, referenceNumber: '' }))}
                                      className="py-3 sm:py-4 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-95 rounded-xl text-xs font-black text-red-600 transition-all shadow-sm border border-red-100 uppercase tracking-wider"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentData(p => ({ ...p, referenceNumber: (p.referenceNumber + '0').slice(0, 4) }))}
                                      className="py-3 sm:py-4 bg-surface-50 hover:bg-surface-100 active:bg-surface-200 active:scale-95 rounded-xl text-xl font-bold text-surface-700 transition-all shadow-sm border border-surface-200/60"
                                    >
                                      0
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentData(p => ({ ...p, referenceNumber: p.referenceNumber.slice(0, -1) }))}
                                      className="py-3 sm:py-4 bg-surface-200 hover:bg-surface-300 active:bg-surface-400 active:scale-95 rounded-xl text-xl font-bold text-surface-800 transition-all shadow-sm border border-surface-300"
                                    >
                                      ⌫
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      setQrStatus('sending');
                                      await (await import('../services/api')).requestPayment(selectedOrder.id, { method: paymentData.method });
                                      setQrStatus('sent');
                                      setTimeout(() => setQrStatus(null), 3500);
                                    } catch (e) {
                                      setQrStatus('error');
                                      setTimeout(() => setQrStatus(null), 3500);
                                    }
                                  }}
                                  disabled={qrStatus === 'sending' || qrStatus === 'sent'}
                                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 border ${qrStatus === 'sent'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner'
                                    : qrStatus === 'error'
                                      ? 'bg-red-50 text-red-600 border-red-200'
                                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                                >
                                  {qrStatus === 'sending' ? (
                                    <>
                                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                      Sending to Kiosk...
                                    </>
                                  ) : qrStatus === 'sent' ? (
                                    <>
                                      <span className="text-emerald-500 text-lg drop-shadow-sm flex items-center"><CheckCircle className="w-5 h-5 mr-1" /></span> {paymentData.method.toUpperCase()} QR Sent to Kiosk!
                                    </>
                                  ) : qrStatus === 'error' ? (
                                    <>
                                      <span className="text-red-500 text-lg flex items-center"><AlertTriangle className="w-5 h-5 mr-1" /></span> Failed to Send
                                    </>
                                  ) : (
                                    <><Smartphone className="w-5 h-5 mr-1" /> Send {paymentData.method.toUpperCase()} QR to Kiosk</>
                                  )}
                                </button>
                                {qrStatus === 'sent' && (
                                  <p className="text-xs text-center text-emerald-600 font-semibold animate-fade-in-up">
                                    Customer is now viewing the QR code.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3 pt-2">
                            <button onClick={handleCancel} disabled={processing} className="btn-danger flex-1 py-4">Cancel Order</button>
                            <button
                              onClick={handleConfirmPayment}
                              disabled={
                                processing || 
                                !paymentData.received || 
                                !calcResult ||
                                calcResult?.isInsufficient || 
                                ((paymentData.method === 'gcash' || paymentData.method === 'maya') && selectedOrder.orderType !== 'delivery' && paymentData.referenceNumber.length < 4)
                              }
                              className={`flex-[2] py-4 shadow-xl font-bold transition-all ${
                                (processing || !paymentData.received || !calcResult || calcResult?.isInsufficient || ((paymentData.method === 'gcash' || paymentData.method === 'maya') && selectedOrder.orderType !== 'delivery' && paymentData.referenceNumber.length < 4)) 
                                ? 'bg-surface-300 text-surface-500 cursor-not-allowed opacity-50' 
                                : 'btn-primary'
                              }`}
                            >
                            {processing 
                                ? 'Processing...' 
                                : !paymentData.received 
                                  ? 'Enter Amount' 
                                  : calcResult?.isInsufficient 
                                    ? 'Insufficient' 
                                    : (paymentData.method === 'gcash' || paymentData.method === 'maya') && selectedOrder.orderType !== 'delivery' && paymentData.referenceNumber.length < 4
                                      ? 'Enter Ref ID'
                                      : 'Confirm Payment'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm">
                      <h3 className="font-bold text-surface-900 mb-4 text-center">Payment Summary</h3>
                      <div className="space-y-2 text-sm mb-6">
                        <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span></div>
                        {selectedOrder.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount ({selectedOrder.discountType})</span><span>-{formatCurrency(selectedOrder.discountAmount)}</span></div>}
                        {selectedOrder.taxAmount > 0 && <div className="flex justify-between"><span className="text-surface-500">Tax</span><span className="font-medium">{formatCurrency(selectedOrder.taxAmount)}</span></div>}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-surface-100"><span>Total</span><span className="text-primary-600">{formatCurrency(selectedOrder.total)}</span></div>
                        <div className="flex justify-between pt-2"><span className="text-surface-500">Method</span><span className="font-medium uppercase">{selectedOrder.paymentMethod}</span></div>
                      </div>

                      {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                        <div className="space-y-3 mb-3">
                          {selectedOrder.status === 'confirmed' && (
                            <button 
                              onClick={handleStartPreparing} 
                              disabled={processing} 
                              className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
                            >
                              {processing ? 'Processing...' : (
                                <>
                                  <ChefHat className="w-5 h-5" />
                                  <span>START PREPARING</span>
                                </>
                              )}
                            </button>
                          )}
                          {selectedOrder.status === 'preparing' && (
                            <button 
                              onClick={handleCompleteOrder} 
                              disabled={processing} 
                              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
                            >
                              {processing ? 'Processing...' : (
                                <>
                                  <CheckCircle className="w-5 h-5" />
                                  <span>MARK AS READY</span>
                                </>
                              )}
                            </button>
                          )}
                          {selectedOrder.status === 'ready' && (
                            <>
                              {selectedOrder.orderType === 'delivery' ? (
                                <button 
                                  onClick={handleDispatchOrder} 
                                  disabled={processing} 
                                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
                                >
                                  {processing ? 'Processing...' : (
                                    <>
                                      <Truck className="w-5 h-5" />
                                      <span>OUT FOR DELIVERY</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setShowServeModal(true)} 
                                  disabled={processing} 
                                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
                                >
                                  {processing ? 'Processing...' : (
                                    <>
                                      <ShoppingBag className="w-5 h-5" />
                                      <span>MARK AS SERVED</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                          {selectedOrder.status === 'on_the_way' && (
                            <button 
                              onClick={() => setShowServeModal(true)} 
                              disabled={processing} 
                              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 animate-bounce-in"
                            >
                              {processing ? 'Processing...' : (
                                <>
                                  <CheckCircle className="w-5 h-5" />
                                  <span>MARK AS DELIVERED</span>
                                </>
                              )}
                            </button>
                          )}
                          <button onClick={handleCancel} disabled={processing} className="btn-danger w-full py-3">Cancel Order</button>
                        </div>
                      )}
                      <button onClick={() => window.print()} className="btn-secondary w-full py-3 flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Print Receipt</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Printable Receipt */}
              <div className="print-only receipt-container">
                <div className="receipt-header">
                  <span className="receipt-logo">Hometown Brew</span>
                  <span className="receipt-subtitle">Official Receipt</span>
                </div>

                <div className="receipt-info">
                  <p><span>Order No.</span> <strong>{selectedOrder.orderNumber}</strong></p>
                  <p><span>Cashier</span> <span style={{fontWeight: 700}}>{user?.name}</span></p>
                  <p><span>Date</span> <span>{formatDate(selectedOrder.createdAt)}</span></p>
                  <p><span>Type</span> <span style={{fontWeight: 700}}>{selectedOrder.orderType?.toUpperCase()?.replace('_', ' ')}</span></p>
                </div>

                <div className="receipt-divider"></div>

                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th className="w-[60%]">Item</th>
                      <th className="text-center w-[15%]">Qty</th>
                      <th className="text-right w-[25%]">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map(item => (
                      <tr key={item.id}>
                        <td className="item-col">
                          {item.productName}
                          {item.addons && JSON.parse(item.addons).map(a => (
                            <div key={a.name} className="item-addon text-slate-700">+ {a.name}</div>
                          ))}
                          {item.comboChoices && (
                            <div className="item-addon text-slate-800 font-bold">
                              + {(() => {
                                try {
                                  const choices = JSON.parse(item.comboChoices);
                                  return Object.values(choices).filter(Boolean).map(c => c.name).join(' + ');
                                } catch (e) { return ''; }
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="receipt-divider"></div>

                <div className="space-y-1 mt-2">
                  <div className="receipt-total-row" style={{opacity: 0.8}}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="receipt-total-row">
                      <span>Discount ({selectedOrder.discountType})</span>
                      <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                    </div>
                  )}
                  {selectedOrder.taxAmount > 0 && (
                    <div className="receipt-total-row" style={{opacity: 0.8}}>
                      <span>VAT (12%)</span>
                      <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                    </div>
                  )}
                  <div className="receipt-total-row receipt-total-main">
                    <span>TOTAL</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-info" style={{ marginTop: '4mm' }}>
                  <p><span>Payment Method</span> <strong>{selectedOrder.paymentMethod?.toUpperCase()}</strong></p>
                  {selectedOrder.amountReceived > 0 && (
                    <>
                      <p><span>Amount Received</span> <span>{formatCurrency(selectedOrder.amountReceived)}</span></p>
                      <p><span>Change Due</span> <strong>{formatCurrency(selectedOrder.amountReceived - selectedOrder.total)}</strong></p>
                    </>
                  )}
                </div>

                <div className="receipt-footer">
                  <div style={{ marginBottom: '8px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px', margin: '0 auto', display: 'block' }}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </div>
                  <p style={{fontSize: '14px', fontWeight: 900}}>THANK YOU!</p>
                  <p style={{marginTop: '2mm', fontWeight: 600, fontSize: '10px'}}>PLEASE COME AGAIN</p>
                  <p style={{marginTop: '5mm', fontWeight: 500, fontSize: '9px', opacity: 0.6}}>Powered by Hometown Brew POS</p>
                  <p style={{marginTop: '1mm', fontWeight: 500, fontSize: '8px', opacity: 0.4}}>{window.location.hostname}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {/* Serve/Deliver Confirmation Modal */}
      {showServeModal && selectedOrder && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                {selectedOrder.orderType === 'delivery' ? <Truck className="w-10 h-10 text-emerald-600" /> : <ShoppingBag className="w-10 h-10 text-emerald-600" />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {selectedOrder.orderType === 'delivery' ? 'Confirm Delivery' : 'Mark as Served'}
              </h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                {selectedOrder.orderType === 'delivery' 
                  ? `Mark order #${selectedOrder.orderNumber} as delivered?` 
                  : `Mark order #${selectedOrder.orderNumber} as served?`}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleServeOrder}
                  disabled={processing}
                  className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {processing ? 'Processing...' : 'Yes, Complete Order'}
                </button>
                <button
                  onClick={() => setShowServeModal(false)}
                  disabled={processing}
                  className="w-full py-5 bg-slate-100 text-slate-600 font-black rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Action Restricted Modal */}
      {restrictionModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div 
            className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-sm p-6 sm:p-8 shadow-2xl animate-scale-in text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient soft glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />

            {/* Lock Icon */}
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-amber-500/10 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Time In Required</span>
            </div>

            <h3 className="font-heading text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
              Action Restricted
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mb-6 px-2">
              {restrictionModal.message || 'You must Time In to start your shift before processing payments and managing orders.'}
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setRestrictionModal(null);
                  handleOpenTimeIn();
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
              >
                <Timer className="w-4 h-4" />
                <span>Time In Now</span>
              </button>

              <button
                type="button"
                onClick={() => setRestrictionModal(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700/80 active:scale-95 text-slate-400 hover:text-slate-200 font-bold rounded-2xl transition-all text-xs uppercase tracking-wider"
              >
                Dismiss (Read-Only Mode)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
