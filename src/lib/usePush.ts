import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// Notifications push (Web Push / VAPID) — côté client.
//
// Contraintes Apple (non négociables, elles pilotent toute la logique) :
//  · iOS : push disponible UNIQUEMENT si l'app est lancée depuis l'écran
//    d'accueil (mode standalone), iOS 16.4+. Dans un onglet Safari, l'API
//    n'existe pas → on guide l'utilisateur au lieu d'échouer en silence.
//  · La permission ne peut être demandée QUE sur une action utilisateur.
//
// La push est un BONUS : la messagerie interne (pastille non-lus) reste le
// canal fiable. Aucun échec ici ne doit empêcher de recevoir ses messages.
// ═══════════════════════════════════════════════════════════════════════════

export type EtatPush =
  | 'non_supporte'        // navigateur sans Web Push (ex. Safari desktop ancien)
  | 'ios_hors_accueil'    // iOS dans un onglet : il faut installer l'app d'abord
  | 'a_activer'           // possible, pas encore demandé
  | 'refuse'              // permission refusée (ne pas reharceler)
  | 'actif';              // abonné

/** iOS/iPadOS, y compris iPadOS qui se présente comme un Mac tactile. */
function estIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** App lancée depuis l'écran d'accueil (PWA installée). */
export function estStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Clé publique VAPID (jamais de clé privée côté client). */
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** base64url → Uint8Array, format attendu par PushManager. */
function base64UrlVersUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush(userId: string | undefined) {
  const [etat, setEtat] = useState<EtatPush>('a_activer');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // État initial : que peut-on faire sur CET appareil ?
  useEffect(() => {
    const supporte =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!supporte) {
      // Sur iOS hors écran d'accueil, l'API n'existe tout simplement pas :
      // message d'aide explicite plutôt qu'un bouton qui échouerait.
      setEtat(estIOS() && !estStandalone() ? 'ios_hors_accueil' : 'non_supporte');
      return;
    }
    if (estIOS() && !estStandalone()) { setEtat('ios_hors_accueil'); return; }
    if (Notification.permission === 'denied') { setEtat('refuse'); return; }

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setEtat(sub ? 'actif' : 'a_activer'))
        .catch((e) => {
          console.error('Lecture de l\'abonnement push échouée :', e);
          setEtat('a_activer');
        });
      return;
    }
    setEtat('a_activer');
  }, []);

  /** À appeler UNIQUEMENT depuis un clic utilisateur (exigence Safari/iOS). */
  const activer = useCallback(async (): Promise<boolean> => {
    setErreur(null);
    if (!userId) { setErreur('Session introuvable — reconnectez-vous.'); return false; }
    if (!VAPID_PUBLIC) {
      // Erreur explicite : sans clé publique, l'abonnement est impossible.
      console.error('VITE_VAPID_PUBLIC_KEY absente : notifications push non configurées.');
      setErreur('Notifications non configurées sur ce serveur.');
      return false;
    }

    setEnCours(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'a_activer');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const existante = await reg.pushManager.getSubscription();
      const sub = existante ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlVersUint8(VAPID_PUBLIC),
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Abonnement push incomplet renvoyé par le navigateur.');
      }

      // upsert sur endpoint : réactive un abonnement précédemment désactivé.
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        actif: true,
        user_agent: navigator.userAgent.slice(0, 300),
        derniere_erreur: null,
        desactive_le: null,
      }, { onConflict: 'endpoint' });
      if (error) throw error;

      setEtat('actif');
      return true;
    } catch (e) {
      console.error('Activation des notifications push échouée :', e);
      setErreur(e instanceof Error ? e.message : 'Activation impossible.');
      return false;
    } finally {
      setEnCours(false);
    }
  }, [userId]);

  /** Désactivation : on retire l'abonnement du navigateur ET de la base. */
  const desactiver = useCallback(async (): Promise<void> => {
    setEnCours(true);
    setErreur(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        if (error) console.error('Suppression de l\'abonnement en base échouée :', error);
      }
      setEtat('a_activer');
    } catch (e) {
      console.error('Désactivation des notifications push échouée :', e);
      setErreur('Désactivation impossible.');
    } finally {
      setEnCours(false);
    }
  }, []);

  return { etat, enCours, erreur, activer, desactiver };
}
