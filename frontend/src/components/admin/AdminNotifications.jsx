import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Clock3, MessageSquare, MonitorCheck, PackageX, Tag, ArrowUpRight } from 'lucide-react';
import { getAdminNotifications } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const notificationIcons = {
  low_stock: PackageX,
  staff_time_in: Clock3,
  staff_time_out: Clock3,
  authorized_device: MonitorCheck,
  feedback: MessageSquare,
  promo_ending: Tag,
  promo_limit: Tag
};

const formatTime = (value) => {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function AdminNotifications({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`admin_notification_reads_${userId}`) || '[]');
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);
  const { onEvent } = useSocket();

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getAdminNotifications();
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to load admin notifications:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const unsubscribeUpdate = onEvent('admin_notification_update', loadNotifications);
    const unsubscribeFeedback = onEvent('new_feedback', loadNotifications);
    return () => {
      unsubscribeUpdate();
      unsubscribeFeedback();
    };
  }, [onEvent, loadNotifications]);

  useEffect(() => {
    localStorage.setItem(`admin_notification_reads_${userId}`, JSON.stringify(readIds.slice(-100)));
  }, [readIds, userId]);

  const unreadCount = useMemo(
    () => notifications.filter(notification => !readIds.includes(notification.id)).length,
    [notifications, readIds]
  );

  const handleNotificationClick = (notification) => {
    setReadIds(current => current.includes(notification.id) ? current : [...current, notification.id]);
    setOpen(false);
    onNavigate(notification.tab);
  };

  const markAllRead = () => setReadIds(current => [
    ...new Set([...current, ...notifications.map(notification => notification.id)])
  ]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen(current => !current)}
        className="relative rounded-xl border border-surface-200 bg-white p-2.5 text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-red-500 px-1 text-[10px] font-black leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
              <div>
                <h3 className="font-heading font-black text-surface-900">Notifications</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">Admin alerts</p>
              </div>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-bold text-primary-600 hover:text-primary-700">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[min(70vh,480px)] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Bell className="mx-auto mb-3 h-8 w-8 text-surface-200" />
                  <p className="text-sm font-bold text-surface-500">You’re all caught up.</p>
                  <p className="mt-1 text-xs text-surface-400">New admin alerts will appear here.</p>
                </div>
              ) : notifications.map(notification => {
                const Icon = notificationIcons[notification.type] || Bell;
                const isRead = readIds.includes(notification.id);
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full items-start gap-3 border-b border-surface-50 px-4 py-3 text-left transition-colors hover:bg-surface-50 ${isRead ? 'opacity-60' : ''}`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${isRead ? 'bg-surface-100 text-surface-500' : 'bg-primary-50 text-primary-600'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-surface-900">{notification.title}</span>
                        {!isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-surface-600">{notification.message}</span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                        {formatTime(notification.timestamp)} <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
