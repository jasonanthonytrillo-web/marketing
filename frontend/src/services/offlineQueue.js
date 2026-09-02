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

const isAlreadyPaid = (error) =>
  error?.response?.status === 400 && /already been processed/i.test(error.response?.data?.message || '');

const isRetryableNetworkError = (error) => !error?.response || !navigator.onLine;

// Sends one complete sale at a time so stock and payment order remain predictable.
export const syncOfflineOrders = async (createOrder, confirmOrder) => {
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
