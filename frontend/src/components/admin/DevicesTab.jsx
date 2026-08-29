import { useState, useEffect } from 'react';
import { getDevices, registerDevice, revokeDevice, deleteDevice } from '../../services/api';
import { Monitor, Plus, ShieldCheck, ShieldOff, Trash2, RefreshCw, AlertTriangle, CheckCircle, Smartphone, Laptop } from 'lucide-react';

export default function DevicesTab() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const thisDeviceToken = localStorage.getItem('pos_device_token');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const res = await getDevices();
      setDevices(res.data.data || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setErrorMsg('Failed to load devices.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!deviceName.trim()) return;
    setRegistering(true);
    setErrorMsg('');
    try {
      const res = await registerDevice({ deviceName: deviceName.trim() });
      const { deviceToken } = res.data.data;
      // Save token to this browser's localStorage
      localStorage.setItem('pos_device_token', deviceToken);
      setSuccessMsg(`✅ Device "${deviceName.trim()}" has been authorized! Staff can now log in on this device.`);
      setDeviceName('');
      setShowRegisterModal(false);
      loadDevices();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to register device.');
    } finally {
      setRegistering(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeDevice(id);
      loadDevices();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update device.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDevice(id);
      setConfirmDelete(null);
      loadDevices();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete device.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-surface-500 font-bold text-sm">Loading devices...</p>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl md:text-3xl font-black text-surface-900 tracking-tight">Authorized Devices</h2>
          <p className="text-surface-500 font-medium text-sm mt-1">
            Control which devices your staff can log in from. Only registered devices allow cashier, kitchen, and rider logins.
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Authorize This Device
        </button>
      </div>

      {/* Success & Error Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-800 font-bold text-sm">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800 font-bold text-sm">{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-600 text-lg font-bold">✕</button>
        </div>
      )}

      {/* Info Banner */}
      {thisDeviceToken && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 font-bold text-sm">This browser is an authorized device.</p>
            <p className="text-blue-600 text-xs mt-1">Staff members can log in and clock in/out from this browser.</p>
          </div>
        </div>
      )}
      {!thisDeviceToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-bold text-sm">This browser is NOT authorized.</p>
            <p className="text-amber-600 text-xs mt-1">Staff members (cashier, kitchen, rider) cannot log in from this browser. Click "Authorize This Device" to register it.</p>
          </div>
        </div>
      )}

      {/* Devices List */}
      {devices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center">
          <Monitor className="w-16 h-16 text-surface-300 mx-auto mb-4" />
          <h3 className="font-heading text-xl font-bold text-surface-700 mb-2">No Devices Registered</h3>
          <p className="text-surface-500 text-sm max-w-md mx-auto">
            No devices have been authorized yet. Click "Authorize This Device" to register this browser as the first authorized POS device.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-lg group ${
                device.isActive 
                  ? 'border-surface-200 hover:border-primary-200' 
                  : 'border-red-200 bg-red-50/50 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    device.isActive 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'bg-red-100 text-red-500'
                  }`}>
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-surface-900 text-sm">{device.deviceName}</h4>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full ${
                      device.isActive
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                        : 'text-red-700 bg-red-50 border border-red-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${device.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {device.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-surface-500 mb-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Added by</span>
                  <span className="font-bold text-surface-700">{device.addedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Registered</span>
                  <span className="font-bold text-surface-700">{formatDate(device.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Last used</span>
                  <span className="font-bold text-surface-700">{formatDate(device.lastUsedAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-surface-100">
                <button
                  onClick={() => handleRevoke(device.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.97] ${
                    device.isActive
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {device.isActive ? (
                    <><ShieldOff className="w-3.5 h-3.5" /> Revoke</>
                  ) : (
                    <><ShieldCheck className="w-3.5 h-3.5" /> Reactivate</>
                  )}
                </button>
                <button
                  onClick={() => setConfirmDelete(device.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all active:scale-[0.97]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-surface-900 tracking-tight">Authorize Device</h3>
                  <p className="text-xs text-surface-500 font-medium">Register this browser for staff login</p>
                </div>
              </div>
              <button onClick={() => setShowRegisterModal(false)} className="text-surface-400 hover:text-surface-700 transition-colors text-lg">✕</button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-blue-800 text-xs font-semibold leading-relaxed">
                This will authorize <strong>this specific browser</strong> on this device. After authorization, cashiers, kitchen staff, and riders will be able to log in here.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Device Name</label>
                <input
                  type="text"
                  required
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder='e.g. "Main Counter POS" or "Kitchen Tablet"'
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm text-surface-900 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all placeholder-surface-400 font-bold"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-3 bg-surface-100 text-surface-700 rounded-xl font-bold text-sm hover:bg-surface-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {registering ? 'Authorizing...' : 'Authorize Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-scale-in text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-surface-900 mb-2">Delete Device?</h3>
            <p className="text-surface-500 text-sm mb-6">
              This will permanently remove this device from the authorized list. Staff will no longer be able to log in from it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 bg-surface-100 text-surface-700 rounded-xl font-bold text-sm hover:bg-surface-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
