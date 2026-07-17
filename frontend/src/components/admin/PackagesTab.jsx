import { useState, useEffect } from 'react';
import { getAdminPackages, createAdminPackage, updateAdminPackage, deleteAdminPackage, uploadImage } from '../../services/api';
import { Plus, Edit2, Trash2, Loader2, Store, Star, Coffee, AlertCircle, Upload } from 'lucide-react';

export default function PackagesTab() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceText: '',
    features: '',
    icon: 'Coffee',
    isPopular: false,
    isActive: true,
    image: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const res = await getAdminPackages();
      setPackages(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pkg) => {
    setEditingId(pkg.id);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      priceText: pkg.priceText,
      features: pkg.features || '',
      icon: pkg.icon || 'Coffee',
      isPopular: pkg.isPopular,
      isActive: pkg.isActive,
      image: pkg.image || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event package?')) return;
    try {
      await deleteAdminPackage(id);
      setPackages(packages.filter(p => p.id !== id));
    } catch (err) {
      alert('Failed to delete package');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setError('Uploading image...');
        const res = await uploadImage({ image: reader.result, name: `pkg-${Date.now()}` });
        setFormData(prev => ({ ...prev, image: res.data.url }));
        setError('');
      } catch (err) {
        setError('Image upload failed');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (editingId) {
        await updateAdminPackage(editingId, formData);
      } else {
        await createAdminPackage(formData);
      }
      
      setShowModal(false);
      loadPackages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save package');
    } finally {
      setIsSaving(false);
    }
  };

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${import.meta.env.VITE_API_URL?.replace('/api', '')}${url}`;
  };

  return (
    <div className="p-6 md:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black font-heading tracking-tight text-surface-900">Event Packages</h2>
          <p className="text-surface-500 font-medium mt-1">Manage pop-up cafe and event booking options.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', priceText: '', features: '', icon: 'Coffee', isPopular: false, isActive: true, image: '' });
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> New Package
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-surface-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 items-stretch">
          {packages.length === 0 ? (
             <div className="col-span-full p-12 text-center bg-surface-50 rounded-3xl border border-surface-200">
                <Store className="w-12 h-12 text-surface-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-surface-900 mb-2">No Packages Yet</h3>
                <p className="text-surface-500">Create your first event package to show on the public menu.</p>
             </div>
          ) : (
            packages.map(pkg => (
              <div key={pkg.id} className={`bg-white rounded-3xl border flex flex-col relative overflow-hidden transition-shadow hover:shadow-lg ${pkg.isPopular ? 'border-primary-500 shadow-md ring-2 ring-primary-500/20' : 'border-surface-200 shadow-sm'}`}>
                {!pkg.isActive && (
                   <div className="absolute top-4 right-4 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest z-10 shadow-sm backdrop-blur-md">Hidden</div>
                )}
                
                {pkg.image ? (
                  <div className="w-full h-28 bg-surface-100 overflow-hidden relative group shrink-0">
                    <img src={resolveUrl(pkg.image)} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </div>
                ) : (
                  <div className="w-full h-3 bg-gradient-to-r from-surface-100 to-surface-200 shrink-0"></div>
                )}

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-xl font-black text-surface-900 leading-tight mb-3">{pkg.name}</h3>
                  
                  <p className="text-surface-500 text-sm mb-3 line-clamp-2 leading-relaxed">{pkg.description || 'No description'}</p>
                  
                  {pkg.features && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {pkg.features.split(',').map((feature, i) => (
                        <span key={i} className="px-2.5 py-1 bg-surface-100 text-surface-600 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                          {feature.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-auto">
                    <div className="text-2xl font-black text-surface-900 tracking-tight mb-4">
                      {pkg.priceText}
                    </div>
                    
                    <div className="flex gap-2 pt-3 border-t border-surface-100">
                      <button onClick={() => handleEdit(pkg)} className="flex-1 py-3 bg-surface-50 text-surface-700 rounded-2xl font-bold hover:bg-surface-100 hover:text-surface-900 transition-colors flex items-center justify-center gap-2 border border-surface-200 shadow-sm">
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button onClick={() => handleDelete(pkg.id)} className="w-[52px] flex items-center justify-center bg-red-50 text-red-500 rounded-2xl font-bold border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:pl-[calc(16rem+1.5rem)]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setShowModal(false)}></div>
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-full flex flex-col relative z-10 shadow-2xl animate-fade-in-up overflow-hidden">
            <div className="px-6 py-5 md:px-8 md:py-6 border-b border-surface-100 shrink-0">
              <h3 className="text-2xl font-black font-heading text-surface-900">{editingId ? 'Edit Package' : 'New Package'}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                   <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Package Name</label>
                   <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field w-full text-lg font-bold" placeholder="e.g. Wedding Set" />
                 </div>
                 <div>
                   <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Price Text</label>
                   <input required type="text" value={formData.priceText} onChange={e => setFormData({...formData, priceText: e.target.value})} className="input-field w-full text-lg font-bold" placeholder="e.g. ₱5,000 or Custom" />
                 </div>
              </div>

              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input-field w-full" placeholder="e.g. Up to 50 Servings" />
              </div>
              
              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Features (Comma separated)</label>
                <textarea rows="3" value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} className="input-field w-full resize-none" placeholder="Full Cart Setup, 1 Barista, 3 Hours Service" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Card Icon</label>
                  <select value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="input-field w-full bg-white">
                    <option value="Coffee">Coffee Cup</option>
                    <option value="Star">Star</option>
                    <option value="Store">Storefront</option>
                  </select>
                </div>
                
                <div>
                   <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Event Image</label>
                   <div className="flex gap-2 items-center">
                     <input type="text" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="input-field flex-1 text-sm" placeholder="Image URL or upload" />
                     <label className="px-4 py-3 bg-slate-900 text-white rounded-xl cursor-pointer hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                        <Upload className="w-4 h-4" /> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                     </label>
                   </div>
                   {formData.image && (
                     <div className="mt-3 w-16 h-16 rounded-xl border border-surface-200 overflow-hidden bg-surface-50">
                       <img src={resolveUrl(formData.image)} className="w-full h-full object-cover" alt="Preview" />
                     </div>
                   )}
                </div>
              </div>

              <div className="flex flex-col gap-4 pb-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.isPopular} onChange={e => setFormData({...formData, isPopular: e.target.checked})} className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
                  <div>
                    <span className="font-bold text-surface-900 block">Highlight as "Most Popular"</span>
                    <span className="text-xs text-surface-500">Makes the card stand out in the public menu.</span>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
                  <div>
                    <span className="font-bold text-surface-900 block">Active Status</span>
                    <span className="text-xs text-surface-500">If unchecked, this package will NOT show on the menu.</span>
                  </div>
                </label>
              </div>
              </div>

              <div className="px-6 py-4 md:px-8 border-t border-surface-100 bg-surface-50 shrink-0 flex justify-end gap-3 z-10">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold bg-white border border-surface-200 text-surface-600 hover:bg-surface-100">Cancel</button>
                <button type="submit" disabled={isSaving} className="btn-primary min-w-[120px]">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editingId ? 'Save Changes' : 'Create Package')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
