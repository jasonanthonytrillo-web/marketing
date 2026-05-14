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

  const [confirmDelete, setConfirmDelete] = useState(null); // Stores { id, orderNumber } when modal is open

  const handleHardDelete = async () => {
    if (!confirmDelete) return;
    const { id, orderNumber } = confirmDelete;

    try {
      const { hardDeleteOrder } = await import('../../services/api');
      await hardDeleteOrder(id);
      setConfirmDelete(null);
      loadOrders();
    } catch (error) {
      console.error(error);
      alert('Failed to delete order.');
    }
  };

  if (loading && orders.length === 0) return <div className="p-8 text-center text-surface-500">Loading orders...</div>;

  return (
    <div className="animate-fade-in-up">
      {/* Custom Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-surface-100 animate-scale-in animate-float">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center text-4xl mb-6 mx-auto shadow-inner">
              ⚠️
            </div>
            <h3 className="font-heading text-2xl font-black text-center text-surface-900 mb-2">
              PERMANENT DELETE
            </h3>
            <p className="text-center text-surface-500 font-medium mb-8 leading-relaxed">
              Are you sure you want to completely remove <span className="text-surface-900 font-black">Order #{confirmDelete.orderNumber}</span> from the database? This cannot be undone and will affect historical records.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-4 rounded-2xl bg-surface-100 text-surface-600 font-black uppercase tracking-widest text-xs hover:bg-surface-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleHardDelete}
                className="flex-1 px-6 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Order Management</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide -mx-2 px-2">
          {['all', 'pending', 'preparing', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${status === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-white text-surface-500 border border-surface-200 hover:bg-surface-50'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold text-surface-400 uppercase tracking-widest">
                <th className="p-4">Order #</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-sm">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-surface-50 transition-colors group">
                  <td className="p-4">
                    <span className="font-mono font-bold text-surface-900">#{order.orderNumber}</span>
                  </td>
                  <td className="p-4 text-surface-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                  <td className="p-4">
                    <div className="font-bold text-surface-900">{order.customerName || 'Guest'}</div>
                    <div className="text-[10px] text-surface-400 uppercase font-black">{order.orderType || 'Dine-in'}</div>
                  </td>
                  <td className="p-4 font-black text-surface-900">{formatCurrency(order.total)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium text-surface-600 capitalize">{order.paymentMethod || 'Cash'}</span>
                  </td>
                  <td className="p-4 text-right">
                    {order.status === 'cancelled' && (
                      <button 
                        onClick={() => setConfirmDelete({ id: order.id, orderNumber: order.orderNumber })}
                        className="relative px-4 py-2 bg-white text-red-600 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 hover:-translate-y-1 transition-all shadow-md hover:shadow-xl hover:shadow-red-600/20 active:scale-95"
                        title="Permanently Delete Order"
                      >
                        Hard Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="7" className="p-12 text-center text-surface-400">No orders found for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
