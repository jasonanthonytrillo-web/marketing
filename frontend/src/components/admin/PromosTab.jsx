import { useState, useEffect } from 'react';
import { getPromos, createPromo, updatePromo, deletePromo, getAdminProducts, getCategories } from '../../services/api';
import { Tag, Plus, Trash2, Edit, AlertTriangle, CheckCircle, Percent, Banknote, Calendar, MoreVertical, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function PromosTab() {
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [formData, setFormData] = useState({
    code: '', type: 'PERCENTAGE', value: '', appliesTo: 'ALL', targetId: '', maxUses: '', maxUsesPerUser: '', startDate: '', endDate: '', isActive: true
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resPromos, resProds, resCats] = await Promise.all([
        getPromos(), getAdminProducts(), getCategories()
      ]);
      setPromos(resPromos.data.data);
      setProducts(resProds.data.data);
      setCategories(resCats.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.code || !formData.value) return;
      const isUpdating = !!editingPromo;
      if (editingPromo) {
        await updatePromo(editingPromo.id, formData);
      } else {
        await createPromo(formData);
      }
      setShowModal(false);
      setEditingPromo(null);
      resetForm();
      loadData();
      setSuccessMessage(isUpdating ? `Promo "${formData.code}" updated successfully!` : `Promo "${formData.code}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save promo');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      type: promo.type,
      value: promo.value.toString(),
      appliesTo: promo.appliesTo,
      targetId: promo.targetId || '',
      maxUses: promo.maxUses ? promo.maxUses.toString() : '',
      maxUsesPerUser: promo.maxUsesPerUser ? promo.maxUsesPerUser.toString() : '',
      startDate: promo.startDate ? promo.startDate.split('T')[0] : '',
      endDate: promo.endDate ? promo.endDate.split('T')[0] : '',
      isActive: promo.isActive
    });
    setShowModal(true);
  };

  const toggleStatus = async (promo) => {
    try {
      await updatePromo(promo.id, { isActive: !promo.isActive });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromo(deleteConfirmId);
      setShowDeleteConfirm(false);
      setDeleteConfirmId(null);
      loadData();
      setSuccessMessage('Promo deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      console.error(error);
      alert('Failed to delete promo');
    }
  };

  const resetForm = () => {
    setFormData({ code: '', type: 'PERCENTAGE', value: '', appliesTo: 'ALL', targetId: '', maxUses: '', maxUsesPerUser: '', startDate: '', endDate: '', isActive: true });
    setEditingPromo(null);
  };

  const getTargetName = (promo) => {
    if (promo.appliesTo === 'ALL') return 'Entire Order';
    if (promo.appliesTo === 'PRODUCT') {
      const p = products.find(prod => prod.id === promo.targetId);
      return p ? `Product: ${p.name}` : 'Unknown Product';
    }
    if (promo.appliesTo === 'CATEGORY') {
      const c = categories.find(cat => cat.id === promo.targetId);
      return c ? `Category: ${c.name}` : 'Unknown Category';
    }
    return '';
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading promos...</div>;

  return (
    <div className="space-y-6 relative">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-down max-w-md">
          <div className="flex-shrink-0 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{successMessage}</p>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="flex-shrink-0 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-black" />
            Promo Codes & Discounts
          </h2>
          <p className="text-xs text-gray-500 mt-1">Manage active discounts for your customers.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-black hover:bg-gray-900 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg text-xs tracking-wider uppercase flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Promo
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">
              <th className="p-5">Code</th>
              <th className="p-5">Value</th>
              <th className="p-5">Applies To</th>
              <th className="p-5">Usage</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {promos.map(promo => (
              <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-5">
                  <span className="bg-black text-white font-black px-3 py-1.5 rounded-lg border border-gray-300">{promo.code}</span>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-2 font-bold text-black">
                    {promo.type === 'PERCENTAGE' ? <Percent className="w-4 h-4 text-gray-600 text-xs" /> : <Banknote className="w-4 h-4 text-gray-600 text-xs" />}
                    {promo.type === 'PERCENTAGE' ? `${promo.value}%` : formatCurrency(promo.value)}
                  </div>
                </td>
                <td className="p-5">
                  <p className="font-medium text-gray-700 text-xs">{getTargetName(promo)}</p>
                </td>
                <td className="p-5">
                  <p className="text-xs font-bold text-black tracking-widest">{promo.currentUses} <span className="text-gray-500 font-medium">/ {promo.maxUses || '∞'}</span></p>
                  <p className="text-[10px] font-bold text-gray-500 mt-0.5">
                    {promo.maxUsesPerUser ? `Max ${promo.maxUsesPerUser}x / user` : 'Unlimited / user'}
                  </p>
                </td>
                <td className="p-5">
                  <button onClick={() => toggleStatus(promo)} className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${promo.isActive ? 'bg-black text-white border-black hover:bg-gray-900' : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'} transition-all`}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-5 text-right">
                  <div className="relative group">
                    <button className="p-2 bg-gray-100 text-gray-600 hover:text-black hover:bg-gray-200 rounded-xl transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-300 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      <button
                        onClick={() => handleEdit(promo)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-black hover:bg-gray-100 first:rounded-t-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-lg transition-colors border-t border-gray-200"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr>
                <td colSpan="6" className="p-10 text-center text-gray-500 font-medium text-sm">No promo codes found.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto hidden-scrollbar">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-scale-in my-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 sm:p-8">
              <h3 className="text-xl font-black text-black tracking-tight mb-6 flex items-center gap-2"><Tag className="w-5 h-5 text-black" /> {editingPromo ? 'Edit Promo' : 'New Promo'}</h3>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Promo Code</label>
                    <input 
                      type="text" required
                      className="w-full bg-white border border-gray-300 rounded-2xl px-5 py-3.5 text-sm text-black focus:border-black outline-none uppercase font-bold"
                      placeholder="e.g. SUMMER20"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Discount Type</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none font-bold"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (₱)</option>
                    </select>
                  </div>
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Value</label>
                    <input 
                      type="number" required min="1" step="any"
                      className="w-full bg-white border border-gray-300 rounded-2xl px-5 py-3.5 text-sm text-black focus:border-black outline-none font-bold"
                      placeholder={formData.type === 'PERCENTAGE' ? "e.g. 20" : "e.g. 150"}
                      value={formData.value}
                      onChange={e => setFormData({...formData, value: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Applies To</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none font-bold mb-2"
                    value={formData.appliesTo}
                    onChange={e => setFormData({...formData, appliesTo: e.target.value, targetId: ''})}
                  >
                    <option value="ALL">Entire Order</option>
                    <option value="PRODUCT">Specific Product</option>
                    <option value="CATEGORY">Specific Category</option>
                  </select>

                  {formData.appliesTo === 'PRODUCT' && (
                    <select required
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none"
                      value={formData.targetId}
                      onChange={e => setFormData({...formData, targetId: e.target.value})}
                    >
                      <option value="">Select Product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  {formData.appliesTo === 'CATEGORY' && (
                    <select required
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none"
                      value={formData.targetId}
                      onChange={e => setFormData({...formData, targetId: e.target.value})}
                    >
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Total Uses (Optional)</label>
                    <input 
                      type="number" min="1"
                      className="w-full bg-white border border-gray-300 rounded-2xl px-5 py-3.5 text-sm text-black focus:border-black outline-none"
                      placeholder="Unlimited"
                      value={formData.maxUses}
                      onChange={e => setFormData({...formData, maxUses: e.target.value})}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Limit / User (Optional)</label>
                    <input 
                      type="number" min="1"
                      className="w-full bg-white border border-gray-300 rounded-2xl px-5 py-3.5 text-sm text-black focus:border-black outline-none"
                      placeholder="e.g. 1"
                      value={formData.maxUsesPerUser}
                      onChange={e => setFormData({...formData, maxUsesPerUser: e.target.value})}
                    />
                  </div>
                </div>

                {editingPromo && (
                  <div className="flex items-center gap-3 bg-gray-100 p-4 rounded-2xl">
                    <label className="text-sm font-bold text-black flex-1">Status</label>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border transition-all ${formData.isActive ? 'bg-black text-white border-black' : 'bg-gray-200 text-gray-600 border-gray-300'}`}
                    >
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none"
                      value={formData.startDate}
                      onChange={e => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 ml-1">End Date</label>
                    <input 
                      type="date"
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-sm text-black focus:border-black outline-none"
                      value={formData.endDate}
                      onChange={e => setFormData({...formData, endDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-black font-bold rounded-2xl text-xs uppercase tracking-widest transition-all">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-4 bg-black hover:bg-gray-900 text-white font-black rounded-2xl shadow-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                    {saving ? 'Saving...' : editingPromo ? 'Update Promo' : 'Deploy Promo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-black text-center text-black mb-2">Delete Promo Code?</h3>
              <p className="text-sm text-gray-600 text-center mb-8">Are you sure you want to delete this promo code? This action cannot be undone.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmId(null); }}
                  className="flex-1 py-3.5 bg-gray-200 hover:bg-gray-300 text-black font-bold rounded-2xl text-sm uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all shadow-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
