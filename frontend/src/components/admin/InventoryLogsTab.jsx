import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function InventoryLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/inventory/logs');
      setLogs(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'restock': return 'bg-emerald-100 text-emerald-700';
      case 'order': return 'bg-blue-100 text-blue-700';
      case 'waste': return 'bg-red-100 text-red-700';
      case 'adjustment': return 'bg-amber-100 text-amber-700';
      default: return 'bg-surface-100 text-surface-700';
    }
  };

  if (loading && logs.length === 0) return <div className="p-8 text-center text-surface-500">Loading stock history...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Stock History</h2>
        <p className="text-surface-500 text-sm">Every stock change is recorded here for accountability.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold text-surface-400 uppercase tracking-widest">
                <th className="p-4">Time</th>
                <th className="p-4">Product</th>
                <th className="p-4 text-center">Change</th>
                <th className="p-4 text-center">Type</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-sm">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                  <td className="p-4 text-surface-500">{formatDate(log.createdAt, true)}</td>
                  <td className="p-4 font-bold text-surface-900">{log.product?.name}</td>
                  <td className="p-4 text-center">
                    <span className={`font-black ${log.quantityChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {log.quantityChange > 0 ? '+' : ''}{log.quantityChange}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${getReasonBadge(log.reason)}`}>
                      {log.reason}
                    </span>
                  </td>
                  <td className="p-4 text-surface-600 font-medium">
                    {log.supplier?.name || '-'}
                  </td>
                  <td className="p-4 text-surface-400 font-mono text-xs">
                    {log.referenceId || 'Manual Adjustment'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan="5" className="p-12 text-center text-surface-400 font-bold">No stock logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
