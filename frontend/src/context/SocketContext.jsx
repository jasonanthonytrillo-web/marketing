import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  const eventListenersRef = useRef(new Map()); // Map<event, Set<callback>>

  const [token, setToken] = useState(localStorage.getItem('pos_token'));

  useEffect(() => {
    const handleStorage = () => setToken(localStorage.getItem('pos_token'));
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 2000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Robust WebSocket URL Fallback resolution
    let url = import.meta.env.VITE_WS_URL;
    if (!url) {
      const apiURL = import.meta.env.VITE_API_URL;
      if (apiURL) {
        // Strip trailing /api or /api/
        url = apiURL.replace(/\/api\/?$/, '');
      }
    }
    if (!url) {
      url = window.location.origin;
    }
    
    // Ensure standard http:// or https:// for socket.io client (do not convert to ws/wss)
    if (url.startsWith('ws://')) {
      url = url.replace('ws://', 'http://');
    } else if (url.startsWith('wss://')) {
      url = url.replace('wss://', 'https://');
    }
    
    console.log(`🔌 Initializing WebSocket connection to: ${url}...`);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io(url, { 
      auth: { token: token || localStorage.getItem('pos_token') },
      withCredentials: true,
      transports: ['websocket', 'polling'], 
      reconnection: true, 
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    socketRef.current = newSocket;

    // Attach all tracked event listeners to the new socket
    eventListenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        newSocket.on(event, callback);
      });
    });

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (newSocket && newSocket.connected) {
        newSocket.emit('ping_heartbeat');
      }
    }, 25000);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket Connected (ID:', newSocket.id, ')');
      setConnected(true);
      
      // Rejoin all tracked rooms on connect/reconnect
      joinedRoomsRef.current.forEach(roomName => {
        newSocket.emit('join', roomName);
        console.log(`📡 Joined room on connect: ${roomName}`);
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket Disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket Connect Error:', err.message);
    });

    return () => { 
      clearInterval(heartbeatInterval);
      if (newSocket) {
        console.log('🔌 Disconnecting WebSocket...');
        newSocket.disconnect();
      }
    };
  }, [token]);

  const joinRoom = useCallback((room, tenantId) => { 
    if (!room) return;
    const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
    joinedRoomsRef.current.add(roomName);
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join', roomName);
      console.log(`📡 Emitted join for room: ${roomName}`);
    } else {
      console.log(`📡 Queued room to join on connect: ${roomName}`);
    }
  }, []);

  const leaveRoom = useCallback((room, tenantId) => { 
    if (!room) return;
    const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
    joinedRoomsRef.current.delete(roomName);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave', roomName);
      console.log(`🔌 Left room: ${roomName}`);
    }
  }, []);

  const onEvent = useCallback((event, callback) => {
    if (!event || !callback) return () => {};

    // Track listener in ref map so it persists across socket instances
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event).add(callback);

    // Attach to current socket if available
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }

    // Return cleanup function
    return () => {
      if (eventListenersRef.current.has(event)) {
        eventListenersRef.current.get(event).delete(callback);
        if (eventListenersRef.current.get(event).size === 0) {
          eventListenersRef.current.delete(event);
        }
      }
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ connected, joinRoom, leaveRoom, onEvent, emit, socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
