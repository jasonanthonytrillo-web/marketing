import { useState, useEffect } from 'react';
import { getStaff, updateStaff, deleteStaff, createStaff } from '../../services/api';

export default function StaffTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('staff'); // staff, customer
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'cashier' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getStaff();
      setUsers(res.data.data);
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
      await createStaff(formData);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user, newRole) => {
    if (!confirm(`Change role of ${user.name} to ${newRole}?`)) return;
    try {
      await updateStaff(user.id, { role: newRole });
      loadData();
    } catch (error) {
      alert('Failed to update role');
    }
  };

  const handleDeactivate = async (user) => {
    if (!confirm(`Deactivate ${user.name}? They will lose access.`)) return;
    try {
      await deleteStaff(user.id);
      loadData();
    } catch (error) {
      alert('Failed to deactivate');
    }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'customer') return u.role === 'customer';
    return u.role !== 'customer';
  });

  if (loading) return <div className="p-8 text-center text-surface-500">Loading directory...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="font-heading text-3xl font-black text-slate-900 tracking-tight">User Management</h2>
          <p className="text-slate-500 font-medium">Manage your team and loyalty members.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2"
        >
          <span>➕</span> Add New User
        </button>
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setFilter('staff')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Staff Members
        </button>
        <button 
          onClick={() => setFilter('customer')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Loyalty Customers
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-6">User Info</th>
                <th className="p-6">Role</th>
                {filter === 'customer' && <th className="p-6">Points</th>}
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">
                        {user.role === 'customer' ? '👤' : '🛠️'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    {user.role === 'customer' ? (
                      <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">Customer</span>
                    ) : (
                      <select 
                        value={user.role} 
                        onChange={e => handleRoleChange(user, e.target.value)}
                        className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 cursor-pointer hover:text-primary-600 transition-colors"
                      >
                        <option value="admin">Admin</option>
                        <option value="cashier">Cashier</option>
                        <option value="kitchen">Kitchen</option>
                      </select>
                    )}
                  </td>
                  {filter === 'customer' && (
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-500 font-black">💎 {Math.floor(user.points || 0)}</span>
                      </div>
                    </td>
                  )}
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${user.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    {user.active && user.role !== 'admin' && (
                      <button 
                        onClick={() => handleDeactivate(user)} 
                        className="text-red-400 hover:text-red-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={filter === 'customer' ? 5 : 4} className="p-20 text-center">
                    <div className="text-4xl mb-4">👥</div>
                    <p className="text-slate-400 font-medium">No {filter}s found in the directory.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-bounce-in" onClick={e => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900">Add New User</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
                  <input 
                    type="email" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Temporary Password</label>
                  <input 
                    type="password" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">System Role</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all appearance-none"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="admin">System Admin</option>
                    <option value="customer">Loyalty Customer</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest mt-4 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
