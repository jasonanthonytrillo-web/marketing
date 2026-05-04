import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function SocketListener() {
  const { onEvent, joinRoom, leaveRoom, connected } = useSocket();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (user && user.id && user.tenantId) {
      // Join a room specific to this user in this tenant
      const userRoom = `user-${user.id}`;
      joinRoom(userRoom, user.tenantId);

      // Listen for loyalty point updates
      const cleanup = onEvent('loyalty_updated', (data) => {
        console.log('💎 Loyalty points updated!', data);
        refreshUser();
      });

      return () => {
        leaveRoom(userRoom, user.tenantId);
        cleanup();
      };
    }
  }, [user, connected, onEvent, joinRoom, leaveRoom, refreshUser]);

  return null; // This component doesn't render anything
}
