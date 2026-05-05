import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant') || 'Project Million';
  const tenantName = tenant.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return;
    }

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Show iOS instruction after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    }

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-fade-in-up">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 max-w-md mx-auto flex items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary-500/5 pointer-events-none"></div>
        
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          ✕
        </button>

        <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-primary-100 flex-shrink-0 z-10">
          📱
        </div>
        
        <div className="flex-1 z-10">
          <h4 className="font-heading font-black text-slate-900 leading-tight mb-0.5">Install App</h4>
          <p className="text-xs text-slate-500 font-medium leading-snug">Add {tenantName} to your home screen for quick access.</p>
        </div>

        <div className="z-10">
          {isIOS && !deferredPrompt ? (
            <button 
              onClick={() => alert("To install on iOS: tap the Share button (square with arrow pointing up) at the bottom of Safari, then tap 'Add to Home Screen'.")}
              className="bg-primary-50 text-primary-600 font-bold px-4 py-2 text-sm rounded-xl border border-primary-200"
            >
              How to Install
            </button>
          ) : (
            <button 
              onClick={handleInstallClick}
              className="bg-primary-600 hover:bg-primary-700 active:scale-95 transition-all text-white font-bold px-5 py-2.5 text-sm rounded-xl shadow-lg shadow-primary-600/30"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
