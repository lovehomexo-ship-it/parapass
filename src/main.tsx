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
  // Quand un nouveau service worker prend le contrôle (skipWaiting), le bundle
  // à jour est prêt : on prévient l'utilisateur avec une bannière « Actualiser »
  // plutôt que de recharger sous ses doigts (il peut être en pleine saisie).
  // Si l'onglet est en arrière-plan, on recharge silencieusement.
  let refreshing = false;
  const doReload = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };
  const showUpdateBanner = () => {
    if (document.getElementById('pp-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pp-update-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;align-items:center;gap:12px;background:#0B1D3A;color:#fff;border:1.5px solid #F97316;border-radius:14px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font:600 14px system-ui,sans-serif;max-width:calc(100vw - 32px);';
    banner.innerHTML = '<span>Nouvelle version de ParaPass disponible</span>';
    const btn = document.createElement('button');
    btn.textContent = 'Actualiser';
    btn.style.cssText = 'background:#F97316;color:#fff;border:none;border-radius:10px;padding:10px 18px;font:700 14px system-ui,sans-serif;cursor:pointer;min-height:44px;';
    btn.onclick = doReload;
    banner.appendChild(btn);
    document.body.appendChild(banner);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (document.hidden) doReload();
    else showUpdateBanner();
  });
  // Si l'utilisateur ignore la bannière, la version à jour sera servie au
  // prochain chargement de page (index.html en no-cache côté Vercel).
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
