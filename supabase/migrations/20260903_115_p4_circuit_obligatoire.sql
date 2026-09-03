-- ════════════════════════════════════════════════════════════════════════════
-- P4 / F05 — UN BRIEFING PUBLIÉ A UN CIRCUIT. Sans exception.
--
-- CONSTAT MESURÉ AVANT ÉCRITURE
--   14 briefings en base, 14 publiés, dont 3 SANS circuit.
--   Les trois sont ceux du générateur de démonstration (BigAir Rochefort,
--   02 et 03/09/2026) : l'outil de démo publiait donc exactement ce que la
--   règle interdit. Corrigé côté application dans la même livraison.
--
--   Le garde-fou existait déjà dans UN écran (BriefingSection.publish refuse
--   sans circuitActifId), mais nulle part ailleurs :
--     • publier_revision_briefing hérite du circuit_id précédent — une
--       révision d'un briefing sans circuit reste sans circuit ;
--     • un insert direct par l'API passe sans rien demander.
--   Une règle qui ne tient que dans un formulaire n'est pas une règle.
--
-- CONSÉQUENCE OPÉRATIONNELLE À CONNAÎTRE AVANT D'APPLIQUER
--   Royan Océan Parachutisme n'a AUCUN circuit tracé. Après cette migration,
--   ce centre ne pourra plus publier de briefing tant qu'il n'en aura pas
--   dessiné un. C'est l'effet voulu — un briefing sans circuit d'atterrissage
--   n'est pas un briefing — mais c'est un blocage réel pour ce centre.
--
-- CHOIX : NOT VALID
--   La contrainte s'applique aux écritures NOUVELLES et laisse vivre les
--   3 lignes historiques. Réécrire du passé pour satisfaire une règle du
--   présent serait falsifier des briefings déjà acquittés par des personnes.
--   Quand ces lignes auront été traitées, on pourra jouer le VALIDATE fourni
--   en fin de fichier.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · La règle, en base ───────────────────────────────────────────────────
-- Un briefing en cours de rédaction (published_at is null) n'a pas encore à
-- porter de circuit : c'est la PUBLICATION qui l'exige.
alter table dz_briefings
  add constraint dz_briefings_circuit_obligatoire
  check (published_at is null or circuit_id is not null)
  not valid;

comment on constraint dz_briefings_circuit_obligatoire on dz_briefings is
  'P4 — un briefing publié désigne toujours le circuit d''atterrissage en vigueur. NOT VALID : 3 lignes de démonstration antérieures sont tolérées.';

-- ── 2 · Le circuit doit appartenir au centre qui publie ─────────────────────
-- Sans ça, la contrainte ci-dessus se contente de n'importe quel uuid de
-- circuit — y compris celui d'une AUTRE DZ. Un circuit d'atterrissage publié
-- pour le mauvais terrain est pire que pas de circuit du tout.
create or replace function dz_briefings_circuit_du_meme_centre()
returns trigger language plpgsql as $$
begin
  if new.circuit_id is not null
     and not exists (select 1 from dz_circuits c
                     where c.id = new.circuit_id and c.dz_id = new.dz_id) then
    raise exception
      'Le circuit % n''appartient pas au centre % — un briefing ne peut pas publier le circuit d''une autre DZ.',
      new.circuit_id, new.dz_id
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_dz_briefings_circuit_du_meme_centre on dz_briefings;
create trigger trg_dz_briefings_circuit_du_meme_centre
  before insert or update of circuit_id, dz_id on dz_briefings
  for each row execute function dz_briefings_circuit_du_meme_centre();

-- ── 3 · Le chemin de révision cesse d'hériter d'un trou ─────────────────────
-- publier_revision_briefing faisait coalesce(nouveau, ancien). Si l'ancien
-- n'avait pas de circuit et que la révision n'en fournit pas, la révision
-- naissait sans circuit. La contrainte du 1 la refuserait désormais avec un
-- message illisible ; on préfère dire pourquoi.
create or replace function publier_revision_briefing_verifie_circuit()
returns trigger language plpgsql as $$
begin
  if new.published_at is not null and new.circuit_id is null then
    raise exception
      'Publication refusée : sélectionnez le circuit d''atterrissage du jour avant de publier.'
      using errcode = '23514', hint = 'Onglet Briefing → carte « Circuit qui sera publié aujourd''hui ».';
  end if;
  return new;
end $$;

drop trigger if exists trg_dz_briefings_message_circuit on dz_briefings;
create trigger trg_dz_briefings_message_circuit
  before insert or update on dz_briefings
  for each row execute function publier_revision_briefing_verifie_circuit();

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- À JOUER PLUS TARD, une fois les 3 briefings de démonstration retirés
-- (bouton « Retirer la démo ») ou rattachés à un circuit :
--
--   alter table dz_briefings validate constraint dz_briefings_circuit_obligatoire;
--
-- Pour vérifier qu'il ne reste rien à traiter :
--
--   select date_briefing, revision, dz_id from dz_briefings
--   where published_at is not null and circuit_id is null;
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- P4 bis — LE GÉNÉRATEUR DE DÉMONSTRATION PUBLIAIT SANS CIRCUIT
--
-- Son INSERT écrit la consigne « circuit main gauche » en toutes lettres tout
-- en laissant circuit_id à NULL. Il annonçait donc un circuit qu'il ne
-- désignait pas — et c'est la source des 3 lignes non conformes en base.
--
-- POURQUOI UN PATCH PAR EXPRESSION RÉGULIÈRE, ET PAS UN CREATE OR REPLACE
-- COMPLET : la définition vivante de generer_demo_journee (151 lignes) n'est
-- reproduite par AUCUNE migration du dépôt — elle a été appliquée directement.
-- Recopier ici une version reconstituée risquerait d'écraser silencieusement
-- des différences que je ne vois pas. On modifie donc UNE instruction, en
-- partant de la définition réellement en place, et on échoue bruyamment si
-- elle a encore bougé.
--
-- (Le problème de fond — dépôt et base divergents — reste entier et mérite
--  d'être traité séparément : les migrations ne reconstruisent plus la base.)
-- ════════════════════════════════════════════════════════════════════════════

do $patch$
declare
  v_src  text;
  v_ancien text := 'INSERT INTO dz_briefings (dz_id, date_briefing, vent_direction_deg, vent_vitesse_kt, consignes, published_at)';
  v_nouveau text := 'INSERT INTO dz_briefings (dz_id, date_briefing, circuit_id, vent_direction_deg, vent_vitesse_kt, consignes, published_at)';
  v_ancien_val text := 'VALUES (p_centre_id, v_today, 270, 12,';
  v_nouveau_val text := 'VALUES (p_centre_id, v_today, (SELECT c.id FROM dz_circuits c WHERE c.dz_id = p_centre_id AND c.actif ORDER BY c.nom LIMIT 1), 270, 12,';
begin
  select pg_get_functiondef(oid) into v_src
  from pg_proc where proname = 'generer_demo_journee';

  if v_src is null then
    raise exception 'generer_demo_journee introuvable — migration à revoir.';
  end if;
  if position(v_ancien in v_src) = 0 or position(v_ancien_val in v_src) = 0 then
    raise exception
      'La définition de generer_demo_journee a changé : le patch ne s''applique plus. Corrigez l''INSERT dz_briefings à la main plutôt que de forcer.';
  end if;

  v_src := replace(v_src, v_ancien, v_nouveau);
  v_src := replace(v_src, v_ancien_val, v_nouveau_val);
  execute v_src;

  raise notice 'generer_demo_journee : le briefing de démonstration désigne désormais un circuit actif du centre.';
end $patch$;

-- Un centre sans circuit tracé ne peut plus générer de briefing de démo : le
-- sous-select rend NULL et la contrainte refuse. C'est exact — mieux vaut une
-- démo qui refuse de mentir qu'une démo qui montre l'interdit.

-- ── Les 3 lignes historiques : rattachées, pas réécrites ────────────────────
-- On ne touche QUE des briefings de démonstration ([DÉMO] dans les consignes),
-- et seulement pour leur donner le circuit que leur propre texte annonçait.
update dz_briefings b
   set circuit_id = (select c.id from dz_circuits c
                     where c.dz_id = b.dz_id and c.actif order by c.nom limit 1)
 where b.published_at is not null
   and b.circuit_id is null
   and b.consignes like '[DÉMO]%'
   and exists (select 1 from dz_circuits c where c.dz_id = b.dz_id and c.actif);
