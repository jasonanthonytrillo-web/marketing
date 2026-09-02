const ORDER_QUEUE_KEY = 'pos_offline_order_queue_v1';
const MENU_CACHE_KEY = 'pos_cashier_menu_cache_v1';

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const createClientOrderId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const cacheCashierMenu = (categories) => write(MENU_CACHE_KEY, categories);
export const getCachedCashierMenu = () => read(MENU_CACHE_KEY, []);

export const getOfflineOrders = () => read(ORDER_QUEUE_KEY, []);
export const getOfflineOrderCount = () => getOfflineOrders().length;

export const enqueueOfflineOrder = (payload, localOrder) => {
  const queue = getOfflineOrders();
  if (!queue.some(entry => entry.clientOrderId === payload.clientOrderId)) {
    queue.push({
      clientOrderId: payload.clientOrderId,
      payload,
      localOrder,
      queuedAt: new Date().toISOString()
    });
    write(ORDER_QUEUE_KEY, queue);
  }
  return payload.clientOrderId;
};

export const getOfflineOrderRecords = () =>
  getOfflineOrders().map(entry => entry.localOrder).filter(Boolean);

export const isOfflineOrder = (order) =>
  Boolean(order) && getOfflineOrders().some(entry =>
    entry.clientOrderId === order.id || entry.clientOrderId === order.clientOrderId
  );

export const updateOfflineOrder = (clientOrderId, changes) => {
  const queue = getOfflineOrders();
  const entry = queue.find(item => item.clientOrderId === clientOrderId);
  if (!entry) return false;
  entry.localOrder = { ...entry.localOrder, ...changes, updatedAt: new Date().toISOString() };
  entry.payload = {
    ...entry.payload,
    offlineStatus: changes.status,
    prepTime: changes.estimatedPrepTime ?? entry.payload.prepTime
  };
  write(ORDER_QUEUE_KEY, queue);
  return true;
};

const isAlreadyPaid = (error) =>
  error?.response?.status === 400 && /already been processed/i.test(error.response?.data?.message || '');

const isRetryableNetworkError = (error) => !error?.response || !navigator.onLine;

// Sends one complete sale at a time so stock and payment order remain predictable.
export const syncOfflineOrders = async (createOrder, confirmOrder, statusHandlers = {}) => {
  const queue = getOfflineOrders();
  if (!queue.length || !navigator.onLine) return { synced: 0, pending: queue.length };

  let synced = 0;
  for (const entry of queue) {
    try {
      const created = await createOrder(entry.payload);
      const order = created.data.data;
      if (order.paymentStatus !== 'paid') {
        await confirmOrder(order.id, entry.payload.payment);
      }
      const offlineStatus = entry.payload.offlineStatus;
      if (['preparing', 'ready', 'completed'].includes(offlineStatus) && statusHandlers.startPreparing) {
        await statusHandlers.startPreparing(order.id, entry.payload.prepTime || 15);
      }
      if (['ready', 'completed'].includes(offlineStatus) && statusHandlers.completeOrder) {
        await statusHandlers.completeOrder(order.id);
      }
      if (offlineStatus === 'completed' && statusHandlers.markServed) {
        await statusHandlers.markServed(order.id);
      }

      const current = getOfflineOrders().filter(item => item.clientOrderId !== entry.clientOrderId);
      write(ORDER_QUEUE_KEY, current);
      synced += 1;
    } catch (error) {
      if (isAlreadyPaid(error)) {
        write(ORDER_QUEUE_KEY, getOfflineOrders().filter(item => item.clientOrderId !== entry.clientOrderId));
        synced += 1;
        continue;
      }
      if (isRetryableNetworkError(error)) break;
      // Keep validation/stock failures visible for the cashier instead of retrying forever.
      break;
    }
  }

  return { synced, pending: getOfflineOrderCount() };
};
