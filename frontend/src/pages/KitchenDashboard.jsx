import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getKitchenOrders, startPreparing, completeOrder, markServed } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getElapsedMinutes, playNotificationSound, unlockAudio } from '../utils/helpers';
import { useDynamicBranding } from '../hooks/useDynamicBranding';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [prepModalOrder, setPrepModalOrder] = useState(null);
  const [isAlerting, setIsAlerting] = useState(false);
  const { joinRoom, onEvent, connected } = useSocket();
  const { logoutUser, user } = useAuth();
  const alertInterval = useRef(null);

  // Dynamic favicon & title
  useDynamicBranding(`${user?.tenantName || 'Kitchen'} Dashboard`, user?.tenantFavicon);

  useEffect(() => {
    loadOrders();
    if (connected && user?.tenantId) {
      joinRoom('kitchen', user.tenantId);
    }
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
  }, []);

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

  const handleAction = async (orderId, action) => {
    setProcessing(true);
    try {
      if (action === 'start') {
        setPrepModalOrder(orderId);
        setShowPrepModal(true);
        setProcessing(false); // Modal takes over
        return;
      }
      else if (action === 'complete') await completeOrder(orderId);
      else if (action === 'served') await markServed(orderId);
      loadOrders();
    } catch (e) {
      alert('Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPrep = async (mins) => {
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

  if (loading) return <div className="min-h-screen bg-surface-900 text-white flex items-center justify-center">Loading KDS...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-white overflow-hidden relative">
      {/* New Order Visual Alert */}
      {showNewOrderAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-bounce cursor-pointer" onClick={stopAlert}>
          <div className="bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.5)] border-4 border-white/20 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🔔</span>
              <span className="font-heading font-black text-2xl uppercase tracking-tighter">New Order Received!</span>
            </div>
            <span className="text-xs font-bold bg-emerald-700/50 px-3 py-1 rounded-full animate-pulse">Tap to Silence Alarm 🔇</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-surface-900 border-b border-surface-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {user?.tenantLogo ? (
            <img src={user.tenantLogo} className="w-8 h-8 rounded-lg object-cover shadow-sm" alt={user.tenantName} />
          ) : (
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-sm shadow-inner">👨‍🍳</div>
          )}
          <h2 className="font-heading font-black text-emerald-500 text-lg sm:text-xl tracking-tight uppercase truncate">{user?.tenantName || 'Kitchen'} Dashboard</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm font-medium text-surface-400 hidden sm:inline">👨‍🍳 {user?.name}</span>
          <button onClick={logoutUser} className="text-surface-500 hover:text-red-400 text-xs sm:text-sm font-medium transition-colors">Log Out</button>
        </div>
      </header>

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
              <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 border border-orange-500/30">🍳</div>
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
                Start Cooking Now 🍳
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

  return (
    <div className={`bg-surface-800 rounded-xl border ${isUrgent ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : isWarning ? 'border-amber-500/30' : 'border-surface-700'} overflow-hidden animate-fade-in-up`}>
      <div className={`p-3 flex justify-between items-center border-b ${isUrgent ? 'border-red-500/20 bg-red-500/5' : isWarning ? 'border-amber-500/20 bg-amber-500/5' : 'border-surface-700 bg-surface-800/80'}`}>
        <div>
          <span className={`font-heading font-black text-xl ${isUrgent ? 'text-red-400' : 'text-white'}`}>{order.orderNumber}</span>
          <span className="ml-2 text-xs text-surface-400">
            {order.orderType === 'dine_in' ? '🍽️ Dine In' : '🥡 Take Out'}
            {order.paymentMethod === 'points' && (
              <span className="ml-2 text-purple-400 font-bold">🎁 REWARD</span>
            )}
          </span>
        </div>
        <div className={`px-2 py-1 rounded text-sm font-bold font-heading tabular-nums ${timerColor}`}>
          {elapsed}m
        </div>
      </div>

      <div className="p-4 bg-surface-900">
        <ul className="space-y-3">
          {order.items?.map(item => (
            <li key={item.id} className="text-sm">
              <div className="flex items-start">
                <span className="font-bold text-emerald-400 mr-2">{item.quantity}×</span>
                <span className="font-medium text-white">{item.productName}</span>
              </div>
              {item.addons && (
                <div className="ml-6 text-xs text-surface-400 mt-1">
                  + {JSON.parse(item.addons).map(a => a.name).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="ml-6 text-xs text-amber-400 mt-1 bg-amber-400/10 px-2 py-1 rounded inline-block border border-amber-400/20">
                  ⚠️ {item.notes}
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
