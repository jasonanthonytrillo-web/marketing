import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getSettings, updateSettings, uploadImage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Palette, Smartphone, Gem, Upload, Plus, ArrowRight, X, CheckCircle, Loader2, MapPin, Store, Monitor } from 'lucide-react';
import LocationPicker from '../LocationPicker';

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
        const data = { ...res.data.data };
        if (data.tenant_assets && typeof data.tenant_assets === 'string') {
          try {
            data.tenant_assets = JSON.parse(data.tenant_assets);
            if (typeof data.tenant_assets === 'string') {
              data.tenant_assets = JSON.parse(data.tenant_assets); // double-stringify guard
            }
          } catch (e) {
            data.tenant_assets = [];
          }
        }
        if (!Array.isArray(data.tenant_assets)) {
          data.tenant_assets = [];
        }
        setSettings(prev => ({ ...prev, ...data }));
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
      setMessage('Settings updated successfully!');

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
        {message && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-slate-100 flex flex-col items-center text-center animate-scale-up">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ color: '#10b981', backgroundColor: '#ecfdf5' }}>
                {message.includes('Uploading') || message.includes('Saving') ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <CheckCircle className="w-8 h-8" />
                )}
              </div>
              <h4 className="font-heading font-black text-xl text-slate-950 mb-2">
                {message.includes('Uploading') ? 'Uploading Assets' : message.includes('Saving') ? 'Saving Settings' : 'Settings Saved'}
              </h4>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">{message}</p>
              {!message.includes('Uploading') && !message.includes('Saving') && (
                <button
                  type="button"
                  onClick={() => setMessage('')}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm uppercase tracking-wider"
                >
                  Okay
                </button>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Store Operations */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-orange-50 border-b border-orange-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20"><Store className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading font-bold text-orange-900">Store Operations</h3>
              <p className="text-orange-700 text-xs font-medium">Manage your shop's open status and delivery.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="pb-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Store Operation Status</label>
                <p className="text-xs text-slate-500 font-medium">
                  When closed, customers can browse products but cannot checkout.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-black uppercase tracking-wider ${!settings.storeClosed ? 'text-emerald-600' : 'text-red-500'}`} style={!settings.storeClosed ? { color: '#059669' } : { color: '#dc2626' }}>
                  {!settings.storeClosed ? 'Store Open' : 'Store Closed'}
                </span>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, storeClosed: !prev.storeClosed }))}
                  className={`relative inline-flex h-[30px] w-[56px] shrink-0 cursor-pointer rounded-full border-[3px] border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${!settings.storeClosed ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-md ring-0 transition duration-300 ease-in-out ${!settings.storeClosed ? 'translate-x-6 bg-emerald-500' : 'translate-x-0 bg-red-500'}`}
                    style={settings.storeClosed ? { backgroundColor: '#dc2626' } : {}}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Service Status</label>
                <p className="text-xs text-slate-500 font-medium">
                  When disabled, customers cannot choose "Delivery" during checkout.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-black uppercase tracking-wider ${!settings.deliveryDisabled ? 'text-emerald-600' : 'text-red-600'}`} style={!settings.deliveryDisabled ? { color: '#059669' } : { color: '#dc2626' }}>
                  {!settings.deliveryDisabled ? 'Delivery Enabled' : 'Delivery Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, deliveryDisabled: !prev.deliveryDisabled }))}
                  className={`relative inline-flex h-[30px] w-[56px] shrink-0 cursor-pointer rounded-full border-[3px] border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${!settings.deliveryDisabled ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-md ring-0 transition duration-300 ease-in-out ${!settings.deliveryDisabled ? 'translate-x-6 bg-emerald-500' : 'translate-x-0 bg-red-500'}`}
                    style={settings.deliveryDisabled ? { backgroundColor: '#dc2626' } : {}}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Identity */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-primary-50 border-b border-primary-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20"><Palette className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading font-bold text-primary-900">Brand Identity</h3>
              <p className="text-primary-700 text-xs font-medium">Customize your store's name and logo.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            {isSuper && (
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
            )}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Store Logo</label>
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={settings.tenant_logo || ''} 
                    onChange={e => setSettings({...settings, tenant_logo: e.target.value})}
                    className="input-field flex-1 py-3 text-sm" 
                    placeholder="https://example.com/logo.png"
                  />
                  <button 
                    type="button"
                    onClick={() => document.getElementById('logoUpload').click()}
                    className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold whitespace-nowrap flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <input 
                    type="file" id="logoUpload" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        setMessage('Uploading Logo...');
                        try {
                          const res = await uploadImage({ image: reader.result, name: 'logo' });
                          setSettings({ ...settings, tenant_logo: res.data.url });
                          setMessage('Logo updated!');
                        } catch (error) { alert('Upload failed'); }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                {settings.tenant_logo && (
                  <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                    <img src={settings.tenant_logo.startsWith('http') ? settings.tenant_logo : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${settings.tenant_logo}`} className="w-full h-full object-cover" alt="Preview" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Kiosk Experience */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-violet-50 border-b border-violet-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20"><Monitor className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading font-bold text-violet-900">Kiosk Experience</h3>
              <p className="text-violet-700 text-xs font-medium">Design how the self-checkout screen looks.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Kiosk Ambient Visual Effect</label>
              <select 
                value={settings.seasonal_effect || 'auto'} 
                onChange={e => setSettings({...settings, seasonal_effect: e.target.value})}
                className="input-field w-full py-4 text-sm bg-white cursor-pointer"
              >
                <option value="auto">Auto (Follow Calendar Holidays Automatically)</option>
                <option value="off">Off (Disable Floating Particles Completely)</option>
                <option value="magic_sparkles">Magic Sparkles (Twinkling Brand-Colored Stardust)</option>
                <option value="valentines">Valentine's Day (Rising Pulsing Hearts)</option>
                <option value="mothers_day">Mother's Day (Falling Rose Petals)</option>
                <option value="fathers_day">Father's Day (Twinkling Golden Stars)</option>
                <option value="independence_day">Independence Day (Blue/Red/Gold Starbursts)</option>
                <option value="christmas">Winter/Christmas (Soft Falling Snow)</option>
                <option value="spring">Spring/Sakura (Pink Cherry Blossoms)</option>
                <option value="autumn">Autumn/Thanksgiving (Drifting Maple Leaves)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-2 italic font-medium">Choose a persistent theme effect or set it to Auto to let the kiosk automatically match holiday calendar dates!</p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Landing Page Tagline</label>
              <textarea 
                value={settings.landing_description || ''} 
                onChange={e => setSettings({...settings, landing_description: e.target.value})}
                className="input-field w-full py-4 px-5 text-sm min-h-[100px] resize-none leading-relaxed" 
                placeholder="e.g. Fresh food, fast service. Order right from this screen and enjoy your meal."
              />
              <p className="text-[10px] text-slate-400 mt-2 italic font-medium">This text appears on the main landing page to greet your customers.</p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Landing Page Background Assets (Slideshow / Video)</label>
              <div className="space-y-4">
                {(settings.tenant_assets || []).map((asset, idx) => (
                  <div key={idx} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 rounded-xl border border-slate-300 overflow-hidden bg-black flex-shrink-0">
                        {asset.match(/\.(mp4|webm|mov|ogg)$/i) ? (
                          <div className="w-full h-full flex items-center justify-center text-white text-[8px] font-black uppercase">VIDEO</div>
                        ) : (
                          <img src={asset.startsWith('http') || asset.startsWith('data:') ? asset : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${asset}`} className="w-full h-full object-cover" alt="" />
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
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => document.getElementById('bgMediaUpload').click()}
                    className="py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                  >
                    <Upload className="w-4 h-4" /> Choose File
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSettings({...settings, tenant_assets: [...(settings.tenant_assets || []), '']})}
                    className="py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px] hover:border-primary-400 hover:text-primary-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add URL
                  </button>
                  <input 
                    type="file" 
                    id="bgMediaUpload" 
                    accept="image/*,video/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        setMessage('Uploading...');
                          try {
                            const res = await uploadImage({ image: reader.result, name: 'landing-bg' });
                            setSettings(prev => ({ ...prev, tenant_assets: [...(prev.tenant_assets || []), res.data.url] }));
                            setMessage('Media uploaded!');
                          } catch (error) { alert('Upload failed'); }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 italic font-medium">✨ Tip: You can mix images and videos. The system will automatically play videos and cycle through images in a slideshow.</p>
            </div>
          </div>
        </div>

        {/* Store Location Settings */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20"><MapPin className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading font-bold text-emerald-900">Store Location</h3>
              <p className="text-emerald-700 text-xs font-medium">Set your shop coordinates for delivery calculations.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-surface-500">Shop Pin (Coordinates)</p>
                <div className="flex gap-2">
                   <span className="text-[10px] font-bold bg-white border border-surface-200 px-2 py-1 rounded text-surface-600">Lat: {Number(settings.storeLat || 0).toFixed(4)}</span>
                   <span className="text-[10px] font-bold bg-white border border-surface-200 px-2 py-1 rounded text-surface-600">Lng: {Number(settings.storeLng || 0).toFixed(4)}</span>
                </div>
              </div>
              
              <div className="h-[300px] rounded-xl overflow-hidden border-2 border-surface-100 relative z-0">
                <LocationPicker 
                  onLocationSelect={(loc) => {
                    setSettings(prev => ({ ...prev, storeLat: loc.lat, storeLng: loc.lng }));
                  }}
                  initialAddress=""
                />
              </div>
              
              <div className="mt-8 pt-6 border-t border-surface-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Fee Pricing</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      type="number" 
                      value={settings.deliveryFeePerKm || '20'} 
                      onChange={e => setSettings({...settings, deliveryFeePerKm: e.target.value})}
                      className="input-field w-full pl-8 py-4 text-xl font-black font-heading" 
                      placeholder="20"
                    />
                  </div>
                  <div className="text-slate-400 font-bold text-sm tracking-tight whitespace-nowrap">per Kilometer</div>
                </div>
                <p className="mt-3 text-[11px] text-surface-500 font-medium italic">
                  * This rate is used to calculate delivery fees based on the direct distance between your shop and the customer's pin.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><Smartphone className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading font-bold text-blue-900">Payment Settings</h3>
              <p className="text-blue-700 text-xs font-medium">Manage your cashless payment details.</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">GCash QR Code</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={settings.gcash_qr || ''} 
                    onChange={e => setSettings({...settings, gcash_qr: e.target.value})}
                    className="input-field flex-1 py-3 text-sm" 
                    placeholder="https://example.com/gcash-qr.png"
                  />
                  <button 
                    type="button"
                    onClick={() => document.getElementById('gcashQrUpload').click()}
                    className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <input 
                    type="file" id="gcashQrUpload" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        setMessage('Uploading GCash QR...');
                        try {
                          const res = await uploadImage({ image: reader.result, name: 'gcash-qr' });
                          setSettings({ ...settings, gcash_qr: res.data.url });
                          setMessage('GCash QR updated!');
                        } catch (error) { alert('Upload failed'); }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                {settings.gcash_qr && (
                  <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 shadow-sm">
                    <img src={settings.gcash_qr.startsWith('http') ? settings.gcash_qr : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${settings.gcash_qr}`} className="w-full h-full object-contain" alt="GCash QR Preview" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic font-medium">This QR code will be displayed to customers when you trigger a GCash payment request from the cashier dashboard.</p>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Maya QR Code</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={settings.maya_qr || ''} 
                    onChange={e => setSettings({...settings, maya_qr: e.target.value})}
                    className="input-field flex-1 py-3 text-sm" 
                    placeholder="https://example.com/maya-qr.png"
                  />
                  <button 
                    type="button"
                    onClick={() => document.getElementById('mayaQrUpload').click()}
                    className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <input 
                    type="file" id="mayaQrUpload" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        setMessage('Uploading Maya QR...');
                        try {
                          const res = await uploadImage({ image: reader.result, name: 'maya-qr' });
                          setSettings({ ...settings, maya_qr: res.data.url });
                          setMessage('Maya QR updated!');
                        } catch (error) { alert('Upload failed'); }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                {settings.maya_qr && (
                  <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 shadow-sm">
                    <img src={settings.maya_qr.startsWith('http') ? settings.maya_qr : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${settings.maya_qr}`} className="w-full h-full object-contain" alt="Maya QR Preview" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic font-medium">This QR code will be displayed to customers when you trigger a Maya payment request from the cashier dashboard.</p>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20"><Gem className="w-6 h-6" /></div>
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
                <div className="text-slate-400"><ArrowRight className="w-6 h-6" /></div>
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
