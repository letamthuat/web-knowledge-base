"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

const DISMISSED_KEY = "pwa-install-dismissed-until";

interface PwaContextValue {
  isStandalone: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  showIOSGuide: boolean;
  bannerVisible: boolean;
  promptInstall: () => Promise<boolean>;
  openIOSGuide: () => void;
  closeIOSGuide: () => void;
  dismissBanner: (days?: number) => void;
  updateApp: () => void;
  clearCacheAndReload: () => Promise<void>;
}

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

  const deferredPromptRef = useRef<any>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  // 1. Detect Standalone / iOS
  useEffect(() => {
    if (typeof window === "undefined") return;

    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const checkStandalone = () => {
      const isStandaloneMode =
        standaloneMedia.matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    standaloneMedia.addEventListener("change", checkStandalone);

    const ua = navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Initial check for dismissed banner
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    const isDismissed = dismissedUntil && Date.now() < parseInt(dismissedUntil, 10);

    if (!isDismissed && !(standaloneMedia.matches || (window.navigator as any).standalone === true)) {
      if (isIosDevice) {
        // iOS devices don't fire beforeinstallprompt, but we can offer manual guidance
        setBannerVisible(true);
      }
    }

    return () => {
      standaloneMedia.removeEventListener("change", checkStandalone);
    };
  }, []);

  // 2. Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsInstallable(true);

      const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
      const isDismissed = dismissedUntil && Date.now() < parseInt(dismissedUntil, 10);
      if (!isDismissed) {
        setBannerVisible(true);
      }
    }

    function handleAppInstalled() {
      setIsInstallable(false);
      setIsStandalone(true);
      setBannerVisible(false);
      deferredPromptRef.current = null;
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 3. Online / Offline listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 4. Service Worker updates detection
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        waitingWorkerRef.current = registration.waiting;
        setUpdateAvailable(true);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = newWorker;
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Lần cài SW đầu tiên cũng bắn controllerchange (clients.claim) — không reload lúc đó
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (isIOS) {
      setShowIOSGuide(true);
      return false;
    }

    if (!deferredPromptRef.current) {
      return false;
    }

    try {
      deferredPromptRef.current.prompt();
      const choice = await deferredPromptRef.current.userChoice;
      if (choice.outcome === "accepted") {
        setBannerVisible(false);
        setIsInstallable(false);
        deferredPromptRef.current = null;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [isIOS]);

  const openIOSGuide = useCallback(() => {
    setShowIOSGuide(true);
  }, []);

  const closeIOSGuide = useCallback(() => {
    setShowIOSGuide(false);
  }, []);

  const dismissBanner = useCallback((days = 7) => {
    const expireTime = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, expireTime.toString());
    setBannerVisible(false);
  }, []);

  const updateApp = useCallback(() => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }, []);

  const clearCacheAndReload = useCallback(async () => {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    window.location.reload();
  }, []);

  const value: PwaContextValue = {
    isStandalone,
    isInstallable,
    isIOS,
    isOnline,
    updateAvailable,
    showIOSGuide,
    bannerVisible,
    promptInstall,
    openIOSGuide,
    closeIOSGuide,
    dismissBanner,
    updateApp,
    clearCacheAndReload,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return ctx;
}
