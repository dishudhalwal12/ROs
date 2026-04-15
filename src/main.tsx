import { StrictMode } from 'react';

import { App } from '@/app/App';
import '@/styles/global.css';

const reactDevToolsMessage = 'Download the React DevTools for a better development experience';

function suppressDevelopmentNoise() {
  const originalInfo = console.info.bind(console);
  console.info = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(reactDevToolsMessage)) {
      return;
    }

    originalInfo(...args);
  };
}

function registerServiceWorker() {
  const isLocalhost = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

  if (isLocalhost && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        keys.forEach((key) => {
          void caches.delete(key);
        });
      });
    }
    return;
  }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js');
    });
  }
}

if (import.meta.env.DEV) {
  suppressDevelopmentNoise();
}

registerServiceWorker();

async function mountApp() {
  const { createRoot } = await import('react-dom/client');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void mountApp();
