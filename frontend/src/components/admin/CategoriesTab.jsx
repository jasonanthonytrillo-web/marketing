import { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/api';

export default function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      setCategories(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setCurrentCategory({ name: '', description: '', sortOrder: 0, active: true });
    setIsEditing(true);
  };

  const handleEdit = (category) => {
    setCurrentCategory(category);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (currentCategory.id) {
        await updateCategory(currentCategory.id, currentCategory);
      } else {
        await createCategory(currentCategory);
      }
      setIsEditing(false);
      loadCategories();
    } catch (error) {
      alert('Failed to save category');
    }
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCategory(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      loadCategories();
    } catch (error) {
      alert('Failed to delete category');
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading categories...</div>;

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Categories</h2>
        <button onClick={handleAdd} className="btn-primary py-2 px-4 shadow-md">
          + Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-200 text-sm font-medium text-surface-500 uppercase tracking-wider">
              <th className="p-4">Name</th>
              <th className="p-4">Sort Order</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 text-sm">
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-surface-50 transition-colors">
                <td className="p-4 font-semibold text-surface-900">{cat.name}</td>
                <td className="p-4 text-surface-600">{cat.sortOrder}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${cat.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {cat.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => handleEdit(cat)} className="text-blue-500 hover:text-blue-700 font-medium px-2 py-1 bg-blue-50 rounded">Edit</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-700 font-medium px-2 py-1 bg-red-50 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">{currentCategory.id ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setIsEditing(false)} className="text-surface-400 hover:text-surface-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Category Name</label>
                <input required type="text" value={currentCategory.name} onChange={e => setCurrentCategory({...currentCategory, name: e.target.value})} className="input-field w-full" placeholder="e.g. Burgers" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Category Icon (Emoji)</label>
                <input type="text" value={currentCategory.icon || ''} onChange={e => setCurrentCategory({...currentCategory, icon: e.target.value})} className="input-field w-full" placeholder="e.g. 🍔" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Sort Order</label>
                <input type="number" value={currentCategory.sortOrder} onChange={e => setCurrentCategory({...currentCategory, sortOrder: parseInt(e.target.value)})} className="input-field w-full" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="catActive" checked={currentCategory.active} onChange={e => setCurrentCategory({...currentCategory, active: e.target.checked})} className="w-5 h-5 rounded border-surface-300 text-primary-600" />
                <label htmlFor="catActive" className="text-sm font-medium text-surface-700">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-surface-200 text-surface-700 font-bold rounded-lg">Cancel</button>
                <button type="submit" className="flex-[2] btn-primary">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Premium Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setIsDeleting(false)}>
          <div 
            className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              {/* Pulsing Warning Icon */}
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse border-4 border-red-100">
                <span className="text-4xl">⚠️</span>
              </div>
              
              <h3 className="text-2xl font-black text-surface-900 mb-3 tracking-tight">Are you sure?</h3>
              <p className="text-surface-500 font-medium leading-relaxed mb-8">
                You are about to delete this category. <span className="text-red-500 font-bold">Products in this category will become uncategorized.</span>
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDelete}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Delete Category
                </button>
                <button 
                  onClick={() => setIsDeleting(false)}
                  className="w-full py-4 bg-surface-100 hover:bg-surface-200 text-surface-600 font-black uppercase tracking-widest rounded-2xl transition-all"
                >
                  Keep Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
