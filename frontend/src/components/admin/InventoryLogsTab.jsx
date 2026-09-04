import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/helpers';
import { getInventoryLogs } from '../../services/api';
import PaginationControls from './PaginationControls';

export default function InventoryLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getInventoryLogs(page, 10);
      setLogs(res.data.data);
      setPagination(res.data.meta || { total: res.data.data.length, totalPages: 1 });
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
                  <td className="p-4 font-bold text-surface-900">
                    <span className="flex items-center gap-2">
                       {log.product?.name || log.rawIngredient?.name}
                       {log.rawIngredient?.name && (
                         <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700">Raw</span>
                       )}
                    </span>
                  </td>
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
        <PaginationControls page={page} totalPages={pagination.totalPages} total={pagination.total} itemCount={logs.length} onPageChange={setPage} />
      </div>
    </div>
  );
}
