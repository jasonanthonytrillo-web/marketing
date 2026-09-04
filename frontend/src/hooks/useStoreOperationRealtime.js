import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

// Keeps customer-facing store operation flags synchronized with admin settings.
export default function useStoreOperationRealtime(branding, setBranding) {
  const { joinRoom, leaveRoom, connected, onEvent } = useSocket();

  useEffect(() => {
    if (!branding?.id || !connected) return undefined;

    joinRoom('store', branding.id);
    const unsubscribe = onEvent('store_operation_updated', (operationState) => {
      setBranding(current => current ? { ...current, ...operationState } : current);
    });

    return () => {
      unsubscribe();
      leaveRoom('store', branding.id);
    };
  }, [branding?.id, connected, joinRoom, leaveRoom, onEvent, setBranding]);
}
