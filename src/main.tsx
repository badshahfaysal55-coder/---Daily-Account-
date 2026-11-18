import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const AUTO_SW_RELOAD_KEY = 'zara_sw_last_reload_at';
const isNativeCapacitor = Capacitor.isNativePlatform();

if (!isNativeCapacitor) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true).catch(() => {});
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForSwUpdate = () => {
        registration.update().catch(() => {});
      };

      // Periodically check for PWA service worker updates (every 30s) and on focus/online
      setInterval(checkForSwUpdate, 30 * 1000);
      window.addEventListener('focus', checkForSwUpdate);
      window.addEventListener('online', checkForSwUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForSwUpdate();
        }
      });
    },
  });

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    let hasController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hasController) {
        hasController = true;
        return;
      }
      try {
        const lastReload = Number(sessionStorage.getItem(AUTO_SW_RELOAD_KEY) || '0');
        if (Date.now() - lastReload < 10000) return;
        sessionStorage.setItem(AUTO_SW_RELOAD_KEY, String(Date.now()));
      } catch {
        // ignore storage errors
      }
      (window as any).__zaraPageUnloading = true;
      window.location.reload();
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
