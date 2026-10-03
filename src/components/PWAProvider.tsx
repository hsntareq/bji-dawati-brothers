"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Download, WifiOff, X, Check } from "lucide-react";

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  installApp: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isOffline: false,
  installApp: async () => {},
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check online status
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Check if already in standalone mode
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;
      setIsInstalled(isStandalone);

      // Register Service Worker
      if ("serviceWorker" in navigator) {
        // Resolve basePath dynamically (e.g. /bji-dawati-brothers or empty)
        const isGhPages = window.location.pathname.startsWith("/bji-dawati-brothers");
        const swPath = isGhPages ? "/bji-dawati-brothers/sw.js" : "/sw.js";

        navigator.serviceWorker
          .register(swPath, {
            scope: isGhPages ? "/bji-dawati-brothers/" : "/",
          })
          .then((registration) => {
            console.log("PWA Service Worker registered successfully:", registration.scope);
          })
          .catch((err) => {
            console.warn("Service Worker registration failed:", err);
          });
      }

      // Handle beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
        // Automatically offer install prompt once after 3 seconds if not dismissed previously
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
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
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
      }}
    >
      {children}

      {/* Offline Status Toast */}
      {isOffline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-500/95 text-slate-950 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs sm:text-sm font-semibold animate-bounce">
          <WifiOff className="w-4 h-4 text-slate-950" />
          <span>You are currently offline. Cached data is available.</span>
        </div>
      )}

      {/* Modern PWA Install Banner */}
      {showInstallBanner && !isInstalled && isInstallable && (
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
                Add to your home screen or desktop for fast offline access and native experience.
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
    </PWAContext.Provider>
  );
}
