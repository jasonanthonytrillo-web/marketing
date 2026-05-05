import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getQueue, getPublicTenant } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { playNotificationSound, unlockAudio } from '../utils/helpers';
import { useDynamicBranding } from '../hooks/useDynamicBranding';

export default function QueueDisplay() {
  const [preparing, setPreparing] = useState([]);
  const [ready, setReady] = useState([]);
  const [time, setTime] = useState(new Date());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const [branding, setBranding] = useState(null);
  const prevReadyRef = useRef([]);
  const { joinRoom, onEvent, connected } = useSocket();

  useEffect(() => {
    if (branding?.id) {
      joinRoom('queue', branding.id);
    }
  }, [branding?.id, connected]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, []);

  useEffect(() => {
    if (tenantSlug) {
      getPublicTenant(tenantSlug).then(res => {
        if (res.data.success) setBranding(res.data.data);
      });
    }
  }, [tenantSlug]);

  const brandingColor = branding?.primaryColor || '#f97316';
  const homeLink = tenantSlug ? `/?tenant=${tenantSlug}` : '/';

  const handleStartBoard = () => {
    unlockAudio();
    setAudioUnlocked(true);
    playNotificationSound('default');
  };

  // Dynamic favicon & title
  useDynamicBranding(branding?.name || 'Order Queue', branding?.favicon);

  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('order_update', () => loadQueue());
    const unsub2 = onEvent('queue_update', (data) => {
      if (data.type === 'ready') playNotificationSound('ready');
      loadQueue();
    });
    return () => { unsub(); unsub2(); };
  }, [onEvent]);

  const loadQueue = async () => {
    try {
      const res = await getQueue();
      const data = res.data.data;
      // Check for new ready orders
      const newReady = data.ready.filter(o => !prevReadyRef.current.find(p => p.id === o.id));
      if (newReady.length > 0 && prevReadyRef.current.length > 0) playNotificationSound('ready');
      prevReadyRef.current = data.ready;
      setPreparing(data.preparing);
      setReady(data.ready);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-hidden relative">

      {/* Header */}
      <div className="bg-surface-900/80 border-b border-surface-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to={homeLink} className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-surface-800 hover:bg-surface-700 rounded-full text-xs sm:text-sm font-bold text-surface-300 hover:text-white transition-colors border border-surface-700">
            <span className="text-base sm:text-lg leading-none">←</span> <span className="hidden sm:inline">Back Home</span><span className="sm:hidden">Back</span>
          </Link>
          <span className="text-surface-500 ml-1 hidden sm:inline">|</span>
          <span className="text-surface-400 font-medium hidden sm:inline">{branding?.name || 'Order Queue'}</span>
        </div>
        <div className="text-right">
          <div className="font-heading text-lg sm:text-2xl font-bold text-white tabular-nums">
            {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[10px] sm:text-xs text-surface-500">{time.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Queue Board */}
      <div className="flex flex-col md:grid md:grid-cols-2 h-[calc(100vh-80px)]">
        {/* Now Preparing */}
        <div className="flex-1 md:flex-auto border-b md:border-b-0 md:border-r border-surface-800 p-4 md:p-6 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6 flex-shrink-0">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full animate-pulse" style={{ backgroundColor: brandingColor }} />
            <h2 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: brandingColor }}>Now Preparing</h2>
            <span className="badge text-sm sm:text-base md:text-lg px-2 md:px-3 py-0.5 sm:py-1" style={{ backgroundColor: `${brandingColor}33`, color: brandingColor }}>{preparing.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {preparing.length === 0 ? (
              <div className="flex items-center justify-center h-full text-surface-600 text-lg md:text-xl">No orders being prepared</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 pb-4">
                {preparing.map((order, idx) => (
                  <div key={order.id}
                    className="bg-surface-800/60 border border-surface-700/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center animate-fade-in-up transition-colors"
                    style={{ animationDelay: `${idx * 0.05}s` }}>
                    <p className="queue-number" style={{ color: brandingColor }}>{order.orderNumber.split('-')[1]}</p>
                    <p className="text-surface-400 text-xs sm:text-sm mt-1 sm:mt-2 font-medium truncate">{order.customerName}</p>
                    <span className="inline-block mt-1 sm:mt-2 text-[10px] sm:text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">
                      {order.orderType === 'dine_in' ? '🍽️ Dine In' : '🥡 Take Out'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Now Serving / Ready */}
        <div className="flex-1 md:flex-auto p-4 md:p-6 flex flex-col bg-emerald-950/20 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6 flex-shrink-0">
            <div className="w-3 h-3 md:w-4 md:h-4 bg-emerald-500 rounded-full animate-pulse" />
            <h2 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold text-emerald-400">Now Serving</h2>
            <span className="badge bg-emerald-500/20 text-emerald-300 text-sm sm:text-base md:text-lg px-2 md:px-3 py-0.5 sm:py-1">{ready.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {ready.length === 0 ? (
              <div className="flex items-center justify-center h-full text-surface-600 text-lg md:text-xl">No orders ready</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 pb-4">
                {ready.map((order, idx) => (
                  <div key={order.id}
                    className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center animate-fade-in-up animate-glow"
                    style={{ animationDelay: `${idx * 0.05}s` }}>
                    <p className="queue-number text-emerald-400">{order.orderNumber.split('-')[1]}</p>
                    <p className="text-surface-400 text-xs sm:text-sm mt-1 sm:mt-2 font-medium truncate">{order.customerName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
