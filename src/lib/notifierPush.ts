import { supabase } from './supabase';

// Déclenche l'envoi d'une notification push côté serveur (Edge Function).
// NE BLOQUE JAMAIS l'action métier : le message / le saut est déjà enregistré.
// Un échec est tracé explicitement (jamais silencieux) mais n'est pas remonté
// à l'utilisateur — la push est un bonus, la messagerie interne reste le canal
// fiable.
export async function notifierPush(
  payload: { type: 'message'; message_id: string } | { type: 'saut_a_valider'; saut_id: string },
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', { body: payload });
    if (error) { console.error('Notification push non envoyée :', error); return; }
    if (data && (data as { error?: string }).error) {
      console.error('Notification push refusée par le serveur :', (data as { error?: string }).error);
    }
  } catch (e) {
    console.error('Notification push non envoyée (exception) :', e);
  }
}
