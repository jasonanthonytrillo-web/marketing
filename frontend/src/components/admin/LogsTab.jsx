import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs();
      setLogs(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('cancel') || act.includes('deactivate')) return 'bg-red-50 text-red-600 border-red-100';
    if (act.includes('create') || act.includes('add')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (act.includes('update') || act.includes('edit')) return 'bg-amber-50 text-amber-600 border-amber-100';
    if (act.includes('login')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-medium">Loading security logs...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="font-heading text-3xl font-black text-slate-900 tracking-tight">Security Audit Logs</h2>
          <p className="text-slate-500 font-medium">Track every sensitive action across the system.</p>
        </div>
        <button onClick={loadData} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-6 w-48">When</th>
                <th className="p-6 w-56">Who</th>
                <th className="p-6 w-40">Action</th>
                <th className="p-6">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6 text-slate-400 font-medium whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 uppercase">
                        {(log.user?.name || 'S')[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{log.user?.name || 'System'}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">{log.user?.role || 'system'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-colors ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {log.details || `Performed ${log.action} on ${log.entityType} (${log.entityId})`}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="opacity-50">{log.entityType}:</span>
                        <span>{log.entityId}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-20 text-center">
                    <div className="text-5xl mb-4">📝</div>
                    <p className="text-slate-400 font-medium">No activity logs recorded yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
