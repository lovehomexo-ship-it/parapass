/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// ═══════════════════════════════════════════════════════════════════════════
// Service worker ParaPass — UNIQUE service worker de l'app.
// Reprend le pré-cache Workbox (identique au comportement précédent) et ajoute
// la réception des notifications push (Web Push / VAPID).
// ═══════════════════════════════════════════════════════════════════════════

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Pré-cache généré au build (inchangé par rapport à generateSW).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Mise à jour immédiate (équivalent skipWaiting + clientsClaim d'avant).
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Réception d'une notification push ──────────────────────────────────────
interface PushPayload {
  titre?: string;
  corps?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  // Payload JSON envoyé par l'Edge Function. Repli explicite si absent/illisible :
  // on notifie quand même plutôt que d'échouer en silence.
  let data: PushPayload = {};
  if (event.data) {
    try {
      data = event.data.json() as PushPayload;
    } catch {
      data = { corps: event.data.text() };
    }
  }

  const titre = data.titre || 'ParaPass';
  const options: NotificationOptions = {
    body: data.corps || 'Vous avez une nouvelle notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // tag : une notification par conversation, évite l'empilement.
    tag: data.tag || 'parapass',
    data: { url: data.url || '/messages' },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

// ─── Clic sur la notification : ouvrir/refocaliser la bonne page ────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = (event.notification.data as { url?: string } | undefined)?.url || '/messages';

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Onglet ParaPass déjà ouvert → on le refocalise et on y navigue.
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(cible); } catch { /* navigation refusée : on garde le focus */ }
          }
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
