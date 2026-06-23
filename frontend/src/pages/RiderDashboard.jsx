import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  getAvailableRiderOrders, 
  getActiveRiderOrders, 
  pickupOrder, 
  deliverOrder,
  notifyArrival,
  getPublicTenant
} from '../services/api';
import { 
  Truck, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Clock, 
  Package, 
  LogOut,
  ChevronRight,
  RefreshCw,
  Phone,
  MessageSquare,
  Bell,
  Bike
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function RiderDashboard() {
  const { user, logoutUser } = useAuth();
  const { onEvent } = useSocket();
  const [activeTab, setActiveTab] = useState('available'); // available | active
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState(null);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [orderToDeliver, setOrderToDeliver] = useState(null);
  const [delivering, setDelivering] = useState(false);
  const [notifyingArrival, setNotifyingArrival] = useState({});
  const [lastNotified, setLastNotified] = useState({}); // orderId -> timestamp
  const [now, setNow] = useState(Date.now());

  const loadData = async () => {
    setLoading(true);
    try {
      const res = activeTab === 'available' 
        ? await getAvailableRiderOrders() 
        : await getActiveRiderOrders();
      setOrders(res.data.data);
    } catch (error) {
      console.error('Failed to load rider orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await getPublicTenant(user?.tenantSlug || 'project-million');
        if (res.data.success) {
          setBranding(res.data.data);
        }
      } catch (e) {
        console.error('Branding fetch failed:', e);
      }
    };
    if (user?.tenantSlug) fetchBranding();
  }, [user?.tenantSlug]);

  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('order_update', () => {
      loadData();
    });
    return () => unsub();
  }, [onEvent, activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePickup = async (orderId) => {
    try {
      await pickupOrder(orderId);
      setActiveTab('active');
    } catch (error) {
      alert('Failed to pick up order.');
    }
  };

  const handleDeliver = async () => {
    if (!orderToDeliver) return;
    setDelivering(true);
    try {
      await deliverOrder(orderToDeliver.id);
      setShowDeliverModal(false);
      setOrderToDeliver(null);
      loadData();
    } catch (error) {
      alert('Failed to complete delivery.');
    } finally {
      setDelivering(false);
    }
  };

  const handleNotifyArrival = async (orderId) => {
    setNotifyingArrival(prev => ({ ...prev, [orderId]: true }));
    try {
      await notifyArrival(orderId);
      setLastNotified(prev => ({ ...prev, [orderId]: Date.now() }));
    } catch (error) {
      alert('Failed to notify customer.');
    } finally {
      setNotifyingArrival(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const openInMaps = (lat, lng) => {
    const storeLat = branding?.storeLat;
    const storeLng = branding?.storeLng;
    let url;
    if (storeLat && storeLng) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${storeLat},${storeLng}&destination=${lat},${lng}&travelmode=driving`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
    window.open(url, '_blank');
  };

  const brandingColor = branding?.color || '#10b981';

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-slate-100 sticky top-0 z-30">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rider Dashboard</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{user?.name} • Delivery Team</p>
          </div>
          <button 
            onClick={logoutUser}
            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package className="w-4 h-4" />
            Available
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Truck className="w-4 h-4" />
            My Tasks
          </button>
        </div>
      </div>

      {/* Order List */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold text-sm">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {activeTab === 'available' ? <Package className="w-8 h-8 text-slate-400" /> : <CheckCircle className="w-8 h-8 text-slate-400" />}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{activeTab === 'available' ? 'No orders ready' : 'No active deliveries'}</h3>
            <p className="text-slate-500 text-xs px-10">
              {activeTab === 'available' ? "Sit tight! New delivery orders will appear here once the kitchen marks them as ready." : "You don't have any orders in progress. Go to the available tab to pick up a delivery."}
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-6 animate-fade-in-up">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Order #</span>
                    <span className="text-xl font-black text-slate-900">{order.orderNumber}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> {order.customerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900">{formatCurrency(order.total)}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">₱{order.deliveryFee} Fee</p>
                </div>
              </div>

              {/* Address / Maps */}
              <div 
                onClick={() => openInMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                className="bg-slate-50 rounded-3xl p-5 border border-slate-100 active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:text-blue-600 transition-colors">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Destination</p>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed line-clamp-2">{order.deliveryAddress}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
                </div>
              </div>

              {/* Items Summary (Small) */}
              <div className="px-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Order Items ({order.items?.length})</p>
                <div className="flex flex-wrap gap-2">
                  {order.items?.map(item => (
                    <span key={item.id} className="text-[11px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl">
                      {item.quantity}× {item.productName}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {activeTab === 'available' ? (
                  <button
                    onClick={() => handlePickup(order.id)}
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  >
                    <Truck className="w-5 h-5" />
                    Pickup Order
                  </button>
                ) : (
                  <>
                    {(() => {
                      const notifiedAt = lastNotified[order.id];
                      const diff = notifiedAt ? now - notifiedAt : Infinity;
                      const isCooldown = diff < 60000;
                      const secondsLeft = Math.ceil((60000 - diff) / 1000);

                      return (
                        <button
                          onClick={() => handleNotifyArrival(order.id)}
                          disabled={notifyingArrival[order.id] || isCooldown}
                          className={`w-full py-5 font-black rounded-3xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${
                            isCooldown
                              ? 'bg-amber-100 text-amber-700 shadow-amber-200/50'
                              : 'bg-amber-500 text-white shadow-amber-500/20 active:scale-95'
                          }`}
                        >
                          <Bell className={`w-5 h-5 ${isCooldown ? '' : 'animate-pulse'}`} />
                          {notifyingArrival[order.id] 
                            ? 'Notifying...' 
                            : isCooldown 
                              ? `Nudge in ${secondsLeft}s` 
                              : notifiedAt 
                                ? 'Nudge Customer' 
                                : "I've Arrived"}
                        </button>
                      );
                    })()}
                    
                    <button
                      onClick={() => openInMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                      className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                      <Navigation className="w-5 h-5 transition-transform group-hover:scale-110" />
                      Navigate to Maps
                    </button>
                    <button
                      onClick={() => {
                        setOrderToDeliver(order);
                        setShowDeliverModal(true);
                      }}
                      className="w-full py-5 bg-emerald-600 text-white font-black rounded-3xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Mark Delivered
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Access Floating Footer */}
      <div className="fixed bottom-6 left-6 right-6 z-40 bg-white/80 backdrop-blur-xl border border-white/20 p-4 rounded-[2.5rem] shadow-2xl flex justify-around items-center">
        <div className="flex flex-col items-center">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</span>
           <div className="flex items-center gap-2">
             <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-xs font-bold text-slate-800">Online</span>
           </div>
        </div>
        <div className="w-px h-8 bg-slate-200"></div>
        <div className="flex flex-col items-center">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rider ID</span>
           <span className="text-xs font-bold text-slate-800">#{user?.id}</span>
        </div>
        <div className="w-px h-8 bg-slate-200"></div>
        <div className="flex flex-col items-center">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deliveries</span>
           <span className="text-xs font-bold text-slate-800">{orders.filter(o => o.status === 'on_the_way').length} Active</span>
        </div>
      </div>
      {/* Delivery Confirmation Modal */}
      {showDeliverModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in border border-white/20">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Delivery</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                Are you sure you want to mark order <span className="font-black text-slate-900">#{orderToDeliver?.orderNumber}</span> as delivered?
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleDeliver}
                  disabled={delivering}
                  className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {delivering ? 'Updating Status...' : 'Yes, Order Delivered'}
                </button>
                <button
                  onClick={() => {
                    setShowDeliverModal(false);
                    setOrderToDeliver(null);
                  }}
                  disabled={delivering}
                  className="w-full py-5 bg-slate-100 text-slate-600 font-black rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
