import { useState, useEffect } from 'react';
import { getInventory, restockProduct } from '../../services/api';

export default function InventoryTab() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('50');
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const uniqueCategories = [...new Set(inventory.map(item => item.category?.name).filter(Boolean))];

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getInventory();
      setInventory(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(restockQty);
    if (!qty || qty <= 0) return;
    
    setProcessing(true);
    try {
      await restockProduct(restockItem.id, qty);
      setRestockItem(null);
      loadData();
    } catch (error) {
      alert('Failed to restock');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading inventory...</div>;

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Inventory Management</h2>
      </div>

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

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-md overflow-hidden animate-slide-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">Restock Item</h3>
              <button onClick={() => setRestockItem(null)} className="text-surface-400 hover:text-surface-600 transition-colors">✕</button>
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

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden relative z-0">
        <table className="w-full text-left border-collapse">
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
                    <button 
                      onClick={() => { setRestockItem(item); setRestockQty('50'); }} 
                      className="btn-secondary py-1 px-3 text-xs"
                    >
                      Restock
                    </button>
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
  );
}
