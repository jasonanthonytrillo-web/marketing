import { useState, useEffect } from 'react';

export default function SplashScreen({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash on first visit per session
    return !sessionStorage.getItem('splashShown');
  });
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!showSplash) return;

    // Start fade out after 1.5s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    // Fully hide after fade animation completes (0.5s)
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('splashShown', 'true');
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [showSplash]);

  if (!showSplash) return children;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0a3d01] gap-6 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="/favicon.png"
        alt="Hometown Brew"
        className="w-24 h-24 rounded-3xl animate-pulse shadow-[0_0_60px_rgba(255,255,255,0.15)]"
      />
      <div className="text-center">
        <h1 className="text-white text-[22px] font-black tracking-tight font-heading">
          Hometown Brew
        </h1>
        <p className="text-white/50 text-[11px] font-semibold tracking-[3px] uppercase mt-1.5">
          Bringing home closer
        </p>
      </div>
      <div className="flex gap-1.5 mt-2">
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.2s]"></span>
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.4s]"></span>
      </div>
    </div>
  );
}
