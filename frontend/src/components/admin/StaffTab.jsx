import { useState, useEffect } from 'react';
import { getStaff, updateStaff, deleteStaff, createStaff } from '../../services/api';
import { Plus, User, Wrench, Gem, Users, X, Edit2, RotateCcw } from 'lucide-react';

export default function StaffTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('staff'); // staff, customer
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'cashier' });
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', email: '', password: '', role: '' });
  const [updating, setUpdating] = useState(false);

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

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditFormData({ name: user.name, email: user.email, password: '', role: user.role });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const payload = { name: editFormData.name, email: editFormData.email, role: editFormData.role };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }
      await updateStaff(editingUser.id, payload);
      setEditingUser(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleRestore = async (user) => {
    if (!confirm(`Restore access for ${user.name}?`)) return;
    try {
      await updateStaff(user.id, { active: true });
      loadData();
    } catch (error) {
      alert('Failed to restore');
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
          <Plus className="w-4 h-4" /> Add New User
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
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        {user.role === 'customer' ? <User className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
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
                        <option value="rider">Rider</option>
                      </select>
                    )}
                  </td>
                  {filter === 'customer' && (
                    <td className="p-6">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-500 font-black inline-flex items-center gap-1"><Gem className="w-3 h-3" /> {Math.floor(user.points || 0)}</span>
                      </div>
                    </td>
                  )}
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${user.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-3 transition-all">
                      {user.role === 'customer' ? (
                        user.active ? (
                          <button
                            onClick={() => handleDeactivate(user)}
                            className="text-red-400 hover:text-red-600 font-bold text-[11px] uppercase tracking-wider"
                          >
                            Restrict
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(user)}
                            className="text-emerald-500 hover:text-emerald-700 font-bold text-[11px] flex items-center gap-1 uppercase tracking-wider"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-blue-500 hover:text-blue-700 font-medium px-4 py-1.5 bg-blue-50 rounded-lg flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4 mr-1" /> Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={filter === 'customer' ? 5 : 4} className="p-20 text-center flex flex-col items-center">
                    <div className="mb-4"><Users className="w-12 h-12 text-slate-300" /></div>
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
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 flex items-center justify-center"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                  <input
                    type="text" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
                  <input
                    type="email" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Temporary Password</label>
                  <input
                    type="password" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">System Role</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all appearance-none"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="rider">Delivery Rider</option>
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

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-bounce-in" onClick={e => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900">Edit Staff Member</h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 flex items-center justify-center"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                  <input
                    type="text" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
                  <input
                    type="email" required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={editFormData.email}
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">New Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all"
                    value={editFormData.password}
                    onChange={e => setEditFormData({ ...editFormData, password: e.target.value })}
                  />
                  <p className="px-1 mt-1 text-[10px] text-slate-400 font-medium">Only fill this if you want to change their password.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">System Role</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-primary-500 outline-none transition-all appearance-none"
                    value={editFormData.role}
                    onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
                  >
                    <option value="admin">System Admin</option>
                    <option value="cashier">Cashier</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="rider">Delivery Rider</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  {editingUser.role !== 'admin' && (
                    editingUser.active ? (
                      <button
                        type="button"
                        onClick={() => { handleDeactivate(editingUser); setEditingUser(null); }}
                        className="w-1/3 bg-red-50 text-red-600 border border-red-100 font-black py-4 rounded-2xl hover:bg-red-100 transition-all uppercase tracking-widest mt-4"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { handleRestore(editingUser); setEditingUser(null); }}
                        className="w-1/3 bg-emerald-50 text-emerald-600 border border-emerald-100 font-black py-4 rounded-2xl hover:bg-emerald-100 transition-all uppercase tracking-widest mt-4"
                      >
                        Restore
                      </button>
                    )
                  )}
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 hover:bg-primary-500 transition-all uppercase tracking-widest mt-4 disabled:opacity-50"
                  >
                    {updating ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
