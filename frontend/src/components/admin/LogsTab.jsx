import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { Search, SearchX } from 'lucide-react';
import PaginationControls from './PaginationControls';

const settingLabels = {
  points_rate: 'Points rate',
  tenant_assets: 'Landing page media',
  tenant_slug: 'Store URL',
  seasonal_effect: 'Seasonal effect',
  landing_description: 'Landing page message',
  saDeliveryDisabled: 'Delivery service',
  saRewardsDisabled: 'Rewards program',
  custom_badges: 'Custom badges',
  total_visits: 'Site visits',
  storeLat: 'Store latitude',
  storeLng: 'Store longitude',
  tenant_name: 'Store name',
  tenant_logo: 'Store logo',
  tenant_favicon: 'Store favicon',
  tenant_og_image: 'Social sharing image',
  tenant_banner: 'Store banner',
  primary_color: 'Primary color',
  secondary_color: 'Secondary color'
};

const humanizeSetting = (key) => settingLabels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());

const formatLogDetails = (log) => {
  if (log.action === 'update_settings' && log.details) {
    const settingText = log.details.split(':').slice(1).join(':').trim();
    const keys = settingText.split(',').map(key => key.trim()).filter(Boolean);
    if (keys.length > 0) {
      const visibleKeys = keys.slice(0, 4).map(humanizeSetting).join(', ');
      const remainingCount = keys.length - 4;
      return `Updated store settings: ${visibleKeys}${remainingCount > 0 ? `, and ${remainingCount} more` : ''}.`;
    }
    return 'Updated store settings and branding.';
  }

  if (log.details) return log.details;
  return `Performed ${log.action.replace(/_/g, ' ')} on ${log.entityType} (${log.entityId || 'N/A'})`;
};

export default function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Interactive Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    loadData();
  }, [page, searchQuery, actionFilter, roleFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page, limit: 10, search: searchQuery, action: actionFilter, role: roleFilter });
      setLogs(res.data.data);
      setPagination(res.data.meta || { total: res.data.data.length, totalPages: 1 });
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
    if (act.includes('kitchen')) return 'bg-sky-50 text-sky-600 border-sky-100';
    if (act.includes('confirm') || act.includes('placed') || act.includes('served')) return 'bg-teal-50 text-teal-600 border-teal-100';
    if (act.includes('rider') || act.includes('delivery')) return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  // Server-side filters are authoritative; this keeps the view safe with older API responses too.
  const filteredLogs = logs.filter(log => {
    // 1. Search Query Match
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (log.user?.name || '').toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      (log.details || '').toLowerCase().includes(searchLower) ||
      (log.entityType || '').toLowerCase().includes(searchLower) ||
      (log.entityId || '').toLowerCase().includes(searchLower);

    // 2. Action Category Match
    let matchesAction = true;
    if (actionFilter !== 'all') {
      const act = log.action.toLowerCase();
      if (actionFilter === 'orders') {
        matchesAction = act.includes('order') || act.includes('confirm') || act.includes('cancel');
      } else if (actionFilter === 'kitchen') {
        matchesAction = act.includes('kitchen') || act.includes('served');
      } else if (actionFilter === 'security') {
        matchesAction = act.includes('login') || act.includes('password');
      } else if (actionFilter === 'catalog') {
        matchesAction = act.includes('product') || act.includes('category');
      } else if (actionFilter === 'delivery') {
        matchesAction = act.includes('rider') || act.includes('delivery');
      }
    }

    // 3. User Role Match
    let matchesRole = true;
    if (roleFilter !== 'all') {
      matchesRole = (log.user?.role || '').toLowerCase() === roleFilter.toLowerCase();
    }

    return matchesSearch && matchesAction && matchesRole;
  });

  if (loading) return <div className="p-20 text-center text-slate-400 font-medium animate-pulse">Loading security logs...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6 sm:mb-8">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Security Audit Logs</h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base">Track cashier payments, kitchen updates, rider deliveries, and logins in real-time.</p>
        </div>
      </div>

      {/* Premium Interactive Filters Block */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 bg-slate-50/50 p-4 sm:p-6 rounded-[28px] border border-slate-100">
        <div className="flex-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Search Logs</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"><Search className="w-4 h-4" /></span>
            <input 
              type="text" 
              placeholder="Search by staff name, order details, action name..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white font-bold text-sm shadow-sm transition-all"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-96">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Action Type</label>
            <select 
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white font-bold text-sm shadow-sm transition-all cursor-pointer"
            >
              <option value="all">All Events</option>
              <option value="orders">Orders & Cashier</option>
              <option value="kitchen">Kitchen Tasks</option>
              <option value="security">Logins & Security</option>
              <option value="catalog">Product Catalog</option>
              <option value="delivery">Delivery & Riders</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Staff Role</label>
            <select 
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white font-bold text-sm shadow-sm transition-all cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="cashier">Cashier Staff</option>
              <option value="kitchen">Kitchen Staff</option>
              <option value="rider">Rider / Delivery</option>
              <option value="customer">Customer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hidden lg:block bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
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
              {filteredLogs.map(log => (
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
                        {formatLogDetails(log)}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="opacity-50">{log.entityType}:</span>
                        <span>{log.entityId}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-20 text-center flex flex-col items-center">
                    <div className="mb-4"><SearchX className="w-12 h-12 text-slate-300" /></div>
                    <p className="text-slate-400 font-bold text-lg mb-1">No matching activity logs found.</p>
                    <p className="text-slate-400 text-xs">Try relaxing your search query or dropdown filters!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} totalPages={pagination.totalPages} total={pagination.total} itemCount={filteredLogs.length} onPageChange={setPage} />
      </div>

      {/* Stacked cards keep each event readable on tablets and phones. */}
      <div className="lg:hidden space-y-3">
        {filteredLogs.map(log => (
          <article key={log.id} className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500 uppercase shrink-0">
                  {(log.user?.name || 'S')[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{log.user?.name || 'System'}</div>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{log.user?.role || 'system'}</div>
                </div>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${getActionColor(log.action)}`}>
                {log.action.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-slate-700 font-medium leading-relaxed text-sm">
                {formatLogDetails(log)}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                <span>{formatDate(log.createdAt)}</span>
                <span><span className="opacity-50">{log.entityType}:</span> {log.entityId || 'N/A'}</span>
              </div>
            </div>
          </article>
        ))}
        {filteredLogs.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
            <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-lg mb-1">No matching activity logs found.</p>
            <p className="text-slate-400 text-xs">Try relaxing your search query or dropdown filters.</p>
          </div>
        )}
        <PaginationControls page={page} totalPages={pagination.totalPages} total={pagination.total} itemCount={filteredLogs.length} onPageChange={setPage} />
      </div>
    </div>
  );
}
