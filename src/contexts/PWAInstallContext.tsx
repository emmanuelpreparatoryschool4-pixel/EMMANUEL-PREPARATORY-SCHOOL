'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Modal } from '@/components/ui/Modal';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallContextType {
  canInstall: boolean;
  isInstalled: boolean;
  installApp: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const PWAInstallContext = createContext<PWAInstallContextType | undefined>(undefined);

function subscribeToInstallStatus(callback: () => void) {
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    mediaQuery.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
}

function getInstallStatus() {
  const appleStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || appleStandalone;
}

function getServerInstallStatus() {
  return false;
}

export function PWAInstallProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installedFromPrompt, setInstalledFromPrompt] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const isInstalled = useSyncExternalStore(subscribeToInstallStatus, getInstallStatus, getServerInstallStatus) || installedFromPrompt;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstalledFromPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return 'unavailable' as const;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    return outcome;
  }, [installPrompt]);

  return (
    <PWAInstallContext.Provider value={{
      canInstall: Boolean(installPrompt),
      isInstalled,
      installApp,
    }}>
      {children}
      <InstallHelpDialog isOpen={showInstallHelp} onClose={() => setShowInstallHelp(false)} />
    </PWAInstallContext.Provider>
  );
}

function InstallHelpDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const isAppleMobile = typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Install EPS on this device" size="sm">
      {isAppleMobile ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>Open this page in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose <strong>Add to Home Screen</strong>, then tap Add.</li>
        </ol>
      ) : isAndroid ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>Open this page in Chrome.</li>
          <li>Tap the three-dot menu.</li>
          <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>In Chrome or Edge, open the browser menu.</li>
          <li>Choose <strong>Install page as app</strong> or use the install icon in the address bar.</li>
          <li>Confirm <strong>Install</strong> in the browser dialog.</li>
        </ol>
      )}
      <p className="mt-4 text-xs text-gray-500">
        Browsers control installation prompts; this option is available when the browser supports app installation.
      </p>
    </Modal>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (!context) throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  return context;
}