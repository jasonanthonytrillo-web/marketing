import { useState, useEffect, useRef } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, exportSuppliersExcel } from '../../services/api';
import { Plus, Edit, Trash2, MoreVertical, Pencil } from 'lucide-react';
import { downloadBlob } from '../../utils/csvExport';

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold text-surface-900">Supplier Directory</h2>
          <p className="text-surface-500 text-sm">Manage your inventory vendors and contact information.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={async () => {
              try {
                const response = await exportSuppliersExcel();
                downloadBlob(`Suppliers_List_${new Date().toISOString().split('T')[0]}.xlsx`, response);
              } catch (error) {
                console.error(error);
                alert('Failed to export suppliers. Please try again.');
              }
            }}
            className="w-full justify-center px-3 py-2.5 bg-white border border-surface-200 hover:border-primary-500 hover:text-primary-600 text-surface-600 font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 text-xs group"
          >
            Export Excel
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="w-full justify-center px-3 py-2.5 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" /> Add New Supplier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
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
                      <div className="relative inline-block" ref={openMenuId === s.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                          className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {openMenuId === s.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-50 min-w-[140px] animate-fade-in shadow-surface-500/10">
                            <button
                              onClick={() => { setOpenMenuId(null); handleOpenModal(s); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                            >
                              <Pencil className="w-4 h-4 text-blue-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(s.id); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden divide-y divide-surface-100">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-surface-400">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-surface-400">No suppliers found.</div>
          ) : (
            suppliers.map(s => (
              <div key={s.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-surface-900 break-words">{s.name}</p>
                    <p className="mt-1 text-xs font-bold text-surface-500">{s.contactPerson || 'No contact person'}</p>
                  </div>
                  <div className="relative flex-shrink-0" ref={openMenuId === s.id ? menuRef : null}>
                    <button onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)} className="rounded-xl border border-surface-200 p-2 text-surface-400 hover:bg-surface-50 hover:text-surface-700">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {openMenuId === s.id && (
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl">
                        <button onClick={() => { setOpenMenuId(null); handleOpenModal(s); }} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-surface-700 hover:bg-surface-50"><Pencil className="w-4 h-4 text-blue-500" /> Edit</button>
                        <button onClick={() => { setOpenMenuId(null); handleDelete(s.id); }} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-2xl bg-surface-50 p-3 text-sm">
                  <div><span className="text-[10px] font-black uppercase tracking-widest text-surface-400">Phone</span><p className="break-words font-medium text-surface-700">{s.phone || '—'}</p></div>
                  <div><span className="text-[10px] font-black uppercase tracking-widest text-surface-400">Email</span><p className="break-words font-medium text-surface-700">{s.email || '—'}</p></div>
                  <div><span className="text-[10px] font-black uppercase tracking-widest text-surface-400">Address</span><p className="break-words font-medium text-surface-700">{s.address || '—'}</p></div>
                </div>
              </div>
            ))
          )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
