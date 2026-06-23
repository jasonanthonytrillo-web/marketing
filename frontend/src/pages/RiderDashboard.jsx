import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  getAvailableRiderOrders, 
  getActiveRiderOrders, 
  pickupOrder, 
  deliverOrder,
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
  MessageSquare
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function RiderDashboard() {
  const { user, logoutUser } = useAuth();
  const { onEvent } = useSocket();
  const [activeTab, setActiveTab] = useState('available'); // available | active
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState(null);

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

  const handlePickup = async (orderId) => {
    try {
      await pickupOrder(orderId);
      setActiveTab('active');
    } catch (error) {
      alert('Failed to pick up order.');
    }
  };

  const handleDeliver = async (orderId) => {
    if (!window.confirm('Mark this order as delivered?')) return;
    try {
      await deliverOrder(orderId);
      loadData();
    } catch (error) {
      alert('Failed to complete delivery.');
    }
  };

  const openInMaps = (lat, lng, address) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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
                    <button
                      onClick={() => openInMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                      className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                      <Navigation className="w-5 h-5" />
                      Navigate to Maps
                    </button>
                    <button
                      onClick={() => handleDeliver(order.id)}
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
           <button className="p-2 bg-slate-100 rounded-xl text-slate-500 relative">
             <Clock className="w-5 h-5" />
           </button>
        </div>
      </div>
    </div>
  );
}
