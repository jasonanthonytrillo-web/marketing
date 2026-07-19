import { useState, useEffect, useRef } from 'react';
import { getInventory, restockProduct, getRawIngredients, createRawIngredient, updateRawIngredient, deleteRawIngredient } from '../../services/api';
import { X, AlertTriangle, MoreVertical, Pencil, Trash2, Plus, CheckCircle } from 'lucide-react';

export default function InventoryTab() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('50');
  const [wasteItem, setWasteItem] = useState(null);
  const [wasteQty, setWasteQty] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('products');
  const [ingredients, setIngredients] = useState([]);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [isDeletingIngredient, setIsDeletingIngredient] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const menuRef = useRef(null);

  const uniqueCategories = [...new Set(inventory.map(item => item.category?.name).filter(Boolean))];

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    loadData();
    loadSuppliers();
  }, []);

  // Close kebab menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, ingRes] = await Promise.all([
        getInventory(),
        getRawIngredients()
      ]);
      setInventory(invRes.data.data);
      setIngredients(ingRes.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const { getSuppliers } = await import('../../services/api');
      const res = await getSuppliers();
      setSuppliers(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(restockQty);
    if (!qty || qty <= 0) return;

    setProcessing(true);
    try {
      await restockProduct(restockItem.id, {
        quantity: qty,
        supplierId: selectedSupplierId || null
      });
      setRestockItem(null);
      setSelectedSupplierId('');
      loadData();
    } catch (error) {
      alert('Failed to restock');
    } finally {
      setProcessing(false);
    }
  };

  const handleWasteSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(wasteQty);
    if (!qty || qty <= 0) return;

    setProcessing(true);
    try {
      await restockProduct(wasteItem.id, {
        quantity: -qty,
        reason: 'waste'
      });
      setWasteItem(null);
      loadData();
    } catch (error) {
      alert('Failed to record waste');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading inventory...</div>;

  return (
    <>
      <div className="animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <div className="flex bg-surface-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-all ${activeTab === 'products' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
            >
              Product Stock
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-all ${activeTab === 'ingredients' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
            >
              Raw Ingredients
            </button>
          </div>
          <div className="flex gap-2">
            {activeTab === 'ingredients' && (
              <button
                onClick={() => { setEditingIngredient({ name: '', stock: '', unit: '', costPrice: '', alertLevel: '' }); setShowIngredientModal(true); }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs"
              >
                + Add Ingredient
              </button>
            )}
            <button
              onClick={() => window.open(`${import.meta.env.VITE_API_URL}/reports/export/inventory?token=${localStorage.getItem('pos_token')}`, '_blank')}
              className="px-4 py-2 bg-white border border-surface-200 hover:border-emerald-500 hover:text-emerald-600 text-surface-600 font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs group"
            >
              Export CSV
            </button>
          </div>
        </div>

        {activeTab === 'products' ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
              <input
                type="text"
                placeholder="Search inventory by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field flex-1"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field sm:w-64"
              >
                <option value="All">All Categories</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden relative z-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200 text-sm font-medium text-surface-500 uppercase tracking-wider">
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 text-sm">
                    {filteredInventory.map(item => {
                      const isLow = item.stock < 10;
                      return (
                        <tr key={item.id} className="hover:bg-surface-50 transition-colors">
                          <td className="p-4 font-semibold text-surface-900">{item.name}</td>
                          <td className="p-4 text-surface-600">{item.category?.name || 'N/A'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-sm font-bold ${isLow ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-surface-100 text-surface-700'}`}>
                              {item.stock} units
                            </span>
                            {isLow && <span className="ml-2 text-xs text-red-500 font-bold">Low Stock!</span>}
                          </td>
                          <td className="p-4 text-right">
                            <div className="relative inline-block" ref={openMenuId === item.id ? menuRef : null}>
                              <button
                                onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {openMenuId === item.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-[60] min-w-[140px] animate-fade-in shadow-surface-500/10">
                                  <button
                                    onClick={() => { setOpenMenuId(null); setRestockItem(item); setRestockQty('50'); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-emerald-500" />
                                    Restock
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setWasteItem(item); setWasteQty('1'); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Waste
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-surface-400">No inventory found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden relative z-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold text-surface-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="p-4">Name</th>
                    <th className="p-4">Unit</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Serving</th>
                    <th className="p-4">Cost</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-sm">
                  {ingredients.map(item => {
                    const isLow = item.alertLevel !== null && item.stock <= item.alertLevel;
                    return (
                      <tr key={item.id} className="hover:bg-surface-50 transition-colors">
                        <td className="p-4 font-semibold text-surface-900">{item.name}</td>
                        <td className="p-4 text-surface-600 font-bold">{item.unit}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div>
                              <span className={`px-2 py-1 rounded text-sm font-bold ${isLow ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-surface-100 text-surface-700'}`}>
                                {parseFloat(Number(item.stock).toFixed(2))} {item.unit}
                              </span>
                              {isLow && <span className="ml-2 text-xs text-red-500 font-bold">Low!</span>}
                            </div>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider ml-1 mt-0.5">
                              {Math.floor(item.stock * (item.yield || 1))} Servings Left
                            </span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="text-surface-700 font-bold">{item.yield || 1}</span>
                          <span className="text-surface-400 text-xs ml-1">per {item.unit}</span>
                        </td>
                        <td className="p-4 text-surface-600 whitespace-nowrap">₱{item.costPrice} / {item.unit}</td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block" ref={openMenuId === item.id ? menuRef : null}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                              className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                            {openMenuId === item.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-50 min-w-[140px] animate-fade-in">
                                <button
                                  onClick={() => { setOpenMenuId(null); setEditingIngredient(item); setShowIngredientModal(true); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                                >
                                  <Pencil className="w-4 h-4 text-blue-500" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); setEditingIngredient(item); setIsDeletingIngredient(true); }}
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
                    );
                  })}
                  {ingredients.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-surface-400">No raw ingredients configured yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-surface-900/40 backdrop-blur-md animate-fade-in overflow-y-auto py-10">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-surface-200 w-full max-w-md my-auto overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">Restock Item</h3>
              <button onClick={() => setRestockItem(null)} className="text-surface-400 hover:text-surface-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleRestockSubmit} className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-surface-500 mb-2">Product Name</p>
                <p className="text-lg font-bold text-surface-900">{restockItem.name}</p>
                <p className="text-sm text-surface-400 mt-1">Current Stock: <span className="font-bold text-surface-700">{restockItem.stock}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">How many units are you adding?</label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="input-field w-full text-lg font-bold font-heading"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Select Supplier (Optional)</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="input-field w-full bg-surface-50 border-surface-200"
                >
                  <option value="">No Supplier Selected</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setRestockItem(null)} disabled={processing} className="flex-1 py-3 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={processing} className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-emerald-500/20">
                  {processing ? 'Processing...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waste Modal */}
      {wasteItem && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-surface-900/40 backdrop-blur-md animate-fade-in overflow-y-auto py-10">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-surface-200 w-full max-w-md my-auto overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">Record Spoilage / Waste</h3>
              <button onClick={() => setWasteItem(null)} className="text-surface-400 hover:text-surface-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleWasteSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Warning</p>
                <p className="text-sm text-red-600 leading-relaxed">Recording waste will decrease stock and subtract the item cost from your daily profit reports.</p>
              </div>
              <div>
                <p className="text-sm font-medium text-surface-500 mb-2">Product Affected</p>
                <p className="text-lg font-bold text-surface-900">{wasteItem.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">Quantity Wasted (units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  className="input-field w-full text-lg font-bold font-heading border-red-100 focus:border-red-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setWasteItem(null)} disabled={processing} className="flex-1 py-3 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={processing} className="flex-[2] py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20">
                  {processing ? 'Recording...' : 'Confirm Waste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raw Ingredient Modal */}
      {showIngredientModal && editingIngredient && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-surface-900/40 backdrop-blur-md animate-fade-in overflow-y-auto py-10">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-surface-200 w-full max-w-md my-auto overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">{editingIngredient.id ? 'Edit Ingredient' : 'New Ingredient'}</h3>
              <button onClick={() => setShowIngredientModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setProcessing(true);
              try {
                const payload = {
                  ...editingIngredient,
                  stock: parseFloat(editingIngredient.stock) || 0,
                  costPrice: parseFloat(editingIngredient.costPrice) || 0,
                  alertLevel: editingIngredient.alertLevel === '' || editingIngredient.alertLevel == null ? null : parseFloat(editingIngredient.alertLevel)
                };
                if (editingIngredient.id) {
                  await updateRawIngredient(editingIngredient.id, payload);
                  setSuccessMessage('Ingredient updated successfully!');
                } else {
                  await createRawIngredient(payload);
                  setSuccessMessage('Ingredient added successfully!');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
                setShowIngredientModal(false);
                loadData();
              } catch (err) {
                alert('Saved failed.');
              }
              setProcessing(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Ingredient Name</label>
                <input required type="text" value={editingIngredient.name} onChange={e => setEditingIngredient({ ...editingIngredient, name: e.target.value })} className="input-field w-full" placeholder="e.g. Condensed Milk" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Stock Amount</label>
                  <input
                    type="number" min="0" step="0.01" required
                    value={editingIngredient.stock || ''}
                    onChange={e => setEditingIngredient({ ...editingIngredient, stock: e.target.value })}
                    className="input-field w-full placeholder-surface-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Unit (e.g. Can, Kg)</label>
                  <input
                    type="text" required
                    placeholder="Grams"
                    value={editingIngredient.unit}
                    onChange={e => setEditingIngredient({ ...editingIngredient, unit: e.target.value })}
                    className="input-field w-full placeholder-surface-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group relative">
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Servings Yield</label>
                  <input
                    type="number" min="0.01" step="0.01" required
                    placeholder="e.g. 6"
                    value={editingIngredient.yield ?? ''}
                    onChange={e => setEditingIngredient({ ...editingIngredient, yield: e.target.value === '' ? '' : e.target.value })}
                    className="input-field w-full placeholder-surface-300"
                  />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-surface-900 text-white text-[10px] p-2 rounded shadow-xl z-50">
                    How many single servings/portions can 1 unit of this ingredient produce?
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Cost Per Unit</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editingIngredient.costPrice || ''}
                    onChange={e => setEditingIngredient({ ...editingIngredient, costPrice: e.target.value })}
                    className="input-field w-full placeholder-surface-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1.5 ml-1">Low Stock Alert Level</label>
                <input
                  type="number" min="0" step="0.01"
                  placeholder="Leave empty for no alert"
                  value={editingIngredient.alertLevel || ''}
                  onChange={e => setEditingIngredient({ ...editingIngredient, alertLevel: e.target.value })}
                  className="input-field w-full placeholder-surface-300"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-100">
                {editingIngredient?.id && (
                  <button 
                    type="button" 
                    disabled={processing}
                    onClick={() => setIsDeletingIngredient(true)} 
                    className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors border border-red-100"
                  >
                    Delete
                  </button>
                )}
                <button type="button" onClick={() => setShowIngredientModal(false)} disabled={processing} className="flex-1 py-3 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={processing} className="flex-[2] py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-lg transition-colors">
                  {processing ? 'Saving...' : 'Save Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Delete Confirmation Modal */}
      {isDeletingIngredient && editingIngredient && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setIsDeletingIngredient(false)}>
          <div 
            className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              {/* Pulsing Warning Icon */}
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse border-4 border-red-100">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              
              <h3 className="text-2xl font-black text-surface-900 mb-3 tracking-tight">Are you sure?</h3>
              <p className="text-surface-500 font-medium leading-relaxed mb-8">
                You are about to delete <span className="font-bold text-surface-700">"{editingIngredient.name}"</span>. <span className="text-red-500 font-bold">This will remove it from all linked recipes!</span>
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  disabled={processing}
                  onClick={async () => {
                    setProcessing(true);
                    try {
                      await deleteRawIngredient(editingIngredient.id);
                      setIsDeletingIngredient(false);
                      setShowIngredientModal(false);
                      loadData();
                    } catch (err) {
                      alert('Failed to delete ingredient.');
                    }
                    setProcessing(false);
                  }}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {processing ? 'Deleting...' : 'Delete Ingredient'}
                </button>
                <button 
                  disabled={processing}
                  onClick={() => setIsDeletingIngredient(false)}
                  className="w-full py-4 bg-surface-100 hover:bg-surface-200 text-surface-600 font-black uppercase tracking-widest rounded-2xl transition-all"
                >
                  Keep Ingredient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic centered success notification toast */}
      {successMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-primary-600 text-white px-8 py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 border border-white/20 font-black tracking-tight text-lg animate-scale-in pointer-events-auto">
            <CheckCircle className="w-6 h-6" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}
    </>
  );
}
