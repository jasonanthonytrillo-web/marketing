import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTenants, createTenant, updateTenant, getBetaApplications } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function SuperAdminDashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tenantToToggle, setTenantToToggle] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '', primaryColor: '#f97316', adminName: '', adminEmail: '', adminPassword: '' });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' or 'applications'

  useEffect(() => {
    if (!user || user.role !== 'superadmin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTenants(), loadApplications()]);
    setLoading(false);
  };

  const loadTenants = async () => {
    try {
      const res = await getTenants();
      setTenants(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadApplications = async () => {
    try {
      const res = await getBetaApplications();
      setApplications(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTenant(formData);
      setShowModal(false);
      setFormData({ name: '', slug: '', primaryColor: '#f97316', adminName: '', adminEmail: '', adminPassword: '' });
      loadTenants();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (tenant) => {
    setTenantToToggle(tenant);
  };

  const confirmToggleStatus = async () => {
    if (!tenantToToggle) return;
    try {
      await updateTenant(tenantToToggle.id, { active: !tenantToToggle.active });
      loadTenants();
      setTenantToToggle(null);
    } catch (error) {
      alert('Failed to update status');
    }
  };

  if (loading && tenants.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading Tenants...</div>;

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar / Bottom Nav (Mobile) */}
      <aside className="w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-r border-white/5 flex flex-col md:h-screen z-30 flex-shrink-0 order-last md:order-first pb-safe">
        {/* Desktop Only Header */}
        <div className="hidden md:block p-8 border-b border-white/5 md:border-0">
          <h1 className="text-2xl font-black tracking-tighter text-indigo-400">SUPERADMIN</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tenant Control Center</p>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto px-2 py-3 md:p-4 gap-2 scrollbar-hide justify-center md:justify-start">
          <button 
            onClick={() => setActiveTab('tenants')}
            className={`flex-1 md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'tenants' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-transparent text-slate-500 hover:text-white hover:bg-white/5'}`}
          >
            <span className="text-xl md:text-lg leading-none">🏢</span>
            <span className="text-[10px] md:text-sm">Manage Tenants</span>
          </button>
          <button 
            onClick={() => setActiveTab('applications')}
            className={`flex-1 md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-xl font-bold transition-all ${activeTab === 'applications' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-transparent text-slate-500 hover:text-white hover:bg-white/5'}`}
          >
            <span className="text-xl md:text-lg leading-none">✉️</span>
            <span className="text-[10px] md:text-sm">Beta Applications</span>
            {applications.length > 0 && <span className="ml-auto bg-red-500 text-[8px] px-1.5 py-0.5 rounded-full">{applications.length}</span>}
          </button>
        </nav>

        {/* Desktop Only Logout */}
        <div className="hidden md:block p-4 border-t border-white/5 mt-auto">
          <button onClick={logoutUser} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden md:h-screen">
        {/* Header */}
        <header className="bg-slate-900 border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-xl border border-indigo-500/20">
              ⚡
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-white leading-tight">
                System Infrastructure
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                SuperAdmin Control
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{user?.name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase">{user?.role}</p>
            </div>
            <div className="flex items-center gap-2 border-l border-white/5 pl-2 sm:pl-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                {user?.name?.charAt(0)}
              </div>
              <button onClick={logoutUser} className="md:hidden p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                <span className="text-xl">🚪</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight">Active Ecosystem</h2>
            <p className="text-slate-400 font-medium mt-1">Overview of all registered POS tenants and their health.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
          >
            <span>➕</span> Provision New Tenant
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-900/50 border border-white/5 p-8 rounded-3xl">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Tenants</p>
            <p className="text-4xl font-black text-white">{tenants.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-white/5 p-8 rounded-3xl">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Active Shops</p>
            <p className="text-4xl font-black text-emerald-400">{tenants.filter(t => t.active).length}</p>
          </div>
          <div className="bg-slate-900/50 border border-white/5 p-8 rounded-3xl">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Deactivated</p>
            <p className="text-4xl font-black text-red-400">{tenants.filter(t => !t.active).length}</p>
          </div>
        </div>

        {/* Tenants Table */}
        {activeTab === 'tenants' ? (
          <div className="bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-6">Store Instance</th>
                    <th className="p-6">Slug / URL</th>
                    <th className="p-6">Usage</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {tenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/10" style={{ backgroundColor: tenant.primaryColor }}>
                            {tenant.logo ? <img src={tenant.logo} className="w-full h-full object-cover rounded-2xl" alt="" /> : tenant.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-white text-base">{tenant.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">ID: #{tenant.id} • Created {formatDate(tenant.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <code className="bg-slate-800 text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold">{tenant.slug}.elevatepos.com</code>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-4">
                          <div className="text-center">
                            <p className="text-xs font-black text-white">{tenant._count?.users || 0}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Users</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-black text-white">{tenant._count?.orders || 0}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Orders</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tenant.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {tenant.active ? 'Healthy' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => toggleStatus(tenant)}
                          className={`font-black text-[10px] uppercase tracking-widest transition-all ${tenant.active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                        >
                          {tenant.active ? 'Deactivate Shop' : 'Activate Shop'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-6">Applicant</th>
                    <th className="p-6">Business Details</th>
                    <th className="p-6">Contact Email</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No applications yet</td>
                    </tr>
                  ) : (
                    applications.map(app => (
                      <tr key={app.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-6">
                          <div>
                            <p className="font-black text-white text-base">{app.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Candidate</p>
                          </div>
                        </td>
                        <td className="p-6 text-white font-bold">{app.businessName}</td>
                        <td className="p-6">
                          <a href={`mailto:${app.email}`} className="text-indigo-400 hover:underline">{app.email}</a>
                        </td>
                        <td className="p-6">
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {app.status}
                          </span>
                        </td>
                        <td className="p-6 text-right text-slate-500 text-xs font-bold">
                          {formatDate(app.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>

      {/* Provision Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-white tracking-tight">Provision Tenant</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-2xl transition-colors">✕</button>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Business Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                    placeholder="e.g. MK Food Corner"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">URL Slug (Unique)</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                    placeholder="e.g. mk-food"
                    value={formData.slug}
                    onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Primary Brand Color</label>
                  <div className="flex gap-4">
                    <input 
                      type="color"
                      className="w-16 h-16 bg-slate-800 border border-white/5 rounded-2xl p-1 cursor-pointer"
                      value={formData.primaryColor}
                      onChange={e => setFormData({...formData, primaryColor: e.target.value})}
                    />
                    <input 
                      type="text"
                      className="flex-1 bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                      value={formData.primaryColor}
                      onChange={e => setFormData({...formData, primaryColor: e.target.value})}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex-1 h-px bg-white/10"></div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Initial Admin Account</span>
                  <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Admin Full Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                    placeholder="e.g. Juan Dela Cruz"
                    value={formData.adminName}
                    onChange={e => setFormData({...formData, adminName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Admin Email</label>
                  <input 
                    type="email" required
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                    placeholder="e.g. admin@mkfood.com"
                    value={formData.adminEmail}
                    onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Admin Password</label>
                  <input 
                    type="password" required minLength={6}
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                    placeholder="Minimum 6 characters"
                    value={formData.adminPassword}
                    onChange={e => setFormData({...formData, adminPassword: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs mt-6 disabled:opacity-50"
                >
                  {saving ? 'Provisioning...' : 'Deploy Tenant Instance'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Modal */}
      {tenantToToggle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-scale-in text-center">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-5 border-4 ${tenantToToggle.active ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
              {tenantToToggle.active ? '⚠️' : '✅'}
            </div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Confirm Action</h3>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Are you sure you want to <span className={`font-bold uppercase tracking-wider ${tenantToToggle.active ? 'text-red-400' : 'text-emerald-400'}`}>{tenantToToggle.active ? 'deactivate' : 'activate'}</span> <br/><span className="text-white font-bold text-lg">{tenantToToggle.name}</span>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setTenantToToggle(null)} 
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={confirmToggleStatus} 
                className={`flex-1 py-3.5 rounded-xl font-bold transition-all text-white text-[10px] uppercase tracking-widest ${tenantToToggle.active ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'}`}
              >
                Yes, {tenantToToggle.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
