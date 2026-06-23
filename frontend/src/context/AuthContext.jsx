import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../services/api';
import { LogOut } from 'lucide-react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      if (res.data && res.data.success) {
        setUser(res.data.data);
      }
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('pos_token');
    if (token) {
      getMe()
        .then(res => {
          if (res.data && res.data.success) {
            const userData = res.data.data;
            
            // Enforce Tenant Boundaries
            const urlParams = new URLSearchParams(window.location.search);
            const currentTenantSlug = urlParams.get('tenant') || 'project-million';
            const userTenantSlug = userData.tenantSlug || userData.tenant?.slug || 'project-million';
            
            // Allow admins to roam? Actually, let's keep it strict for now.
            if (currentTenantSlug !== userTenantSlug && userData.role === 'customer') {
              console.warn(`Tenant mismatch. User belongs to ${userTenantSlug}, but visited ${currentTenantSlug}. Logging out.`);
              localStorage.removeItem('pos_token');
              localStorage.removeItem('tenant_id');
              setUser(null);
            } else {
              setUser(userData);
            }
          } else {
            localStorage.removeItem('pos_token');
            localStorage.removeItem('tenant_id');
          }
        })
        .catch(() => { 
          localStorage.removeItem('pos_token'); 
          localStorage.removeItem('tenant_id');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loginUser = (token, userData) => {
    localStorage.setItem('pos_token', token);
    if (userData.tenantId) {
      localStorage.setItem('tenant_id', userData.tenantId.toString());
    }
    setUser(userData);
  };

  const logoutUser = () => {
    const role = user?.role;
    if (['admin', 'kitchen', 'cashier', 'superadmin', 'rider'].includes(role)) {
      setShowLogoutConfirm(true);
    } else {
      performLogout();
    }
  };

  const performLogout = () => {
    const role = user?.role;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('tenant_id');
    setUser(null);
    setShowLogoutConfirm(false);
    
    // Redirect staff to /login, customers to landing
    if (['admin', 'kitchen', 'cashier', 'superadmin', 'rider'].includes(role)) {
      window.location.href = '/login';
    } else {
      window.location.href = '/';
    }
  };

  const value = {
    user,
    loading,
    loginUser,
    logoutUser,
    refreshUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-sm p-6 sm:p-8 shadow-2xl animate-scale-in text-center relative overflow-hidden">
            {/* Premium Soft Accent Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-red-500/5 animate-pulse">
              🚪
            </div>
            
            <h3 className="font-heading text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Confirm Logout</h3>
            <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mb-8 px-2">
              Are you sure you want to log out? <br />
              You will need to sign back in to access the staff dashboard.
            </p>
            
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowLogoutConfirm(false)} 
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-bold rounded-2xl transition-all active:scale-95 text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={performLogout} 
                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 transition-all active:scale-95 text-sm uppercase tracking-wider"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
