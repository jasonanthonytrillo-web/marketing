import { useState, useEffect, useRef } from 'react';
import api, { getCategories } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Trash2, X, MoreVertical } from 'lucide-react';

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', category: 'General', categoryId: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    loadExpenses();
    loadCategories();
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

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/expenses');
      setExpenses(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await getCategories();
      setCategories(res.data.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/expenses', formData);
      setShowModal(false);
      setFormData({ name: '', amount: '', category: 'General', categoryId: '', date: new Date().toISOString().split('T')[0], notes: '' });
      loadExpenses();
    } catch (error) {
      alert('Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/admin/expenses/${id}`);
      loadExpenses();
    } catch (error) {
      alert('Failed to delete expense');
    }
  };

  if (loading && expenses.length === 0) return <div className="p-8 text-center text-surface-500">Loading expenses...</div>;

  return (
    <>
      <div className="animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold text-surface-900">Expense Tracking</h2>
            <p className="text-surface-500 text-sm">Monitor your operational costs and overheads.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary w-full sm:w-auto py-2.5 px-6 shadow-lg shadow-primary-500/20"
          >
            + Add Expense
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold text-surface-400 uppercase tracking-widest">
                  <th className="p-4">Date</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-surface-50 transition-colors">
                    <td className="p-4 text-surface-500">{formatDate(exp.date)}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-surface-100 text-surface-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                        {exp.categoryRelation?.name || exp.category || 'General'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-surface-900">{exp.name}</div>
                      {exp.notes && <div className="text-xs text-surface-400 italic">{exp.notes}</div>}
                    </td>
                    <td className="p-4 font-black text-red-600">{formatCurrency(exp.amount)}</td>
                    <td className="p-4 text-right">
                      <div className="relative inline-block" ref={openMenuId === exp.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === exp.id ? null : exp.id)}
                          className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {openMenuId === exp.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-50 min-w-[140px] animate-fade-in shadow-surface-500/10">
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(exp.id); }}
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
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan="5" className="p-12 text-center text-surface-400 font-bold">No expenses logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y divide-surface-100">
            {expenses.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-bold text-surface-400">No expenses logged yet.</div>
            ) : (
              expenses.map(exp => (
                <div key={exp.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-black text-surface-900 break-words">{exp.name}</p>
                      <p className="mt-1 text-xs font-medium text-surface-500">{formatDate(exp.date)}</p>
                    </div>
                    <p className="flex-shrink-0 text-base font-black text-red-600">{formatCurrency(exp.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="max-w-[75%] truncate rounded-lg bg-surface-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-surface-600">
                      {exp.categoryRelation?.name || exp.category || 'General'}
                    </span>
                    <div className="relative flex-shrink-0" ref={openMenuId === exp.id ? menuRef : null}>
                      <button onClick={() => setOpenMenuId(openMenuId === exp.id ? null : exp.id)} className="rounded-xl border border-surface-200 p-2 text-surface-400 hover:bg-surface-50 hover:text-surface-700">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {openMenuId === exp.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl">
                          <button onClick={() => { setOpenMenuId(null); handleDelete(exp.id); }} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {exp.notes && <p className="break-words rounded-xl bg-surface-50 p-3 text-xs italic text-surface-500">{exp.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-surface-900/40 backdrop-blur-md animate-fade-in overflow-y-auto py-10">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-surface-200 w-full max-w-md my-auto overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">Add New Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Description</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field w-full" placeholder="e.g. Monthly Rent" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Amount (₱)</label>
                  <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="input-field w-full" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Sales Category</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value, category: e.target.value ? (categories.find(c => String(c.id) === e.target.value)?.name || 'General') : 'General' })}
                  className="input-field w-full"
                >
                  <option value="">General / Overhead (not tied to sales)</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-400 mt-1.5">Choose the product category this expense supports so it appears in category profitability.</p>
              </div>
              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Notes (Optional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="input-field w-full h-20 resize-none" placeholder="Add more details..."></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-surface-100 text-surface-600 font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn-primary py-3">
                  {saving ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
