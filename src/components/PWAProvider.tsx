"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Download, WifiOff, X, Check, Smartphone, Monitor, Share2,
  PlusSquare, ExternalLink, HelpCircle, Laptop, Sparkles, CheckCircle2,
} from "lucide-react";

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  installApp: () => Promise<void>;
  openInstallGuide: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isOffline: false,
  installApp: async () => {},
  openInstallGuide: () => {},
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'mac' | 'android' | 'windows' | 'other'>('other');

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Detect OS/Platform
      const ua = navigator.userAgent || "";
      if (/iPad|iPhone|iPod/.test(ua)) {
        setPlatform('ios');
      } else if (/Android/.test(ua)) {
        setPlatform('android');
      } else if (/Macintosh|Mac OS X/.test(ua)) {
        setPlatform('mac');
      } else if (/Windows/.test(ua)) {
        setPlatform('windows');
      } else {
        setPlatform('other');
      }

      // Check if already in standalone mode
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;
      setIsInstalled(isStandalone);

      // Register Service Worker
      if ("serviceWorker" in navigator) {
        const isGhPages = window.location.pathname.startsWith("/bji-dawati-brothers");
        const swPath = isGhPages ? "/bji-dawati-brothers/sw.js" : "/sw.js";

        navigator.serviceWorker
          .register(swPath, {
            scope: isGhPages ? "/bji-dawati-brothers/" : "/",
          })
          .then((registration) => {
            console.log("PWA Service Worker registered:", registration.scope);
          })
          .catch((err) => {
            console.warn("Service Worker registration failed:", err);
          });
      }

      // Handle beforeinstallprompt event (Chromium)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
        const dismissed = localStorage.getItem("pwa_install_dismissed");
        if (!dismissed) {
          setTimeout(() => setShowInstallBanner(true), 3000);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setIsInstallable(false);
        setShowInstallBanner(false);
        setShowInstallModal(false);
        setDeferredPrompt(null);
      };

      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setShowInstallBanner(false);
          setShowInstallModal(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn("Deferred install prompt error:", err);
      }
    }
    // If deferredPrompt is unavailable (Safari, iOS, Mac, or already triggered)
    setShowInstallModal(true);
  };

  const openInstallGuide = () => {
    setShowInstallModal(true);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isOffline,
        installApp,
        openInstallGuide,
      }}
    >
      {children}

      {/* Offline Status Toast */}
      {isOffline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-500/95 text-slate-950 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs sm:text-sm font-semibold animate-bounce">
          <WifiOff className="w-4 h-4 text-slate-950 flex-shrink-0" />
          <span>You are currently offline. IndexedDB data is active and will sync when online.</span>
        </div>
      )}

      {/* Slide-in PWA Install Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-slate-900/95 border border-indigo-500/30 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white tracking-tight">
                Install Dawati Brothers App
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Add to your home screen or desktop for fast offline access and native app experience.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={installApp}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install Now
                </button>
                <button
                  onClick={dismissBanner}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Comprehensive Install Instructions Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 text-white overflow-hidden">
            {/* Background accent glow */}
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install Dawati Brothers</h3>
                  <p className="text-xs text-slate-400">Progressive Web Application</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 relative z-10 text-xs text-slate-300">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Why install this app?</span>
                </div>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  <li>Full offline access to organizations and contacts</li>
                  <li>Fast 1-click launch from Home Screen or Dock</li>
                  <li>Native full-screen window without browser address bars</li>
                  <li>Real-time sync when internet reconnects</li>
                </ul>
              </div>

              {/* OS Specific Instructions */}
              {platform === 'ios' && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-2.5">
                  <div className="font-bold text-blue-300 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>How to Install on iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="space-y-2 text-slate-200">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                      <span>Tap the <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-400" /> at the bottom or top of Safari.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                      <span>Scroll down the menu and tap <strong>&apos;Add to Home Screen&apos;</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-blue-400" />.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
                      <span>Tap <strong>&apos;Add&apos;</strong> at the top right to complete installation.</span>
                    </li>
                  </ol>
                </div>
              )}

              {platform === 'mac' && (
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-2.5">
                  <div className="font-bold text-indigo-300 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    <span>How to Install on Mac (Safari or Chrome)</span>
                  </div>
                  <div className="space-y-2 text-slate-200">
                    <p className="text-slate-300 font-medium">In <strong>Chrome / Edge / Brave</strong>:</p>
                    <p className="pl-2">Click the <strong>Install</strong> icon <Download className="w-3.5 h-3.5 inline mx-1 text-indigo-400" /> at the right end of the address bar, or click Menu (⋮) → <strong>Install BJI Dawati Brothers</strong>.</p>
                    <p className="text-slate-300 font-medium mt-2">In <strong>Safari (macOS Sonoma / Sequoia)</strong>:</p>
                    <p className="pl-2">Click <strong>File</strong> in the top menu bar → <strong>Add to Dock...</strong>, then click <strong>Add</strong>.</p>
                  </div>
                </div>
              )}

              {platform === 'android' && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>How to Install on Android (Chrome)</span>
                  </div>
                  <ol className="space-y-2 text-slate-200">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                      <span>Tap the <strong>three-dots menu</strong> (<strong>⋮</strong>) in the top-right corner of Chrome.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                      <span>Tap <strong>&apos;Install app&apos;</strong> or <strong>&apos;Add to Home screen&apos;</strong>.</span>
                    </li>
                  </ol>
                </div>
              )}

              {(platform === 'windows' || platform === 'other') && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-2.5">
                  <div className="font-bold text-blue-300 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    <span>How to Install on Desktop (Chrome, Edge, Brave)</span>
                  </div>
                  <ol className="space-y-2 text-slate-200">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                      <span>Look at the browser URL address bar at the top right.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                      <span>Click the <strong>Install</strong> icon (screen with down arrow) or click Menu (⋮) → <strong>Install BJI Dawati Brothers</strong>.</span>
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 relative z-10">
              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all text-center cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
