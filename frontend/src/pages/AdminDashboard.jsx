import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getAdminSummary } from '../services/api';
import ProductsTab from '../components/admin/ProductsTab';
import CategoriesTab from '../components/admin/CategoriesTab';
import OrdersTab from '../components/admin/OrdersTab';
import InventoryTab from '../components/admin/InventoryTab';
import InventoryLogsTab from '../components/admin/InventoryLogsTab';
import ExpensesTab from '../components/admin/ExpensesTab';
import ReportsTab from '../components/admin/ReportsTab';
import SettingsTab from '../components/admin/SettingsTab';
import PackagesTab from '../components/admin/PackagesTab';
import AuditLogsTab from '../components/admin/LogsTab';
import StaffTab from '../components/admin/StaffTab';
import SuppliersTab from '../components/admin/SuppliersTab';
import FeedbackTab from '../components/admin/FeedbackTab';
import PromosTab from '../components/admin/PromosTab';
import DevicesTab from '../components/admin/DevicesTab';
import ShiftsTab from '../components/admin/ShiftsTab';
import { formatCurrency } from '../utils/helpers';
import { applyTheme, clearTheme } from '../utils/theme';
import { useDynamicBranding } from '../hooks/useDynamicBranding';
import { BarChart2, ShoppingBag, FolderTree, PackageSearch, Users, Truck, Package, RotateCcw, Wallet, LineChart, MessageSquare, ClipboardList, Settings, LogOut, Store, CircleDollarSign, Coins, ShoppingCart, Eye, Globe, Tag, Menu, X, Monitor, Timer } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function AdminDashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveVisitors, setLiveVisitors] = useState(0);
  const [showDrawer, setShowDrawer] = useState(false);
  const { joinRoom, leaveRoom, connected, onEvent } = useSocket();

  // Dynamic favicon & title
  useDynamicBranding('Hometown Brew Admin Dashboard', user?.tenantFavicon || '/favicon.png');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    
    // Apply initial colors
    const initialColor = user.tenantColor || user.tenant?.primaryColor;
    if (initialColor) applyTheme(initialColor);

    loadSummary();
    const pollInterval = setInterval(() => {
      loadSummary(false);
    }, 30000);

    // CLEANUP: Wipe the theme when leaving the dashboard
    return () => {
      clearInterval(pollInterval);
      clearTheme();
    };
  }, [user, navigate]);

  // Listen for live visitor updates via Socket.IO
  useEffect(() => {
    if (user?.tenantId && connected) {
      joinRoom('admin', user.tenantId);
      const unsub = onEvent('live_visitors_update', (data) => {
        setLiveVisitors(data.count || 0);
      });
      return () => {
        unsub();
        leaveRoom('admin', user.tenantId);
      };
    }
  }, [user?.tenantId, connected]);

  const loadSummary = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getAdminSummary();
      const data = res.data.data;
      setSummary(data);
      setLiveVisitors(data.liveVisitors || 0);

      const tenantColor = data.branding?.primaryColor || user?.tenant?.primaryColor || user?.tenantColor;
      if (tenantColor) applyTheme(tenantColor);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const navGroups = [
    {
      label: 'Main',
      items: [
        { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-5 h-5" /> },
        { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-5 h-5" /> },
        { id: 'reports', label: 'Reports', icon: <LineChart className="w-5 h-5" /> },
      ]
    },
    {
      label: 'Catalog',
      items: [
        { id: 'products', label: 'Products', icon: <PackageSearch className="w-5 h-5" /> },
        { id: 'categories', label: 'Categories', icon: <FolderTree className="w-5 h-5" /> },
        { id: 'packages', label: 'Packages', icon: <Store className="w-5 h-5" /> },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { id: 'inventory', label: 'Stock', icon: <Package className="w-5 h-5" /> },
        { id: 'inventory-logs', label: 'History', icon: <RotateCcw className="w-5 h-5" /> },
        { id: 'suppliers', label: 'Suppliers', icon: <Truck className="w-5 h-5" /> },
        { id: 'expenses', label: 'Expenses', icon: <Wallet className="w-5 h-5" /> },
      ]
    },
    {
      label: 'Management',
      items: [
        { id: 'staff', label: 'Staff', icon: <Users className="w-5 h-5" /> },
        { id: 'shifts', label: 'Shifts & Drawer', icon: <Timer className="w-5 h-5" /> },
        { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-5 h-5" /> },
        { id: 'promos', label: 'Promos', icon: <Tag className="w-5 h-5" /> },
        { id: 'devices', label: 'Devices', icon: <Monitor className="w-5 h-5" /> },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'audit', label: 'Logs', icon: <ClipboardList className="w-5 h-5" /> },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
      ]
    }
  ];

  if (loading && !summary) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a3d01] gap-6">
      <img src="/favicon.png" alt="Hometown Brew" className="w-24 h-24 rounded-3xl animate-pulse shadow-[0_0_60px_rgba(255,255,255,0.15)]" />
      <div className="text-center">
        <h1 className="text-white text-[22px] font-black tracking-tight font-heading">Hometown Brew</h1>
        <p className="text-white/50 text-[11px] font-semibold tracking-[3px] uppercase mt-1.5">Bringing home closer</p>
      </div>
      <div className="flex gap-1.5 mt-2">
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.2s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.4s]"></span>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-surface-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 bg-surface-900 text-white flex-col md:h-screen z-30 flex-shrink-0 border-r border-surface-800 pb-safe">
        {/* Desktop Only Header */}
        <div className="flex p-6 border-b border-surface-800 justify-between items-center">
          <h1 className="font-heading text-xl font-black tracking-tight text-white flex items-center gap-2">
            <img src="/hb_logo.jpg" className="w-8 h-8 rounded-lg object-cover" alt="Hometown Brew" onError={(e) => { e.currentTarget.src = '/favicon.png'; }} />
            <span className="truncate">Hometown Brew</span>
          </h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex flex-col overflow-y-auto px-3 py-3 gap-0 scrollbar-hide">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-1 mb-6">
              <span className="block text-[10px] font-black text-surface-500 uppercase tracking-widest px-3 mb-1 mt-1">{group.label}</span>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex flex-row items-center justify-start gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${activeTab === item.id ? 'bg-primary-600/10 bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Drawer Overlay */}
      {showDrawer && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setShowDrawer(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-surface-900 text-white flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto ${showDrawer ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Mobile Drawer Header */}
        <div className="flex p-6 border-b border-surface-800 justify-between items-center flex-shrink-0">
          <h1 className="font-heading text-xl font-black tracking-tight text-white flex items-center gap-2">
            <img src="/hb_logo.jpg" className="w-8 h-8 rounded-lg object-cover" alt="Hometown Brew" onError={(e) => { e.currentTarget.src = '/favicon.png'; }} />
            <span className="truncate">Hometown Brew</span>
          </h1>
          <button 
            onClick={() => setShowDrawer(false)}
            className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Mobile Navigation */}
        <nav className="flex flex-col px-3 py-3 gap-0">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-1 mb-6">
              <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest px-3 mb-1 mt-1">{group.label}</span>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowDrawer(false);
                  }}
                  className={`w-full flex flex-row items-center justify-start gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${activeTab === item.id ? 'bg-primary-600/10 bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden md:h-screen">
        <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-surface-200 bg-white/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="md:hidden p-2 hover:bg-surface-100 rounded-lg transition-colors text-surface-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-heading text-lg md:text-xl font-black text-surface-900 leading-tight">Admin Dashboard</h2>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.25em] text-surface-500 mt-1">
                Hometown Brew Control Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-surface-900">{user?.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-500">{user?.role}</p>
            </div>
            <button
              onClick={logoutUser}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 hover:text-red-700"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'overview' && summary && (
            <div className="animate-fade-in space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-3xl font-black text-surface-900 tracking-tight">Business Intelligence</h2>
                  <p className="text-surface-500 font-medium">Real-time performance metrics for your shop.</p>
                </div>
              </div>
              
              {/* Main KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Today's Revenue" value={formatCurrency(summary.revenue)} icon={<CircleDollarSign className="w-6 h-6" />} color="blue" />
                <StatCard title="Today's Expenses" value={formatCurrency(summary.totalExpenses || 0)} icon={<Coins className="w-6 h-6" />} color="red" />
                <StatCard title="Net Profit" value={formatCurrency((summary.revenue || 0) - (summary.totalExpenses || 0))} icon={<LineChart className="w-6 h-6" />} color="emerald" />
                <StatCard title="Orders Today" value={summary.ordersCount} icon={<ShoppingCart className="w-6 h-6" />} color="purple" />
              </div>

              {/* Visitor Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Globe className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-surface-500 font-bold text-sm mb-1">Total Site Visits</p>
                  <p className="text-3xl font-black text-surface-900 tracking-tight">{(summary.totalVisits || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all group relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${liveVisitors > 0 ? 'bg-green-50 text-green-600' : 'bg-surface-100 text-surface-400'}`}>
                      <Eye className="w-6 h-6" />
                    </div>
                    {liveVisitors > 0 && (
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-surface-500 font-bold text-sm mb-1">Online Right Now</p>
                  <p className="text-3xl font-black text-surface-900 tracking-tight">{liveVisitors}</p>
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
                  <h3 className="font-heading font-bold text-surface-900 mb-6">Sales Performance (Last 14 Days)</h3>
                  <div className="h-[300px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summary.dailySales || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={user?.tenantColor || user?.tenant?.primaryColor || '#f97316'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={user?.tenantColor || user?.tenant?.primaryColor || '#f97316'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(value) => `₱${value}`} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                          itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                          labelStyle={{ fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                          formatter={(value) => [formatCurrency(value), 'Revenue']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={user?.tenantColor || user?.tenant?.primaryColor || '#f97316'} strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
                  <h3 className="font-heading font-bold text-surface-900 mb-6">Top Categories</h3>
                  <div className="space-y-4">
                    {summary.topCategories?.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-surface-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">{i+1}</div>
                          <span className="font-bold text-surface-700">{cat.name}</span>
                        </div>
                        <span className="text-primary-600 font-black">{cat._count.products} <span className="text-[10px] text-surface-400">items</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'packages' && <PackagesTab />}
          {activeTab === 'products' && <ProductsTab />}
          {activeTab === 'staff' && <StaffTab />}
          {activeTab === 'shifts' && <ShiftsTab />}
          {activeTab === 'suppliers' && <SuppliersTab />}
          {activeTab === 'promos' && <PromosTab />}
          {activeTab === 'inventory' && <InventoryTab />}
          {activeTab === 'inventory-logs' && <InventoryLogsTab />}
          {activeTab === 'expenses' && <ExpensesTab />}
          { activeTab === 'reports' && <ReportsTab /> }
          { activeTab === 'feedback' && <FeedbackTab /> }
          { activeTab === 'audit' && <AuditLogsTab /> }
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'devices' && <DevicesTab />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${colors[color]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <p className="text-surface-500 font-bold text-sm mb-1">{title}</p>
      <p className="text-3xl font-black text-surface-900 tracking-tight">{value}</p>
    </div>
  );
}
