const jwt = require('jsonwebtoken');

module.exports = (io, prisma) => {
  // Middleware to authenticate the connection (if token is provided)
  io.use(async (socket, next) => {
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // Fallback: look for pos_token in cookie headers if possible
    if (!token && socket.request.headers?.cookie) {
      try {
        const cookies = socket.request.headers.cookie.split(';').map(c => c.trim());
        const posTokenCookie = cookies.find(c => c.startsWith('pos_token='));
        if (posTokenCookie) {
          token = decodeURIComponent(posTokenCookie.split('=')[1]);
        }
      } catch (err) {
        // Non-critical cookie parsing failure
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        if (userId) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user && user.active) {
            socket.user = user;
          }
        }
      } catch (err) {
        console.warn(`🛑 Invalid token during connection handshake: ${err.message}`);
        // Do not block connection; let them connect as a guest
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`📱 Client connected: ${socket.id}`);

    // Join specific rooms based on module (Secure)
    socket.on('join', async (room) => {
      // Security: Only allow joining sensitive rooms if authenticated
      if (room.includes('cashier') || room.includes('kitchen') || room.includes('admin')) {
        const user = socket.user;
        if (!user) {
          console.warn(`🛑 Unauthorized join attempt: No verified user session for ${room}`);
          return;
        }

        // Verify user belongs to this tenant room
        if (room.includes(`tenant-${user.tenantId}`)) {
          socket.join(room);
          console.log(`👤 Verified: ${user.name} joined room: ${room}`);
        } else if (user.role === 'superadmin') {
          socket.join(room);
          console.log(`👤 Superadmin joined room: ${room}`);
        } else {
          console.warn(`🛑 Cross-tenant join blocked: ${user.name} tried to join ${room}`);
        }
      } else {
        // Public rooms (queue, kiosk, etc.)
        socket.join(room);
        console.log(`👤 Guest joined room: ${room}`);
      }
    });

    // Leave room
    socket.on('leave', (room) => {
      socket.leave(room);
    });

    socket.on('join_visitor', (tenantId) => {
      const room = `tenant-${tenantId}-visitors`;
      socket.join(room);
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(`tenant-${tenantId}-admin`).emit('live_visitors_update', { count });
    });

    socket.on('leave_visitor', (tenantId) => {
      const room = `tenant-${tenantId}-visitors`;
      socket.leave(room);
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(`tenant-${tenantId}-admin`).emit('live_visitors_update', { count });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.endsWith('-visitors')) {
          const parts = room.split('-');
          if (parts.length >= 3) {
            const tenantId = parts[1];
            // Subtract 1 because socket is leaving right after this event
            const count = Math.max(0, (io.sockets.adapter.rooms.get(room)?.size || 1) - 1);
            io.to(`tenant-${tenantId}-admin`).emit('live_visitors_update', { count });
          }
        }
      }
    });

    socket.on('rider_location_update', async (data) => {
      const { orderNumber, tenantId, lat, lng } = data;
      if (!orderNumber || !tenantId) return;

      // Enforce rider location updates to be authenticated
      const user = socket.user;
      if (!user || (user.tenantId !== tenantId && user.role !== 'superadmin')) {
        console.warn(`🛑 Blocked unauthorized rider location update by ${user ? user.name : 'Guest'} for tenant ${tenantId}`);
        return;
      }
      
      const payload = {
        orderNumber,
        lat,
        lng,
        timestamp: new Date().toISOString()
      };
      
      // Persist to DB for initial load or background recovery
      try {
        await prisma.order.update({
          where: { orderNumber: orderNumber.toString() },
          data: { lastRiderLat: lat, lastRiderLng: lng }
        });
      } catch (err) {
        console.error('Failed to persist rider location:', err);
      }
      
      // Emit to the specific order room so the customer can see it
      io.to(`tenant-${tenantId}-order-${orderNumber}`).emit('rider_location_update', payload);
      // Also emit to kiosk room for dashboard monitoring
      io.to(`tenant-${tenantId}-kiosk`).emit('rider_location_update', payload);
    });

    socket.on('disconnect', () => {
      console.log(`📴 Client disconnected: ${socket.id}`);
    });
  });

  // Helper: broadcast order update to all relevant modules
  io.emitOrderUpdate = (order, eventType) => {
    const payload = { order, eventType, timestamp: new Date().toISOString() };
    const tId = order.tenantId;
    
    // Notify all modules in this tenant's private rooms
    io.to(`tenant-${tId}-cashier`).emit('order_update', payload);
    io.to(`tenant-${tId}-kitchen`).emit('order_update', payload);
    io.to(`tenant-${tId}-queue`).emit('order_update', payload);
    io.to(`tenant-${tId}-kiosk`).emit('order_update', payload);
    io.to(`tenant-${tId}-admin`).emit('order_update', payload);
    
    // For specific order tracking page
    io.to(`tenant-${tId}-order-${order.orderNumber}`).emit('order_update', payload);
    
    // For specific customer's logged-in devices
    if (order.customerId) {
      io.to(`tenant-${tId}-user-${order.customerId}`).emit('order_update', payload);
    }
  };

  // Helper: send notification to a specific module
  io.emitNotification = (module, notification, tenantId) => {
    const targetRoom = tenantId ? `tenant-${tenantId}-${module}` : module;
    io.to(targetRoom).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  };

  // Helper: broadcast new order to cashier
  io.emitNewOrder = (order) => {
    const tId = order.tenantId;
    io.to(`tenant-${tId}-cashier`).emit('new_order', {
      order,
      timestamp: new Date().toISOString()
    });
    io.to(`tenant-${tId}-admin`).emit('new_order', {
      order,
      timestamp: new Date().toISOString()
    });
  };

  // Helper: broadcast to kitchen when order is confirmed
  io.emitKitchenOrder = (order) => {
    const tId = order.tenantId;
    io.to(`tenant-${tId}-kitchen`).emit('new_kitchen_order', {
      order,
      timestamp: new Date().toISOString()
    });
  };

  // Helper: broadcast queue update
  io.emitQueueUpdate = (data, tenantId) => {
    const targetRoom = tenantId ? `tenant-${tenantId}-queue` : 'queue';
    io.to(targetRoom).emit('queue_update', {
      ...data,
      timestamp: new Date().toISOString()
    });
  };

  // Helper: notify specific user about loyalty update
  io.emitLoyaltyUpdate = (userId, points, tenantId) => {
    const targetRoom = tenantId ? `tenant-${tenantId}-user-${userId}` : `user-${userId}`;
    io.to(targetRoom).emit('loyalty_updated', {
      userId,
      points,
      timestamp: new Date().toISOString()
    });
  };

  // Helper: send payment request to kiosk
  io.emitPaymentRequest = (order, tenant, mayaQr, method) => {
    const tId = order.tenantId;
    const payload = {
      orderNumber: order.orderNumber,
      amount: order.total,
      gcashQr: tenant.gcashQr,
      mayaQr: mayaQr,
      method: method || 'gcash',
      timestamp: new Date().toISOString()
    };
    io.to(`tenant-${tId}-kiosk`).emit('payment_request', payload);
    // Also notify specific order page
    io.to(`tenant-${tId}-order-${order.orderNumber}`).emit('payment_request', payload);
  };
  
  // Helper: broadcast rider arrival
  io.emitRiderArrival = (order) => {
    const tId = order.tenantId;
    const payload = {
      orderNumber: order.orderNumber,
      timestamp: new Date().toISOString()
    };
    // Emit to specific order room
    io.to(`tenant-${tId}-order-${order.orderNumber}`).emit('rider_arrived', payload);
    // Also emit to kiosk room as fallback
    io.to(`tenant-${tId}-kiosk`).emit('rider_arrived', payload);
  };
};
