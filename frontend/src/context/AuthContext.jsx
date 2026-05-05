import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../services/api';

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

  const loginUser = (token, userData) => {
    localStorage.setItem('pos_token', token);
    if (userData.tenantId) {
      localStorage.setItem('tenant_id', userData.tenantId.toString());
    }
    setUser(userData);
  };

  const logoutUser = () => {
    // Save tenant slug before clearing user data
    // Try both the flat property (from login) and nested object (from getMe)
    const tenantSlug = user?.tenantSlug || user?.tenant?.slug;
    
    localStorage.removeItem('pos_token');
    localStorage.removeItem('tenant_id');
    setUser(null);
    
    // Redirect to tenant-specific landing page if applicable
    if (tenantSlug && tenantSlug !== 'project-million') {
      window.location.href = `/?tenant=${tenantSlug}`;
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
