import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', category: 'Supplies', date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExpenses();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/expenses', formData);
      setShowModal(false);
      setFormData({ name: '', amount: '', category: 'Supplies', date: new Date().toISOString().split('T')[0], notes: '' });
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold text-surface-900">Expense Tracking</h2>
            <p className="text-surface-500 text-sm">Monitor your operational costs and overheads.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary py-2.5 px-6 shadow-lg shadow-primary-500/20"
          >
            + Add Expense
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="overflow-x-auto">
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
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-surface-900">{exp.name}</div>
                      {exp.notes && <div className="text-xs text-surface-400 italic">{exp.notes}</div>}
                    </td>
                    <td className="p-4 font-black text-red-600">{formatCurrency(exp.amount)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(exp.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan="5" className="p-12 text-center text-surface-400 font-bold">No expenses logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-surface-900/40 backdrop-blur-md animate-fade-in overflow-y-auto py-10">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-surface-200 w-full max-w-md my-auto overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">Add New Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Description</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field w-full" placeholder="e.g. Monthly Rent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-xs font-black text-surface-400 uppercase tracking-widest mb-1.5">Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input-field w-full">
                  <option>Supplies</option>
                  <option>Utilities</option>
                  <option>Rent</option>
                  <option>Salary</option>
                  <option>Marketing</option>
                  <option>Maintenance</option>
                  <option>Other</option>
                </select>
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
