import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Thème posé AVANT le premier rendu (pas d'éclair) : le choix explicite s'il y
// en a un, sinon celui du téléphone — même règle que ThemeContext.
const prefTheme = (() => { try { return localStorage.getItem('parapass_theme_pref'); } catch { return null; } })();
const themeInitial = prefTheme === 'light' || prefTheme === 'dark'
  ? prefTheme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches === false ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', themeInitial);

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
    // Cadre adaptatif (pas de taille fixe), texte qui passe à la ligne si besoin,
    // bouton non rétrécissable au contenu centré — dimensionné pour le français.
    banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px 14px;background:#0B1D3A;color:#fff;border:1.5px solid #F97316;border-radius:14px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font:600 14px/1.4 system-ui,sans-serif;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;';
    const label = document.createElement('span');
    label.textContent = 'Nouvelle version de ParaPass disponible';
    label.style.cssText = 'flex:1 1 auto;min-width:0;text-align:center;';
    banner.appendChild(label);
    const btn = document.createElement('button');
    btn.textContent = 'Actualiser';
    btn.style.cssText = 'flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;background:#F97316;color:#fff;border:none;border-radius:10px;padding:0 20px;font:700 14px/1 system-ui,sans-serif;cursor:pointer;min-height:44px;';
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
