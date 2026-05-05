import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function SettingsTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ points_rate: '100', tenant_assets: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isSuper = user?.role === 'superadmin';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getSettings();
      if (res.data.data) {
        setSettings(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updateSettings(settings);
      setMessage('Settings updated successfully! ✅');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading settings...</div>;

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="font-heading text-3xl font-black text-surface-900 tracking-tight">System Settings</h2>
          <p className="text-surface-500 font-medium">Configure your POS rules and loyalty behavior.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl font-bold animate-fade-in">
            {message}
          </div>
        )}

        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-primary-50 border-b border-primary-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg shadow-primary-500/20">🎨</div>
            <div>
              <h3 className="font-heading font-bold text-primary-900">Store Branding</h3>
              <p className="text-primary-700 text-xs font-medium">Customize your logo and tab icon.</p>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 gap-8">
              {isSuper && (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Display Store Name</label>
                    <input 
                      type="text" 
                      value={settings.tenant_name || ''} 
                      onChange={e => setSettings({...settings, tenant_name: e.target.value})}
                      className="input-field w-full py-4 text-xl font-black" 
                      placeholder="e.g. BURGER PALACE"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Store Logo URL</label>
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          value={settings.tenant_logo || ''} 
                          onChange={e => setSettings({...settings, tenant_logo: e.target.value})}
                          className="input-field flex-1 py-3 text-sm" 
                          placeholder="https://example.com/logo.png"
                        />
                        {settings.tenant_logo && (
                          <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                            <img src={settings.tenant_logo} className="w-full h-full object-cover" alt="Preview" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Favicon URL (Tab Icon)</label>
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          value={settings.tenant_favicon || ''} 
                          onChange={e => setSettings({...settings, tenant_favicon: e.target.value})}
                          className="input-field flex-1 py-3 text-sm" 
                          placeholder="https://example.com/favicon.ico"
                        />
                        {settings.tenant_favicon && (
                          <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 flex items-center justify-center p-2">
                            <img src={settings.tenant_favicon} className="w-full h-full object-contain" alt="Preview" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Landing Page Background Assets (Slideshow / Video)</label>
                <div className="space-y-4">
                  {(settings.tenant_assets || []).map((asset, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="w-16 h-16 rounded-xl border border-slate-300 overflow-hidden bg-black flex-shrink-0">
                        {asset.match(/\.(mp4|webm)$/i) ? (
                          <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">VIDEO</div>
                        ) : (
                          <img src={asset} className="w-full h-full object-cover" alt="" />
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={asset} 
                        onChange={e => {
                          const newAssets = [...settings.tenant_assets];
                          newAssets[idx] = e.target.value;
                          setSettings({...settings, tenant_assets: newAssets});
                        }}
                        className="input-field flex-1 py-3 text-xs" 
                        placeholder="Image or Video URL (.mp4 supported)"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const newAssets = settings.tenant_assets.filter((_, i) => i !== idx);
                          setSettings({...settings, tenant_assets: newAssets});
                        }}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setSettings({...settings, tenant_assets: [...(settings.tenant_assets || []), '']})}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-xs hover:border-primary-400 hover:text-primary-500 transition-all"
                  >
                    + Add Background Media (Image/Video)
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic font-medium">✨ Tip: You can mix images and videos. The system will automatically play videos and cycle through images in a slideshow.</p>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg shadow-emerald-500/20">💎</div>
            <div>
              <h3 className="font-heading font-bold text-emerald-900">Loyalty Program</h3>
              <p className="text-emerald-700 text-xs font-medium">Control how customers earn rewards.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Points Accumulation Rate</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={settings.points_rate} 
                    onChange={e => setSettings({...settings, points_rate: e.target.value})}
                    className="input-field w-full pl-8 py-4 text-xl font-black font-heading" 
                    placeholder="100"
                  />
                </div>
                <div className="text-2xl">➡️</div>
                <div className="bg-slate-50 border border-slate-200 px-6 py-4 rounded-2xl font-black text-xl text-slate-700">
                  1 Point
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500 leading-relaxed font-medium">
                Set how many Pesos a customer must spend to earn **1 Loyalty Point**. 
                <br />
                <span className="text-emerald-600 font-bold italic">Example: Set to 50 to give 1 point for every ₱50 spent.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="btn-primary px-12 py-5 text-lg font-black uppercase tracking-widest rounded-[24px] shadow-2xl shadow-primary-500/30"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
