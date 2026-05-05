import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { playNotificationSound } from '../utils/helpers';

export default function GlobalThankYou() {
  const [showThankYou, setShowThankYou] = useState(false);
  const { onEvent, joinRoom } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');

  useEffect(() => {
    const initThankYou = async () => {
      let roomId = 'global';
      
      if (tenantSlug) {
        try {
          const { getPublicTenant } = await import('../services/api');
          const res = await getPublicTenant(tenantSlug);
          if (res.data.success) {
            roomId = res.data.data.id;
          }
        } catch (e) {
          console.error('Failed to resolve tenant for thank you screen:', e);
        }
      }

      joinRoom('kiosk', roomId);
    };

    initThankYou();

    if (!onEvent) return;

    const unsub = onEvent('order_update', (data) => {
      const order = data.order;
      if (!order) return;

      if (order.status === 'completed') {
        const activeOrdersKey = tenantSlug ? `${tenantSlug}_active_orders` : 'active_orders';
        const lastOrderKey = tenantSlug ? `${tenantSlug}_last_order_number` : 'last_order_number';
        
        const activeOrders = JSON.parse(localStorage.getItem(activeOrdersKey) || '[]');
        
        // Check if this completed order is one of the kiosk's active orders
        if (activeOrders.includes(order.orderNumber)) {
          // Remove from local storage
          const updatedOrders = activeOrders.filter(num => num !== order.orderNumber);
          localStorage.setItem(activeOrdersKey, updatedOrders.length > 0 ? JSON.stringify(updatedOrders) : '[]');
          if (updatedOrders.length === 0) localStorage.removeItem(activeOrdersKey);
          
          if (localStorage.getItem(lastOrderKey) === order.orderNumber) {
            localStorage.removeItem(lastOrderKey);
          }

          // Show the global thank you screen
          setShowThankYou(true);
          playNotificationSound('success'); // optional success chime

          // After 5 seconds, hide the screen and navigate home
          setTimeout(() => {
            setShowThankYou(false);
            const homePath = tenantSlug ? `/?tenant=${tenantSlug}` : '/';
            navigate(homePath);
          }, 5000);
        }
      }
    });

    return () => unsub();
  }, [onEvent, joinRoom, navigate]);

  if (!showThankYou) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white animate-fade-in">
      <div className="text-center p-8 animate-scale-in">
        <div className="text-8xl mb-6">🎉</div>
        <h1 className="font-heading text-4xl sm:text-6xl font-black text-slate-900 mb-4">
          Thank You!
        </h1>
        <p className="text-xl text-slate-600 mb-8 font-medium">
          We hope you enjoy your meal.<br/>See you again soon!
        </p>
        <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full mb-8 animate-pulse"></div>
        <p className="text-sm text-slate-400">Returning to home screen...</p>
      </div>
    </div>
  );
}
