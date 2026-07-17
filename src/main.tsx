import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply saved theme immediately to prevent flash of unstyled content
const savedTheme = localStorage.getItem('parapass_theme');
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');

// ─── Mise à jour du bundle PWA ────────────────────────────────────────────────
// Sans ceci, un téléphone qui garde l'app ouverte (ou installée) reste sur
// l'ancien bundle précaché par le service worker : les nouveaux composants
// n'existent tout simplement pas dans son DOM.
if ('serviceWorker' in navigator) {
  // Quand un nouveau service worker prend le contrôle (skipWaiting), on recharge
  // une seule fois pour servir le bundle à jour.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  // Vérifie une mise à jour au retour au premier plan et toutes les 15 minutes.
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => { /* hors ligne : réessai plus tard */ });
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  setInterval(checkForUpdate, 15 * 60_000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
