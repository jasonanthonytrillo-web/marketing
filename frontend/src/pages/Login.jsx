import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { unlockAudio } from '../utils/helpers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const tenantSlug = searchParams.get('tenant');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login({ email, password, tenantSlug });
      const { token, user } = res.data.data;
      unlockAudio(); // Automatically enable sound system
      loginUser(token, user);
      
      // Redirect based on role
      if (user.role === 'superadmin') navigate('/superadmin');
      else if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'cashier') navigate('/cashier');
      else if (user.role === 'kitchen') navigate('/kitchen');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="font-heading text-3xl font-bold text-white mb-2">Staff Login</h1>
          <p className="text-surface-400">
            {tenantSlug ? `Sign in to ${tenantSlug.replace(/-/g, ' ')}` : 'Sign in to access your dashboard'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-800/50 backdrop-blur-lg border border-surface-700/50 rounded-2xl p-6 space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-surface-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 bg-surface-900/50 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all" placeholder="email@example.com" />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-surface-400 mb-1.5">Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              className="w-full px-4 py-3 bg-surface-900/50 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all pr-12" 
              placeholder="••••••••" 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] p-2 text-surface-400 hover:text-white transition-colors"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6">
          <a 
            href={tenantSlug ? `/?tenant=${tenantSlug}` : (searchParams.get('from') === 'marketing' ? '/advertise' : '/')} 
            className="text-surface-500 text-sm hover:text-primary-400 transition-colors"
          >
            ← Back to {searchParams.get('from') === 'marketing' ? 'Home' : 'Kiosk'}
          </a>
        </div>
      </div>
    </div>
  );
}
