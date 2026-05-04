import { useState, useEffect } from 'react';
import { getAdminOrders } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadOrders();
  }, [status, page]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await getAdminOrders(status, page);
      setOrders(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'preparing': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-surface-100 text-surface-700';
    }
  };

  if (loading && orders.length === 0) return <div className="p-8 text-center text-surface-500">Loading orders...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Order Management</h2>
        <div className="flex gap-2">
          {['all', 'pending', 'preparing', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${status === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-white text-surface-500 border border-surface-200 hover:bg-surface-50'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold text-surface-400 uppercase tracking-widest">
              <th className="p-4">Order #</th>
              <th className="p-4">Date</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Total</th>
              <th className="p-4">Status</th>
              <th className="p-4">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 text-sm">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-surface-50 transition-colors group">
                <td className="p-4">
                  <span className="font-mono font-bold text-surface-900">#{order.orderNumber}</span>
                </td>
                <td className="p-4 text-surface-500">{formatDate(order.createdAt)}</td>
                <td className="p-4">
                  <div className="font-bold text-surface-900">{order.customerName || 'Guest'}</div>
                  <div className="text-[10px] text-surface-400 uppercase font-black">{order.orderType || 'Dine-in'}</div>
                </td>
                <td className="p-4 font-black text-surface-900">{formatCurrency(order.total)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-xs font-medium text-surface-600 capitalize">{order.paymentMethod || 'Cash'}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan="6" className="p-12 text-center text-surface-400">No orders found for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
