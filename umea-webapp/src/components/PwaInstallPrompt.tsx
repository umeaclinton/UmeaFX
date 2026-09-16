"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Download, X, Share, PlusSquare, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("UmeaFX PWA Service Worker active:", reg.scope))
        .catch((err) => console.warn("PWA Service Worker registration notice:", err));
    }

    // 2. Check if already installed & running in standalone mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const triggerToast = () => {
      setIsVisible(true);
      // Auto-dismiss toast after 5 seconds
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };

    // If on iOS and not standalone, show the 5-second toast after 1 second on page load/refresh
    if (isIosDevice && !isStandaloneMode) {
      const delayTimer = setTimeout(triggerToast, 1200);
      return () => clearTimeout(delayTimer);
    }

    // 4. Android/Chrome/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      triggerToast();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Fallback: If browser already supports install or on non-chromium, trigger brief 5s toast on load
    const fallbackTimer = setTimeout(() => {
      if (!isStandaloneMode) {
        triggerToast();
      }
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    // If user clicks install, pause/clear the auto-dismiss timer
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);

    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } else {
      // Direct desktop/mobile manual tip or trigger
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    setIsVisible(false);
    setShowIOSInstructions(false);
  };

  if (isStandalone) return null;

  return (
    <>
      {/* ── 5-Second Transient Toast (Non-sticky, auto-dismissing) ── */}
      {isVisible && (
        <aside
          role="status"
          aria-live="polite"
          aria-label="Install App Toast"
          className="fixed top-24 left-3 right-3 sm:left-auto sm:right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="max-w-md w-full pointer-events-auto bg-black/95 dark:bg-[#0c0c0c]/95 border border-emerald-500/40 text-white rounded-2xl shadow-2xl shadow-emerald-500/10 backdrop-blur-xl p-3 sm:p-3.5 relative overflow-hidden transition-all">
            <div className="flex items-center justify-between gap-3">
              {/* App Icon + Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1px] shrink-0 shadow-md shadow-emerald-500/20">
                  <div className="w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
                    <Image
                      src="/logo.png"
                      alt="UmeaFX"
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black tracking-tight text-white truncate">
                      Install Umea<span className="text-emerald-400">FX</span> App
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Sparkles className="w-2 h-2" />
                      FAST
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                    Tap to add to Home Screen • Standalone 24/7 access
                  </p>
                </div>
              </div>

              {/* Install CTA + Dismiss */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs transition-all shadow-md shadow-emerald-500/25 flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="w-3 h-3" />
                  <span>Install</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 5-second depleting indicator bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{
                  animation: "toast-progress 5s linear forwards",
                }}
              />
            </div>
          </div>
        </aside>
      )}

      {/* ── iOS Add-to-Home-Screen Instructions Modal ── */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-3xl max-w-sm w-full p-6 text-center relative shadow-2xl animate-in slide-in-from-bottom duration-300">
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1px] mx-auto mb-3 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                <Image src="/logo.png" alt="UmeaFX" width={56} height={56} className="object-cover" />
              </div>
            </div>

            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              Install UmeaFX on iOS
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 mb-5">
              Install directly to your iPhone or iPad home screen in 2 quick taps:
            </p>

            <div className="space-y-3 text-left mb-6">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-xs text-gray-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-bold font-mono">
                  1
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <span>Tap Safari's</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Share className="w-3.5 h-3.5" /> Share
                  </span>
                  <span>button below</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-xs text-gray-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-bold font-mono">
                  2
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <span>Scroll down & tap</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition shadow-lg shadow-emerald-500/20"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
