import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  const [token, setToken] = useState(localStorage.getItem('pos_token'));

  useEffect(() => {
    const handleStorage = () => setToken(localStorage.getItem('pos_token'));
    window.addEventListener('storage', handleStorage);
    // Also poll slightly or provide a way to update it
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
        // Strip trailing /api
        url = apiURL.replace(/\/api$/, '').replace(/\/api\/$/, '');
      }
    }
    if (!url) {
      // Fallback to origin
      url = window.location.origin;
    }
    // Ensure the WS URL uses ws/wss if absolute, otherwise let io handles it
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (url.startsWith('/')) {
      // Relative path, socket.io handles it automatically relative to host
      url = window.location.origin.replace(/^http/, 'ws');
    }
    
    console.log(`🔌 Initializing Secure WebSocket connection at: ${url}...`);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io(url, { 
      auth: { token },
      transports: ['websocket', 'polling'], 
      reconnection: true, 
      reconnectionDelay: 2000 
    });
    
    socketRef.current = newSocket;

    // Heartbeat to keep Render.com connection alive
    const heartbeatInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping_heartbeat');
      }
    }, 25000);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket Connected (Secure)');
      setConnected(true);
      // Rejoin rooms on reconnect
      joinedRoomsRef.current.clear();
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket Disconnected');
      setConnected(false);
    });

    return () => { 
      clearInterval(heartbeatInterval);
      if (newSocket) {
        console.log('🔌 Disconnecting WebSocket...');
        newSocket.disconnect();
        socketRef.current = null;
        joinedRoomsRef.current.clear();
      }
    };
  }, [token]);


  const joinRoom = (room, tenantId) => { 
    if (socketRef.current && connected) {
      const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
      if (!joinedRoomsRef.current.has(roomName)) {
        socketRef.current.emit('join', roomName);
        joinedRoomsRef.current.add(roomName);
        console.log(`📡 Joining room: ${roomName}`);
      }
    }
  };

  const leaveRoom = (room, tenantId) => { 
    if (socketRef.current && connected) {
      const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
      socketRef.current.emit('leave', roomName);
      joinedRoomsRef.current.delete(roomName);
      console.log(`🔌 Leaving room: ${roomName}`);
    }
  };

  const onEvent = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      return () => {
        if (socketRef.current) socketRef.current.off(event, callback);
      };
    }
    return () => {};
  };

  return (
    <SocketContext.Provider value={{ connected, joinRoom, leaveRoom, onEvent }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
