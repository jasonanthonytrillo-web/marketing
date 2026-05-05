import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTenants, createTenant, updateTenant } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function SuperAdminDashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', primaryColor: '#f97316' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'superadmin') {
      navigate('/login');
      return;
    }
    loadTenants();
  }, [user, navigate]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await getTenants();
      setTenants(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTenant(formData);
      setShowModal(false);
      setFormData({ name: '', slug: '', primaryColor: '#f97316' });
      loadTenants();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (tenant) => {
    if (!confirm(`Are you sure you want to ${tenant.active ? 'deactivate' : 'activate'} ${tenant.name}?`)) return;
    try {
      await updateTenant(tenant.id, { active: !tenant.active });
      loadTenants();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  if (loading && tenants.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading Tenants...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-white/5 flex flex-col h-screen sticky top-0">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter text-indigo-400">SUPERADMIN</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tenant Control Center</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <span>🏢</span> Manage Tenants
          </button>
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={logoutUser} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
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
    </div>
  );
}
