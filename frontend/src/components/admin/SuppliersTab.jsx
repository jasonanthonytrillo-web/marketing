import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../services/api';

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await getSuppliers();
      setSuppliers(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', contactPerson: '', email: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
      } else {
        await createSupplier(formData);
      }
      setIsModalOpen(false);
      loadSuppliers();
    } catch (error) {
      alert('Failed to save supplier');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await deleteSupplier(id);
      loadSuppliers();
    } catch (error) {
      alert('Failed to delete supplier');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold text-surface-900">Supplier Directory</h2>
          <p className="text-surface-500 text-sm">Manage your inventory vendors and contact information.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.open(`${import.meta.env.VITE_API_URL}/reports/export/suppliers?token=${localStorage.getItem('pos_token')}`, '_blank')}
            className="px-4 py-2 bg-white border border-surface-200 hover:border-primary-500 hover:text-primary-600 text-surface-600 font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 text-xs group"
          >
            <span>📥</span> Export List
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-2.5 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 flex items-center gap-2 text-sm"
          >
            <span>➕</span> Add New Supplier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="px-6 py-4 text-[10px] font-black text-surface-400 uppercase tracking-widest">Supplier Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-surface-400 uppercase tracking-widest">Contact Person</th>
                <th className="px-6 py-4 text-[10px] font-black text-surface-400 uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4 text-[10px] font-black text-surface-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-[10px] font-black text-surface-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-surface-400">Loading suppliers...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-surface-400">No suppliers found.</td></tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-surface-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-surface-900">{s.name}</td>
                    <td className="px-6 py-4 text-surface-600 text-sm">{s.contactPerson || '-'}</td>
                    <td className="px-6 py-4 text-surface-600 text-sm">{s.phone || '-'}</td>
                    <td className="px-6 py-4 text-surface-600 text-sm">{s.email || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(s)} className="p-2 hover:bg-white rounded-lg text-blue-600 shadow-sm border border-transparent hover:border-blue-100">✏️</button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-white rounded-lg text-red-600 shadow-sm border border-transparent hover:border-red-100">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <h3 className="font-heading text-2xl font-black text-surface-900 mb-6">
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Supplier Name *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-surface-900 placeholder:text-surface-300"
                  placeholder="e.g. Acme Bakery"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Contact Person</label>
                  <input 
                    type="text" 
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    className="w-full px-5 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-surface-900 placeholder:text-surface-300"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-5 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-surface-900 placeholder:text-surface-300"
                    placeholder="0912..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-surface-900 placeholder:text-surface-300"
                  placeholder="vendor@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Address</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-5 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-surface-900 placeholder:text-surface-300 h-24 resize-none"
                  placeholder="Warehouse location..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-surface-100 text-surface-600 font-bold rounded-2xl hover:bg-surface-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20"
                >
                  {editingSupplier ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
