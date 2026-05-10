import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login, googleLogin, registerCustomer, getPublicTenant } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { useDynamicBranding } from '../hooks/useDynamicBranding';
import { applyTheme, clearTheme } from '../utils/theme';

export default function MemberPortal() {
  const [mode, setMode] = useState('login'); // login, register
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const tenantSlug = searchParams.get('tenant');

  // Dynamic Title & Favicon
  useDynamicBranding(
    tenantData ? `${tenantData.name} - Member Portal` : 'Member Portal',
    tenantData?.favicon
  );

  useEffect(() => {
    if (tenantSlug) {
      loadTenant();
    }
    return () => clearTheme();
  }, [tenantSlug]);

  const loadTenant = async () => {
    try {
      const res = await getPublicTenant(tenantSlug);
      setTenantData(res.data.data);
      if (res.data.data.primaryColor) {
        applyTheme(res.data.data.primaryColor);
      }
    } catch (e) {
      console.error('Failed to load tenant branding:', e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login({ email: formData.email, password: formData.password, tenantSlug });
        loginUser(res.data.data.token, res.data.data.user);
        navigate(tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu');
      } else {
        await registerCustomer({ ...formData, tenantSlug });
        setSuccess(true);
        setMode('login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await googleLogin({ token: credentialResponse.credential, tenantSlug });
      loginUser(res.data.data.token, res.data.data.user);
      navigate(tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu');
    } catch (err) {
      setError(err.response?.data?.message || 'Google Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Login was cancelled or failed.');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back Button */}
        <Link to={tenantSlug ? `/?tenant=${tenantSlug}` : '/'} className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-8 text-sm font-bold uppercase tracking-widest">
          ← Back to Kiosk
        </Link>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Success State */}
          {success ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-full flex items-center justify-center text-3xl mx-auto mb-8 shadow-2xl shadow-emerald-500/20 animate-bounce-in">
                ✅
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Account Created!</h2>
              <p className="text-emerald-400 font-bold mb-10 leading-relaxed">
                Welcome to the club. <br />
                You can now sign in to start earning points.
              </p>
              <button 
                onClick={() => setSuccess(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest"
              >
                Sign In Now →
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                {tenantData?.logo ? (
                  <img src={tenantData.logo} className="w-20 h-20 rounded-3xl object-cover mx-auto mb-6 shadow-xl shadow-primary-500/20 border-2 border-white/10" alt={tenantData.name} />
                ) : (
                  <div className="w-16 h-16 bg-primary-500 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-primary-500/20">
                    💎
                  </div>
                )}
                <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                  {user ? `Welcome back, ${user.name.split(' ')[0]}!` : (mode === 'login' ? 'Welcome Back!' : 'Join the Club')}
                </h1>
                {user ? (
                  <p className="text-slate-400 text-sm">
                    Not you? <button onClick={logoutUser} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Sign Out</button>
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm">
                    {mode === 'login' 
                      ? `Sign in to ${tenantData?.name || 'burger palace'} to earn points.` 
                      : `Create a ${tenantData?.name || ''} account to start earning rewards.`}
                  </p>
                )}
              </div>

              {user ? (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
                    <p className="text-slate-400 text-sm mb-4">You are currently signed in as <span className="text-white font-bold">{user.email}</span></p>
                    <Link 
                      to={tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu'}
                      className="w-full inline-block bg-primary-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-500 active:scale-[0.98] transition-all uppercase tracking-widest"
                    >
                      🚀 Order Now
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-xs font-bold mb-6 text-center animate-shake">
                      ⚠️ {error}
                    </div>
                  )}

                  <div className="mb-6 flex flex-col items-center gap-3">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="filled_black"
                      shape="pill"
                      width="300"
                    />
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-slate-900/50 px-2 text-slate-500 uppercase tracking-widest font-bold">Or continue with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Full Name</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Your Name"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary-500 focus:bg-white/10 transition-all outline-none"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Email Address</label>
                      <input 
                        type="email" 
                        required
                        placeholder="email@example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary-500 focus:bg-white/10 transition-all outline-none"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Password</label>
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary-500 focus:bg-white/10 transition-all outline-none"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-primary-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-500 active:scale-[0.98] transition-all uppercase tracking-widest mt-4 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                  </form>

                  <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-slate-500 text-sm mb-4">
                      {mode === 'login' ? "Don't have an account?" : "Already a member?"}
                      <button 
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                        className="ml-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                      >
                        {mode === 'login' ? 'Join Now' : 'Sign In'}
                      </button>
                    </p>
                    <Link to={tenantSlug ? `/menu?tenant=${tenantSlug}` : '/menu'} className="text-slate-600 text-xs font-bold hover:text-slate-400 transition-colors uppercase tracking-tighter">
                      Continue as Guest →
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
