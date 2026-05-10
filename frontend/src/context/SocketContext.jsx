import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
    const token = localStorage.getItem('pos_token');
    
    console.log('🔌 Initializing Secure WebSocket connection...');
    
    const newSocket = io(url, { 
      auth: { token },
      transports: ['websocket', 'polling'], 
      reconnection: true, 
      reconnectionDelay: 2000 
    });
    
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ WebSocket Connected (Secure)');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket Disconnected');
      setConnected(false);
    });

    return () => { 
      if (newSocket) {
        console.log('🔌 Disconnecting WebSocket...');
        newSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Re-init if token changes would be better, but simple re-init on page refresh works for now

  const joinRoom = (room, tenantId) => { 
    if (socketRef.current && connected) {
      const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
      socketRef.current.emit('join', roomName);
      console.log(`📡 Joining room: ${roomName}`);
    }
  };

  const leaveRoom = (room, tenantId) => { 
    if (socketRef.current && connected) {
      const roomName = tenantId ? `tenant-${tenantId}-${room}` : room;
      socketRef.current.emit('leave', roomName);
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
