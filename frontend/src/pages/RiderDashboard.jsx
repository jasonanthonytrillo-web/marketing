import { useState, useEffect, useRef } from 'react';
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
  Bike,
  AlertTriangle,
  Locate,
  X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCurrency, formatDate } from '../utils/helpers';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const storeIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

const customerIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

const riderIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:40px;height:40px;border-radius:50%;background:#fbbf24;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5" cy="18" r="3"/>
      <circle cx="19" cy="18" r="3"/>
      <path d="M10 18h4"/>
      <path d="M12 12h-4v6"/>
      <path d="M12 12l3-5h4l2 5h-9z"/>
      <path d="M4 8h4v4h-4z"/> {/* Delivery Box */}
      <path d="M15 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Decode OSRM polyline geometry
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

// Navigation View component
function RiderNavMap({ riderPos, customerPos, storePos, followMode }) {
  const map = useMap();
  const [routeCoords, setRouteCoords] = useState(null);

  const isValidPos = (pos) => pos && pos[0] != null && pos[1] != null && pos[0] !== 0;

  // Auto-center logic
  useEffect(() => {
    if (followMode && isValidPos(riderPos)) {
      map.setView(riderPos, map.getZoom(), { animate: true });
    }
  }, [riderPos, followMode, map]);

  // Routing logic
  const customerPosStr = JSON.stringify(customerPos);
  const riderPosStr = JSON.stringify(riderPos);

  useEffect(() => {
    if (!isValidPos(riderPos) || !isValidPos(customerPos)) return;
    const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${riderPos[1]},${riderPos[0]};${customerPos[1]},${customerPos[0]}?overview=full&geometries=polyline`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]?.geometry) {
          const decoded = decodePolyline(data.routes[0].geometry);
          setRouteCoords(decoded);
          if (!followMode) {
            map.fitBounds(L.latLngBounds(decoded), { padding: [40, 40] });
          }
        }
      })
      .catch(console.error);
    return () => controller.abort();
  }, [riderPosStr, customerPosStr, map, followMode]);

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {isValidPos(storePos) && <Marker position={storePos} icon={storeIcon}><Popup>Store</Popup></Marker>}
      {isValidPos(customerPos) && <Marker position={customerPos} icon={customerIcon}><Popup>Customer's House</Popup></Marker>}
      {isValidPos(riderPos) && <Marker position={riderPos} icon={riderIcon}><Popup>You are here</Popup></Marker>}
      {routeCoords && <Polyline positions={routeCoords} color="#3b82f6" weight={6} opacity={0.8} />}
    </>
  );
}

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
  const [showNavMap, setShowNavMap] = useState(false);
  const [activeNavOrder, setActiveNavOrder] = useState(null);
  const [followMode, setFollowMode] = useState(true);
  const [currentRiderPos, setCurrentRiderPos] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = activeTab === 'available'
        ? await getAvailableRiderOrders()
        : await getActiveRiderOrders();
      const data = res.data.data;
      setOrders(data);

      // Auto-expand if only one active order
      if (activeTab === 'active' && data.length === 1) {
        setExpandedOrderId(data[0].id);
      }
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

  const [trackingActive, setTrackingActive] = useState(false);
  const { emit } = useSocket();
  const lastEmitRef = useRef(0);
  const ordersRef = useRef(orders);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    const hasActiveOrders = orders.some(o => o.status === 'on_the_way');
    if (activeTab !== 'active' || !hasActiveOrders) {
      setTrackingActive(false);
      return;
    }

    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    console.log('📡 Starting GPS tracking...');
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setTrackingActive(true);
        const { latitude, longitude } = position.coords;
        const now = Date.now();
        setCurrentRiderPos([latitude, longitude]);

        if (now - lastEmitRef.current < 5000) return;
        lastEmitRef.current = now;

        ordersRef.current.forEach(order => {
          if (order.status === 'on_the_way') {
            emit('rider_location_update', {
              orderNumber: order.orderNumber,
              tenantId: order.tenantId,
              lat: latitude,
              lng: longitude
            });
          }
        });
      },
      (error) => {
        console.error('GPS Error:', error);
        setTrackingActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      console.log('🔌 Stopping GPS tracking...');
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeTab, orders.length > 0, emit]); // stable dependencies

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

  const openInMaps = (lat, lng, address) => {
    const storeLat = branding?.storeLat;
    const storeLng = branding?.storeLng;

    // Alert the user about background tracking
    alert("📍 Navigating to " + (address || "Customer") + ". \n\nIMPORTANT: Browsers stop tracking in the background. Please return to this dashboard occasionally to keep the customer updated!");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${storeLat},${storeLng}&destination=${lat},${lng}&travelmode=driving`;
    if (!storeLat || !storeLng) {
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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{user?.name} • Delivery Team</p>
              {trackingActive && (
                <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse border border-blue-100">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">GPS Live</span>
                </div>
              )}
            </div>
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

      {/* Background Tracking Warning */}
      {trackingActive && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Active Tracking Alert</p>
            <p className="text-[10px] font-medium text-amber-700 leading-tight mt-0.5">
              Keep this screen ON or return to it every few minutes. Tracking pauses if you stay too long in Google Maps.
            </p>
          </div>
        </div>
      )}

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
          orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-[2.5rem] p-6 shadow-sm border transition-all duration-300 flex flex-col gap-6 animate-fade-in-up ${isExpanded ? 'border-blue-200 ring-4 ring-blue-50' : 'border-slate-100'}`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Order #</span>
                        <span className="text-xl font-black text-slate-900">{order.orderNumber}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <CheckCircle className={`w-4 h-4 ${order.status === 'completed' ? 'text-emerald-500' : 'text-slate-300'}`} /> {order.customerName}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-xl font-black text-slate-900">{formatCurrency(order.total)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">₱{order.deliveryFee} Fee</p>
                        <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {!isExpanded && (
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      Tap to view actions
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="space-y-6 animate-fade-in">
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
                          <span key={item.id} className="text-[11px] font-bold bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl">
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
                                className={`w-full py-5 font-black rounded-3xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${isCooldown
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
                                      ? 'Notify Customer'
                                      : "I've Arrived"}
                              </button>
                            );
                          })()}

                          <button
                            onClick={() => {
                              setActiveNavOrder(order);
                              setShowNavMap(true);
                              setFollowMode(true);
                            }}
                            className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                          >
                            <Navigation className="w-5 h-5 text-blue-400" />
                            Show Route
                          </button>

                          <button
                            onClick={() => openInMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                            className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
                          >
                            Google Maps (External)
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
                )}
              </div>
            );
          })
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

      {/* Full Screen Navigation Map Modal */}
      {showNavMap && activeNavOrder && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fade-in">
          {/* Nav Header */}
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight">Navigating to #{activeNavOrder.orderNumber}</h3>
                <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{activeNavOrder.deliveryAddress}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNavMap(false)}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Large Map Area */}
          <div className="flex-1 relative">
            <MapContainer
              center={currentRiderPos || [activeNavOrder.deliveryLat, activeNavOrder.deliveryLng]}
              zoom={16}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <RiderNavMap
                riderPos={currentRiderPos}
                customerPos={[activeNavOrder.deliveryLat, activeNavOrder.deliveryLng]}
                storePos={branding?.storeLat ? [branding.storeLat, branding.storeLng] : null}
                followMode={followMode}
                setFollowMode={setFollowMode}
              />
            </MapContainer>

            {/* Map Overlays */}
            <div className="absolute bottom-10 left-6 right-6 flex flex-col gap-4 pointer-events-none">
              <div className="flex justify-between items-end">
                <button
                  onClick={() => setFollowMode(!followMode)}
                  className={`pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${followMode ? 'bg-blue-600 text-white' : 'bg-white text-slate-900'}`}
                >
                  <Locate className={`w-6 h-6 ${followMode ? 'animate-pulse' : ''}`} />
                </button>

                <div className="bg-white/95 backdrop-blur shadow-2xl rounded-3xl p-6 pointer-events-auto w-64 md:w-80">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Destination</span>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{activeNavOrder.customerName}</p>
                    </div>
                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active</div>
                  </div>
                  <button
                    onClick={() => {
                      setOrderToDeliver(activeNavOrder);
                      setShowDeliverModal(true);
                      setShowNavMap(false);
                    }}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                  >
                    Finish & Mark Delivered
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
