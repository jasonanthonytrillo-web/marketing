import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getKitchenOrders, startPreparing, completeOrder, markServed, getCashierActiveShift, cashierTimeIn, cashierTimeOut } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getElapsedMinutes, playNotificationSound, unlockAudio, updateAppBadge, requestNotificationPermission, showSystemNotification, formatDate } from '../utils/helpers';
import { useDynamicBranding } from '../hooks/useDynamicBranding';
import { applyTheme, clearTheme } from '../utils/theme';
import { Bell, BellOff, ChefHat, LogOut, UtensilsCrossed, PackageOpen, Gift, AlertTriangle, MapPin, CheckCircle, Timer, Clock, ShieldAlert, Lock } from 'lucide-react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [showServeModal, setShowServeModal] = useState(false);
  const [prepModalOrder, setPrepModalOrder] = useState(null);
  const [serveModalOrder, setServeModalOrder] = useState(null);
  const [isAlerting, setIsAlerting] = useState(false);

  // Shift Attendance State
  const [activeShift, setActiveShift] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [showTimeInModal, setShowTimeInModal] = useState(false);
  const [showTimeOutModal, setShowTimeOutModal] = useState(false);
  const [timeInLoading, setTimeInLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);

  const { joinRoom, onEvent, connected } = useSocket();
  const { logoutUser, user } = useAuth();
  const alertInterval = useRef(null);

  // Dynamic favicon & title
  useDynamicBranding(`${user?.tenantName || 'Kitchen'} Dashboard`, user?.tenantFavicon);

  useEffect(() => {
    if (user?.tenantColor) applyTheme(user.tenantColor);
    return () => clearTheme();
  }, [user?.tenantColor]);

  useEffect(() => {
    loadOrders();
    checkShiftStatus();
    if (user?.tenantId) {
      joinRoom('kitchen', user.tenantId);
    }

    // Request push notification permissions
    requestNotificationPermission();

    const timer = setInterval(() => setNow(new Date()), 30000); // Update timers every 30s

    // Unlock audio for KDS notifications
    const unlock = () => {
      unlockAudio();
      setAudioUnlocked(true);
      console.log('Audio unlocked for Kitchen Dashboard');
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });

    return () => {
      clearInterval(timer);
      if (alertInterval.current) clearInterval(alertInterval.current);
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, [connected, user?.tenantId]);

  const stopAlert = () => {
    setIsAlerting(false);
    setShowNewOrderAlert(false);
    if (alertInterval.current) {
      clearInterval(alertInterval.current);
      alertInterval.current = null;
    }
  };

  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('new_kitchen_order', (data) => {
      setIsAlerting(true);
      setShowNewOrderAlert(true);
      playNotificationSound('newOrder');

      const displayNum = data.order?.orderNumber?.includes('-') ? data.order.orderNumber.split('-')[1] : data.order?.orderNumber;
      showSystemNotification('New Kitchen Order! 👨‍🍳', `Order #${displayNum} is confirmed. Start preparing now.`);

      // Clear existing interval if any
      if (alertInterval.current) clearInterval(alertInterval.current);
      
      // Start new loop
      alertInterval.current = setInterval(() => {
        playNotificationSound('newOrder');
      }, 3000);

      loadOrders();
    });
    const unsub2 = onEvent('order_update', () => loadOrders());
    return () => { unsub(); unsub2(); };
  }, [onEvent]);

  const [activeTab, setActiveTab] = useState('confirmed'); // confirmed, preparing, ready

  const loadOrders = async () => {
    try {
      const res = await getKitchenOrders();
      setOrders(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Update native PWA app badge with new/confirmed orders count
  useEffect(() => {
    const newCount = orders.filter(o => o.status === 'confirmed').length;
    updateAppBadge(newCount);
    return () => {
      updateAppBadge(0);
    };
  }, [orders]);

  const checkShiftStatus = async () => {
    try {
      const res = await getCashierActiveShift();
      if (res.data?.data) {
        setActiveShift(res.data.data);
        setIsRestricted(false);
        setShowTimeInModal(false);
      } else {
        setActiveShift(null);
        setIsRestricted(true);
        setShowTimeInModal(true);
      }
    } catch (err) {
      console.error('Error checking shift status:', err);
      setIsRestricted(true);
    }
  };

  const handleConfirmTimeIn = async () => {
    setTimeInLoading(true);
    try {
      const res = await cashierTimeIn({ startingCash: 0 });
      setActiveShift(res.data.data);
      setIsRestricted(false);
      setShowTimeInModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record time-in');
    } finally {
      setTimeInLoading(false);
    }
  };

  const handleConfirmTimeOut = async () => {
    setTimeOutLoading(true);
    try {
      const res = await cashierTimeOut({});
      const closed = res.data.data;
      
      setShiftSummary(closed);

      setActiveShift(null);
      setIsRestricted(true);
      setShowTimeOutModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record time-out');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const handleAction = async (orderId, action) => {
    if (isRestricted || !activeShift) {
      setShowTimeInModal(true);
      return alert('Action restricted: Please Time In to operate kitchen tickets.');
    }
    setProcessing(true);
    try {
      if (action === 'start') {
        setPrepModalOrder(orderId);
        setShowPrepModal(true);
        setProcessing(false); // Modal takes over
        return;
      }
      else if (action === 'complete') await completeOrder(orderId);
      else if (action === 'served') {
        setServeModalOrder(orderId);
        setShowServeModal(true);
        setProcessing(false);
        return;
      }
      loadOrders();
    } catch (e) {
      alert('Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPrep = async (mins) => {
    if (isRestricted || !activeShift) {
      setShowTimeInModal(true);
      return alert('Action restricted: Please Time In to operate kitchen tickets.');
    }
    if (!prepModalOrder) return;
    setProcessing(true);
    setShowPrepModal(false);
    try {
      await startPreparing(prepModalOrder, mins);
      setPrepModalOrder(null);
      loadOrders();
    } catch (e) {
      alert('Action failed');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleConfirmServe = async () => {
    if (isRestricted || !activeShift) {
      setShowTimeInModal(true);
      return alert('Action restricted: Please Time In to operate kitchen tickets.');
    }
    if (!serveModalOrder) return;
    setProcessing(true);
    setShowServeModal(false);
    try {
      await markServed(serveModalOrder);
      setServeModalOrder(null);
      loadOrders();
    } catch (e) {
      alert('Action failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a3d01] gap-6">
      <img src="/favicon.png" alt="Hometown Brew" className="w-24 h-24 rounded-3xl animate-pulse shadow-[0_0_60px_rgba(255,255,255,0.15)]" />
      <div className="text-center">
        <h1 className="text-white text-[22px] font-black tracking-tight font-heading">Hometown Brew</h1>
        <p className="text-white/50 text-[11px] font-semibold tracking-[3px] uppercase mt-1.5">Bringing home closer</p>
      </div>
      <div className="flex gap-1.5 mt-2">
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.2s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.4s]"></span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-white overflow-hidden relative">
      {/* New Order Visual Alert */}
      {showNewOrderAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-bounce cursor-pointer" onClick={stopAlert}>
          <div className="bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.5)] border-4 border-white/20 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Bell className="w-8 h-8" />
              <span className="font-heading font-black text-2xl uppercase tracking-tighter">New Order Received!</span>
            </div>
            <span className="text-xs font-bold bg-emerald-700/50 flex items-center gap-1.5 px-3 py-1 rounded-full animate-pulse">Tap to Silence Alarm <BellOff className="w-3 h-3" /></span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-surface-900 border-b border-surface-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {user?.tenantLogo ? (
            <img src={user.tenantLogo} className="w-8 h-8 rounded-lg object-cover shadow-sm" alt={user.tenantName} />
          ) : (
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 shadow-inner"><ChefHat className="w-4 h-4" /></div>
          )}
          <div className="flex flex-col">
            <h2 className="font-heading font-black text-emerald-500 text-lg sm:text-xl tracking-tight uppercase truncate leading-tight">{user?.tenantName || 'Kitchen'} Dashboard</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">
                {connected ? 'Realtime Active' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {activeShift ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">Shift Active</span>
            </div>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 rounded-lg text-xs font-bold">
              <Lock className="w-3 h-3" /> Not Timed In
            </span>
          )}

          {activeShift ? (
            <button
              onClick={() => setShowTimeOutModal(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900 active:scale-95 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Timer className="w-4 h-4 text-rose-400" />
              <span className="hidden xs:inline">End Shift /</span> Time Out
            </button>
          ) : (
            <button
              onClick={() => setShowTimeInModal(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Timer className="w-4 h-4" />
              Time In
            </button>
          )}

          <span className="text-xs sm:text-sm font-medium text-surface-400 hidden sm:flex sm:items-center sm:gap-1.5"><ChefHat className="w-4 h-4" /> {user?.name}</span>
          <button onClick={logoutUser} className="text-surface-500 hover:text-red-400 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Log Out</button>
        </div>
      </header>

      {/* Restricted Mode Banner */}
      {isRestricted && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 animate-fade-in no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black tracking-wide uppercase">Restricted Read-Only Mode</p>
              <p className="text-[11px] sm:text-xs text-white/90 font-medium">You are not timed in. Kitchen prep and ticket actions are restricted until you time in.</p>
            </div>
          </div>
          <button
            onClick={() => setShowTimeInModal(true)}
            className="px-4 py-2 bg-white text-orange-700 hover:bg-orange-50 active:scale-95 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
          >
            <Timer className="w-4 h-4" /> Time In Now
          </button>
        </div>
      )}

      {/* Time-In Modal */}
      {showTimeInModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-surface-800">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white text-center relative overflow-hidden">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <ChefHat className="w-9 h-9 text-white" />
              </div>
              <h3 className="font-heading font-black text-2xl tracking-tight mb-1">Start Kitchen Shift</h3>
              <p className="text-white/90 text-xs font-semibold">You are about to time in for kitchen duty</p>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-surface-300 leading-relaxed font-medium">
                  Timing in records your attendance and enables full ticket preparation controls. If you choose <strong>Cancel</strong>, you can only view orders in read-only mode.
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmTimeIn}
                  disabled={timeInLoading}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  <Timer className="w-5 h-5" />
                  <span>{timeInLoading ? 'Recording Time In...' : 'Time In'}</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => { setShowTimeInModal(false); setIsRestricted(true); }}
                  className="w-full py-3.5 bg-surface-800 hover:bg-surface-700 active:scale-95 text-surface-400 font-bold rounded-2xl transition-all text-xs uppercase tracking-widest"
                >
                  Cancel (Read-Only Mode)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time-Out Modal */}
      {showTimeOutModal && activeShift && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-surface-800">
            <div className="bg-gradient-to-br from-rose-600 to-pink-700 p-7 text-white text-center relative overflow-hidden">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Timer className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-heading font-black text-xl tracking-tight mb-1">Time Out & End Kitchen Shift</h3>
              <p className="text-white/90 text-xs font-semibold">Clock out and record your shift completion</p>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-surface-400">
                  <span>Shift Started:</span>
                  <span className="font-bold text-white">{formatDate(activeShift.startTime)}</span>
                </div>
                <div className="flex justify-between text-surface-400">
                  <span>Staff Member:</span>
                  <span className="font-bold text-white">{user?.name}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmTimeOut}
                  disabled={timeOutLoading}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-rose-600/25 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  {timeOutLoading ? 'Recording Time Out...' : 'Confirm Time Out'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowTimeOutModal(false)}
                  className="w-full py-3 text-surface-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Cancel / Stay on Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {shiftSummary && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-surface-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-surface-700 animate-scale-in">
            <div className="bg-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-black text-2xl tracking-tight">Shift Completed!</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-surface-700 pb-2">
                  <span className="text-surface-400 font-medium">Time In</span>
                  <span className="font-bold text-white">{formatDate(shiftSummary.startTime)}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-surface-400 font-medium">Time Out</span>
                  <span className="font-bold text-white">{formatDate(shiftSummary.endTime)}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShiftSummary(null);
                  setShowTimeInModal(true);
                }}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition-all"
              >
                Okay, Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex p-2 bg-surface-900 border-b border-surface-800 gap-1 flex-shrink-0">
        {[
          { id: 'confirmed', label: 'New', color: 'bg-surface-700', active: 'bg-emerald-500' },
          { id: 'preparing', label: 'Preparing', color: 'bg-surface-700', active: 'bg-orange-500' },
          { id: 'ready', label: 'Ready', color: 'bg-surface-700', active: 'bg-blue-500' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${activeTab === tab.id ? `${tab.active} text-white shadow-lg` : 'bg-surface-800 text-surface-400'}`}
          >
            {tab.label} ({orders.filter(o => o.status === tab.id).length})
          </button>
        ))}
      </div>

      {/* Kanban Board / Content */}
      <div className="flex-1 flex overflow-x-auto md:p-6 gap-6 items-start h-full pb-20">
        {/* NEW ORDERS (Confirmed) */}
        <div className={`flex-none w-full md:w-[400px] flex flex-col h-full bg-surface-900/50 md:rounded-2xl border-r md:border border-surface-800 ${activeTab !== 'confirmed' ? 'hidden md:flex' : 'flex'}`}>
          <div className="hidden md:flex p-4 border-b border-surface-800 items-center justify-between bg-surface-800/80 rounded-t-2xl">
            <h3 className="font-heading font-bold text-lg text-white">New Orders</h3>
            <span className="badge bg-surface-700 text-white">{orders.filter(o => o.status === 'confirmed').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {orders.filter(o => o.status === 'confirmed').length === 0 ? (
              <p className="text-center text-surface-500 mt-10">No new orders</p>
            ) : (
              orders.filter(o => o.status === 'confirmed').map(order => (
                <OrderCard key={order.id} order={order} now={now} onAction={(action) => handleAction(order.id, action)} processing={processing} />
              ))
            )}
          </div>
        </div>

        {/* PREPARING */}
        <div className={`flex-none w-full md:w-[400px] flex flex-col h-full bg-orange-950/20 md:rounded-2xl border-r md:border border-orange-900/30 ${activeTab !== 'preparing' ? 'hidden md:flex' : 'flex'}`}>
          <div className="hidden md:flex p-4 border-b border-orange-900/50 items-center justify-between bg-orange-900/20 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 className="font-heading font-bold text-lg text-orange-400">Preparing</h3>
            </div>
            <span className="badge bg-orange-500/20 text-orange-300">{orders.filter(o => o.status === 'preparing').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {orders.filter(o => o.status === 'preparing').length === 0 ? (
              <p className="text-center text-orange-900/50 mt-10">Nothing in preparation</p>
            ) : (
              orders.filter(o => o.status === 'preparing').map(order => (
                <OrderCard key={order.id} order={order} now={now} onAction={(action) => handleAction(order.id, action)} processing={processing} />
              ))
            )}
          </div>
        </div>

        {/* READY */}
        <div className={`flex-none w-full md:w-[400px] flex flex-col h-full bg-emerald-950/20 md:rounded-2xl md:border border-emerald-900/30 ${activeTab !== 'ready' ? 'hidden md:flex' : 'flex'}`}>
          <div className="hidden md:flex p-4 border-b border-emerald-900/50 items-center justify-between bg-emerald-900/20 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="font-heading font-bold text-lg text-emerald-400">Ready</h3>
            </div>
            <span className="badge bg-emerald-500/20 text-emerald-300">{orders.filter(o => o.status === 'ready').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {orders.filter(o => o.status === 'ready').length === 0 ? (
              <p className="text-center text-emerald-900/50 mt-10">No orders ready</p>
            ) : (
              orders.filter(o => o.status === 'ready').map(order => (
                <OrderCard key={order.id} order={order} now={now} onAction={(action) => handleAction(order.id, action)} processing={processing} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Prep Time Modal */}
      {showPrepModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-900 border border-surface-800 rounded-[40px] p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-orange-500/30"><UtensilsCrossed className="w-10 h-10 text-orange-500" /></div>
              <h2 className="text-3xl font-black text-white mb-2">Estimate Prep Time</h2>
              <p className="text-surface-400 font-medium text-lg">How long will this order take?</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-10">
              {[5, 10, 15, 20, 30, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => handleConfirmPrep(mins)}
                  className="py-6 bg-surface-800 hover:bg-orange-600 border border-surface-700 hover:border-orange-500 rounded-2xl font-black text-2xl transition-all active:scale-95 flex flex-col items-center group"
                >
                  <span className="text-white group-hover:scale-110 transition-transform">{mins}</span>
                  <span className="text-[10px] uppercase tracking-widest text-surface-500 group-hover:text-orange-100">Mins</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative group">
                <input
                  type="number"
                  id="custom-prep"
                  placeholder="Or enter custom minutes..."
                  className="w-full bg-surface-950 border-2 border-surface-800 rounded-2xl py-5 px-6 text-xl font-bold focus:border-orange-500 outline-none transition-all placeholder:text-surface-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmPrep(e.target.value);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const val = document.getElementById('custom-prep').value;
                  if (val) handleConfirmPrep(val);
                }}
                className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xl rounded-2xl shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
              >
                Start Cooking Now <UtensilsCrossed className="w-6 h-6" />
              </button>
              <button
                onClick={() => setShowPrepModal(false)}
                className="w-full py-4 text-surface-500 font-bold hover:text-white transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Serve Confirmation Modal */}
      {showServeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-900 border border-surface-800 rounded-[40px] p-8 md:p-12 max-w-sm w-full shadow-2xl animate-scale-in">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30"><CheckCircle className="w-10 h-10 text-emerald-500" /></div>
              <h2 className="text-3xl font-black text-white mb-2">Confirm Order</h2>
              <p className="text-surface-400 font-medium text-lg">Mark this order as served?</p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleConfirmServe}
                disabled={processing}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
              >
                {processing ? 'Processing...' : 'Yes, Order Served'}
              </button>
              <button
                onClick={() => {
                  setShowServeModal(false);
                  setServeModalOrder(null);
                }}
                disabled={processing}
                className="w-full py-4 text-surface-500 font-bold hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, now, onAction, processing }) {
  const elapsed = getElapsedMinutes(order.createdAt);
  const isUrgent = elapsed > 15;
  const isWarning = elapsed > 10;

  let timerColor = 'text-emerald-400 bg-emerald-400/10';
  if (isUrgent) timerColor = 'text-red-400 bg-red-400/10 animate-pulse';
  else if (isWarning) timerColor = 'text-amber-400 bg-amber-400/10';

  const formatElapsed = (mins) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  return (
    <div className={`bg-surface-800 rounded-xl border ${isUrgent ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : isWarning ? 'border-amber-500/30' : 'border-surface-700'} overflow-hidden animate-fade-in-up`}>
      <div className={`p-3 flex justify-between items-center border-b ${isUrgent ? 'border-red-500/20 bg-red-500/5' : isWarning ? 'border-amber-500/20 bg-amber-500/5' : 'border-surface-700 bg-surface-800/80'}`}>
        <div>
          <span className={`font-heading font-black text-xl ${isUrgent ? 'text-red-400' : 'text-white'}`}>{order.orderNumber}</span>
          <span className="ml-2 text-xs inline-flex items-center gap-1.5 text-surface-400">
            {order.orderType === 'dine_in' ? <><UtensilsCrossed className="w-3 h-3" /> Dine In</> : order.orderType === 'delivery' ? <><MapPin className="w-3 h-3 text-blue-400" /> Delivery</> : <><PackageOpen className="w-3 h-3" /> Take Out</>}
            {order.paymentMethod === 'points' && (
              <span className="ml-2 text-purple-400 font-bold flex items-center gap-1"><Gift className="w-3 h-3" /> REWARD</span>
            )}
          </span>
          {order.orderType === 'delivery' && (
            <div className="mt-1 text-[10px] font-bold text-blue-400/80 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" /> {order.deliveryAddress || 'No Address'}
            </div>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-sm font-bold font-heading tabular-nums ${timerColor}`}>
           {formatElapsed(elapsed)}
        </div>
      </div>

      {(() => {
        const notes = order.notes || '';
        const promoMatch = notes.match(/\(Promo:\s*([^\)]+)\)/i);
        const promoOnly = notes.trim().match(/^\(Promo:\s*[^\)]+\)\s*$/i);
        return (
          <>
            {promoMatch && (
              <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><Gift className="w-3 h-3 text-emerald-600" /></div>
                <p className="text-xs font-bold text-emerald-200"><span className="text-emerald-500 uppercase text-[10px] tracking-widest mr-1">Promo</span> {promoMatch[1].trim()}</p>
              </div>
            )}
            {!promoOnly && order.notes && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-200"><span className="text-amber-500 uppercase text-[10px] tracking-widest mr-1">Note:</span> {order.notes}</p>
              </div>
            )}
          </>
        );
      })()}

      <div className="p-4 bg-surface-900">
        <ul className="space-y-3">
          {order.items?.map(item => (
            <li key={item.id} className="text-sm">
              <div className="flex items-start">
                <span className="font-bold text-emerald-400 mr-2">{item.quantity}×</span>
                <span className="font-medium text-white">{item.productName}</span>
              </div>
              {item.size && (
                <div className="ml-6 text-xs text-emerald-200 mt-1 font-bold">
                  {item.size}
                </div>
              )}
              {item.addons && (
                <div className="ml-6 text-xs text-surface-400 mt-1">
                  + {JSON.parse(item.addons).map(a => a.name).join(', ')}
                </div>
              )}
              {item.comboChoices && (
                <div className="ml-6 text-xs text-emerald-300 mt-1 font-bold">
                  + {(() => {
                    try {
                      const choices = JSON.parse(item.comboChoices);
                      return Object.values(choices).filter(Boolean).map(c => c.name).join(' + ');
                    } catch (e) { return ''; }
                  })()}
                </div>
              )}
              {item.notes && (
                <div className="ml-6 text-xs flex items-center gap-1.5 text-amber-400 mt-1 bg-amber-400/10 px-2 py-1 rounded inline-flex border border-amber-400/20">
                  <AlertTriangle className="w-3 h-3" /> {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 bg-surface-800 border-t border-surface-700 flex gap-2">
        {order.status === 'confirmed' && (
          <button onClick={() => onAction('start')} disabled={processing} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors shadow-lg">
            Start Preparing
          </button>
        )}
        {order.status === 'preparing' && (
          <button onClick={() => onAction('complete')} disabled={processing} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg">
            Mark Ready
          </button>
        )}
        {order.status === 'ready' && (
          <button onClick={() => onAction('served')} disabled={processing} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg">
            Mark as Served
          </button>
        )}
      </div>
    </div>
  );
}
