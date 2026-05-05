import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrderHistory, changePassword } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function CustomerAccount() {
  const { user, logoutUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/member-portal');
    } else if (user) {
      loadHistory();
    }
  }, [user, authLoading, navigate]);

  const loadHistory = async () => {
    try {
      const res = await getOrderHistory();
      setOrders(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordMessage({ type: '', text: '' });
      }, 2000);
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update password.'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      case 'ready': return 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse';
      case 'preparing': return 'bg-sky-50 text-sky-600 border-sky-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-orange-600 font-bold animate-pulse uppercase tracking-[0.2em] text-xs">Loading History...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-6 grid grid-cols-3 items-center">
          <div className="justify-self-start">
            <Link to={tenantSlug ? `/menu?tenant=${tenantSlug}` : "/menu"} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all text-orange-600 font-bold whitespace-nowrap">
              <span className="text-xl">←</span>
              <span className="text-[10px] uppercase tracking-widest">back to menu</span>
            </Link>
          </div>
          <h1 className="justify-self-center text-sm font-black uppercase tracking-[0.3em] text-orange-600 whitespace-nowrap">My Account</h1>
          <div className="justify-self-end w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-8">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-700 rounded-[40px] p-8 mb-10 shadow-2xl relative overflow-hidden border border-white/10">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-400/10 rounded-full -ml-24 -mb-24 blur-2xl"></div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 text-center sm:text-left">
            <div className="w-20 h-20 bg-white/10 rounded-[28px] flex items-center justify-center text-4xl shadow-2xl backdrop-blur-md border border-white/20 ring-4 ring-white/5">
              💎
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-black mb-1 tracking-tight">{user?.name}</h2>
              <p className="text-orange-100/60 text-sm font-medium mb-4">{user?.email}</p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <div className="bg-black/30 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-orange-300/70 mb-0.5">Points Balance</p>
                  <p className="text-xl font-black text-white">{Math.floor(user?.points || 0)} <span className="text-[10px] opacity-60">PTS</span></p>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all"
                >

                  <p className="text-xs font-black uppercase tracking-widest">Change Password</p>
                </button>
              </div>
            </div>
          </div>


        </div>



        {/* Order History Section */}
        <div className="mb-6 flex items-center justify-between px-2">
          <h3 className="text-xl font-black tracking-tight text-slate-800">Recent Feasts</h3>
          <span className="text-[10px] font-black text-orange-600/50 uppercase tracking-widest">{orders.length} Orders</span>
        </div>

        <div className="space-y-4">
          {orders.map((order, idx) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-[32px] p-6 hover:border-orange-500/30 transition-all group animate-fade-in-up shadow-sm" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-lg shadow-orange-500/20"></span>
                    <span className="text-sm font-black text-slate-900 tracking-wide">#{order.orderNumber}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-5">{formatDate(order.createdAt)}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border ${getStatusColor(order.status)} transition-colors`}>
                  {order.status}
                </span>
              </div>

              <div className="space-y-3 mb-6 ml-5">
                {order.items?.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-600/50 font-black">{item.quantity}×</span>
                      <span className="text-slate-600 font-medium">{item.productName}</span>
                    </div>
                    <span className="text-slate-500 font-bold">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-5 border-t border-slate-100 space-y-2 ml-5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal || (order.total / 1.12))}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>VAT (12%)</span>
                  <span>{formatCurrency(order.taxAmount || (order.total - (order.total / 1.12)))}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Paid</span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                🍔
              </div>
              <p className="text-slate-500 font-bold mb-8">No past feasts found in your history.</p>
              <Link to="/menu" className="inline-block bg-orange-600 text-white font-black px-10 py-4 rounded-2xl hover:bg-orange-500 transition-all uppercase tracking-widest text-[10px] shadow-xl shadow-orange-600/20 active:scale-95">
                Start My First Order
              </Link>
            </div>
          )}
        </div>
      </div>
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}></div>
          <div className="bg-white rounded-[40px] w-full max-w-md p-8 relative z-10 shadow-2xl animate-fade-in-up">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Update Security</h3>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {passwordMessage.text && (
                <div className={`p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest ${passwordMessage.type === 'success' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 bg-orange-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 shadow-lg shadow-orange-600/20 disabled:opacity-50 transition-all"
                >
                  {passwordLoading ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
