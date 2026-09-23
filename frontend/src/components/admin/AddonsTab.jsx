import { useEffect, useState } from 'react';
import { getAddons, createAddon, updateAddon, deleteAddon, getCategories, getRawIngredients } from '../../services/api';
import { Pencil, Trash2, X } from 'lucide-react';

const emptyAddon = { name: '', price: '', categoryIds: [], rawIngredientId: '', quantityUsed: '', available: true };

export default function AddonsTab() {
  const [addons, setAddons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [addonRes, categoryRes, ingredientRes] = await Promise.all([getAddons(), getCategories(), getRawIngredients()]);
      setAddons(addonRes.data.data || []);
      setCategories(categoryRes.data.data || []);
      setIngredients(ingredientRes.data.data || []);
    } catch (error) {
      console.error(error);
      alert('Failed to load add-ons');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing.id) await updateAddon(editing.id, editing);
      else await createAddon(editing);
      setEditing(null);
      load();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save add-on');
    }
  };

  const toggleCategory = (id) => setEditing(current => ({
    ...current,
    categoryIds: current.categoryIds.includes(id)
      ? current.categoryIds.filter(categoryId => categoryId !== id)
      : [...current.categoryIds, id]
  }));

  if (loading) return <div className="p-8 text-center text-surface-500">Loading add-ons...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold text-surface-900">Add-ons</h2>
          <p className="text-sm text-surface-500 mt-1">Create add-ons once and assign them to one or more product categories.</p>
        </div>
        <button onClick={() => setEditing({ ...emptyAddon })} className="btn-primary py-2 px-4">+ Add Add-on</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-surface-50 border-b border-surface-200 text-xs uppercase tracking-wider text-surface-500">
            <tr><th className="p-4">Add-on</th><th className="p-4">Price</th><th className="p-4">Categories</th><th className="p-4">COGS ingredient</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-surface-100 text-sm">
            {addons.map(addon => {
              const assigned = categories.filter(category => (addon.categoryIds || []).map(Number).includes(category.id));
              return <tr key={addon.id}>
                <td className="p-4 font-bold text-surface-900">{addon.name}</td>
                <td className="p-4">₱{Number(addon.price || 0).toFixed(2)}</td>
                <td className="p-4 text-surface-600">{assigned.map(category => category.name).join(', ') || 'None'}</td>
                <td className="p-4 text-surface-600">{addon.rawIngredient?.name || 'Not linked'}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${addon.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{addon.available ? 'Active' : 'Inactive'}</span></td>
                <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setEditing({ ...addon, categoryIds: (addon.categoryIds || []).map(Number) })} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button><button onClick={async () => { if (confirm(`Delete ${addon.name}?`)) { await deleteAddon(addon.id); load(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></td>
              </tr>;
            })}
            {addons.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-surface-400">No add-ons configured yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <div className="modal-overlay"><div className="modal-container max-w-lg">
        <div className="p-6 border-b border-surface-100 flex items-center justify-between"><h3 className="font-heading text-xl font-bold">{editing.id ? 'Edit Add-on' : 'Add Add-on'}</h3><button onClick={() => setEditing(null)}><X className="w-5 h-5 text-surface-400" /></button></div>
        <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
          <div><label className="block text-sm font-medium mb-1">Name</label><input required className="input-field w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Extra Cheese" /></div>
          <div><label className="block text-sm font-medium mb-1">Selling Price (₱)</label><input required type="number" min="0" step="0.01" className="input-field w-full" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-2">Available for these categories</label><div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{categories.map(category => <label key={category.id} className="flex items-center gap-2 p-2 rounded-lg border border-surface-200"><input type="checkbox" checked={editing.categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} /> <span className="text-sm">{category.name}</span></label>)}</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">COGS ingredient</label><select className="input-field w-full" value={editing.rawIngredientId || ''} onChange={e => setEditing({ ...editing, rawIngredientId: e.target.value })}><option value="">No linked ingredient</option>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Quantity used</label><input type="number" min="0" step="0.0001" className="input-field w-full" value={editing.quantityUsed || ''} onChange={e => setEditing({ ...editing, quantityUsed: e.target.value })} placeholder="e.g. 1" /></div></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={editing.available} onChange={e => setEditing({ ...editing, available: e.target.checked })} /> <span className="text-sm font-medium">Active</span></label>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 border rounded-lg font-bold">Cancel</button><button type="submit" className="flex-[2] btn-primary">Save Add-on</button></div>
        </form>
      </div></div>}
    </div>
  );
}
