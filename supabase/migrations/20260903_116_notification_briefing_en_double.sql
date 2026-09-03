-- ════════════════════════════════════════════════════════════════════════════
-- NOTIFICATION DE BRIEFING EN DOUBLE — trouvé en vérifiant les triggers de P4.
--
-- CONSTAT MESURÉ
--   Deux triggers écrivent dans `notifications` sur le MÊME événement :
--     trg_notify_briefing    → notify_briefing_published()   (le plus ancien)
--     trg_notifier_briefing  → trg_notifier_briefing()       (P8, 20260903_114)
--   tous deux AFTER INSERT OR UPDATE OF published_at sur dz_briefings.
--
--   Effet en production, au 03/09/2026 :
--     • 831 notifications de type 'briefing' pour 51 personnes → 16,3 chacune
--     • une même personne a reçu 3 notifications IDENTIQUES dans la même
--       minute (« Briefing du jour publié — BigAir Rochefort », 07 h 16)
--
--   Une notification qui arrive en triple n'informe plus : elle apprend à
--   l'utilisateur à ignorer la catégorie entière. C'est exactement l'effet
--   inverse de celui recherché par P8.
--
-- LEQUEL GARDER — comparé, pas deviné
--   notify_briefing_published : ne connaît pas les révisions. Une révision de
--     briefing ne notifie donc personne, alors que c'est justement le cas où
--     il faut prévenir (« relisez la mise à jour »).
--   trg_notifier_briefing : gère les révisions, et c'est celui que P8 a conçu
--     avec sa logique anti-empilement (3 révisions → 25 notifications pour
--     25 destinataires, vérifié à l'époque).
--   → on garde le second, on retire le premier.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   Elle ne supprime AUCUNE notification déjà reçue. Les 831 lignes restent :
--   ce sont des messages que des personnes ont réellement vus, et les effacer
--   réécrirait leur historique. Une requête de nettoyage est proposée en
--   commentaire, à jouer seulement si tu le décides.
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop trigger if exists trg_notify_briefing on dz_briefings;

-- La fonction est conservée : si le choix devait être revu, elle est encore là
-- et il suffirait de rattacher son trigger. Rien n'est perdu, seul le
-- déclenchement en double disparaît.
comment on function notify_briefing_published() is
  'Détachée le 03/09/2026 : faisait doublon avec trg_notifier_briefing (P8), qui gère en plus les révisions. Fonction conservée, trigger retiré.';

commit;

-- ── APPLIQUÉE LE 03/09/2026, vérifiée après coup ────────────────────────────
--   Triggers restants sur dz_briefings :
--     trg_dz_briefings_circuit_du_meme_centre   (P4)
--     trg_dz_briefings_message_circuit          (P4)
--     trg_journal_briefing
--     trg_notifier_briefing                     (P8 — le seul qui notifie)
--   trg_notify_briefing a bien disparu ; notify_briefing_published() existe
--   toujours, commentée : la rattacher suffirait à revenir en arrière.
--
--   Le nettoyage des 831 notifications historiques n'a PAS été fait : ce sont
--   des messages que des personnes ont réellement reçus. La requête reste
--   ci-dessous, à jouer sur décision seulement.
--
-- ── Vérification après application ──────────────────────────────────────────
--   select tgname from pg_trigger
--   where tgrelid = 'dz_briefings'::regclass and not tgisinternal;
--   → trg_notify_briefing ne doit plus y figurer.
--
-- ── Nettoyage FACULTATIF de l'historique, à ne jouer que sur décision ───────
-- Ne garde qu'une notification par (personne, minute, titre), la plus ancienne.
-- Efface des messages réellement reçus : à faire en connaissance de cause.
--
--   with doublons as (
--     select id, row_number() over (
--              partition by user_id, titre, date_trunc('minute', created_at)
--              order by created_at) as rang
--     from notifications where type = 'briefing')
--   delete from notifications n using doublons d
--   where n.id = d.id and d.rang > 1;
-- ════════════════════════════════════════════════════════════════════════════
