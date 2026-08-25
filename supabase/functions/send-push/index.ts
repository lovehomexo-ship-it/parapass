import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// ═══════════════════════════════════════════════════════════════════════════
// send-push — envoie une notification Web Push au DESTINATAIRE légitime.
//
// SÉCURITÉ : le client n'envoie JAMAIS le destinataire ni le contenu. Il fournit
// seulement l'identifiant de l'objet (message / saut). La fonction relit la
// donnée en base avec la clé de service et vérifie que l'appelant en est bien
// l'auteur, puis dérive destinataire + texte. Impossible d'usurper ou de
// spammer un utilisateur tiers.
//
// Les clés VAPID viennent des variables d'environnement (jamais du code).
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Payload { type?: 'message' | 'saut_a_valider'; message_id?: string; saut_id?: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@parapass.fr';
    if (!vapidPublic || !vapidPrivate) {
      console.error('Clés VAPID absentes : notifications push non configurées.');
      return json({ error: 'Push non configuré sur ce serveur.' }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Identifier l'appelant via SON jeton (RLS respectée).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Non authentifié.' }, 401);

    const body = (await req.json()) as Payload;
    const admin = createClient(supabaseUrl, serviceKey);

    // 2) Dériver destinataire + contenu DEPUIS LA BASE, après vérification.
    let destinataireId: string;
    let titre: string;
    let corps: string;
    let url: string;
    let tag: string;

    if (body.type === 'message' && body.message_id) {
      const { data: msg, error } = await admin
        .from('messages')
        .select('id, conversation_id, expediteur_id, destinataire_id, contenu')
        .eq('id', body.message_id)
        .maybeSingle();
      if (error) throw error;
      if (!msg) return json({ error: 'Message introuvable.' }, 404);
      // L'appelant DOIT être l'expéditeur du message.
      if (msg.expediteur_id !== user.id) return json({ error: 'Non autorisé.' }, 403);

      const { data: expediteur } = await admin
        .from('profiles').select('prenom, nom').eq('id', msg.expediteur_id).maybeSingle();
      const nom = expediteur ? `${expediteur.prenom ?? ''} ${expediteur.nom ?? ''}`.trim() : 'ParaPass';

      destinataireId = msg.destinataire_id;
      titre = nom || 'Nouveau message';
      // Aperçu volontairement court : pas d'exposition inutile de données.
      corps = (msg.contenu ?? '').slice(0, 120);
      url = `/messages?conversation=${msg.conversation_id}`;
      tag = `conv-${msg.conversation_id}`;

    } else if (body.type === 'saut_a_valider' && body.saut_id) {
      const { data: saut, error } = await admin
        .from('sauts')
        .select('id, parachutiste_id, moniteur_id, date_saut, statut')
        .eq('id', body.saut_id)
        .maybeSingle();
      if (error) throw error;
      if (!saut) return json({ error: 'Saut introuvable.' }, 404);
      // L'appelant DOIT être le parachutiste qui demande la validation.
      if (saut.parachutiste_id !== user.id) return json({ error: 'Non autorisé.' }, 403);
      if (!saut.moniteur_id) return json({ ok: true, envoyes: 0, raison: 'aucun moniteur' });

      const { data: para } = await admin
        .from('profiles').select('prenom, nom').eq('id', saut.parachutiste_id).maybeSingle();
      const nom = para ? `${para.prenom ?? ''} ${para.nom ?? ''}`.trim() : 'Un parachutiste';

      destinataireId = saut.moniteur_id;
      titre = 'Saut à valider';
      corps = `${nom} demande la validation d'un saut du ${saut.date_saut}.`;
      url = '/validations';
      tag = `saut-${saut.id}`;

    } else {
      return json({ error: 'Requête invalide.' }, 400);
    }

    // 3) Abonnements actifs du destinataire (clé de service : le destinataire
    //    n'est pas l'appelant, donc hors RLS).
    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', destinataireId)
      .eq('actif', true);
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) return json({ ok: true, envoyes: 0, raison: 'aucun abonnement' });

    const contenu = JSON.stringify({ titre, corps, url, tag });
    let envoyes = 0;
    const perimes: string[] = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          contenu,
        );
        envoyes++;
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode;
        // 404/410 = abonnement périmé → on le désactive au lieu de réessayer sans fin.
        if (statut === 404 || statut === 410) {
          perimes.push(s.id);
        } else {
          console.error('Envoi push échoué (abonnement ' + s.id + ') :', e);
        }
      }
    }));

    if (perimes.length > 0) {
      const { error: majError } = await admin
        .from('push_subscriptions')
        .update({ actif: false, desactive_le: new Date().toISOString(), derniere_erreur: 'abonnement expiré' })
        .in('id', perimes);
      if (majError) console.error('Désactivation des abonnements périmés échouée :', majError);
    }

    return json({ ok: true, envoyes, desactives: perimes.length });
  } catch (e) {
    // Erreur tracée, jamais silencieuse. L'appelant ignore l'échec (la push est
    // un bonus : le message/saut est déjà enregistré).
    console.error('send-push : erreur inattendue :', e);
    return json({ error: e instanceof Error ? e.message : 'Erreur interne.' }, 500);
  }
});
