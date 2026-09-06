-- ════════════════════════════════════════════════════════════════════════════
-- FEU VERT · P4 — Journal chaîné, ajout seul, export vérifiable.
--
-- La propriété technique sur laquelle repose tout le dossier assureur : ce
-- qui est écrit ici ne se modifie pas, ne se supprime pas, et un tiers peut
-- le vérifier sans nous croire sur parole.
--
-- CE QUE LA RLS NE PEUT PAS FAIRE, ET COMMENT ON LE FAIT QUAND MÊME
--   service_role contourne la RLS par construction (bypassrls). Une
--   politique « pas d'UPDATE » ne l'arrête donc pas. Ce qui l'arrête : un
--   TRIGGER BEFORE UPDATE / DELETE qui lève une exception — un trigger
--   s'exécute pour tous les rôles, superutilisateur compris. On pose les
--   deux : la RLS pour les rôles ordinaires, le trigger pour tous, et un
--   REVOKE par-dessus. Trois verrous, parce qu'un seul suffit à tromper.
--
-- LE CHAÎNAGE
--   hash = sha256( hash_precedent | centre_id | horodatage | type | charge )
--   calculé DANS le trigger BEFORE INSERT, jamais par le client. La forme
--   canonique de la charge (charge_canonique) et de l'horodatage
--   (horodatage_canonique) sont STOCKÉES à côté du hash : un tiers vérifie
--   en re-hachant ces textes tels quels, sans avoir à deviner comment
--   Postgres sérialise un jsonb ou formate une date.
--
-- LES HORODATAGES
--   horodatage_serveur est forcé à now() par le trigger : ce qu'un client
--   envoie dans cette colonne est écrasé. S'il a une heure à dire (mode
--   dégradé, P6), il la met dans horodatage_client — colonne distincte,
--   nommée pour ce qu'elle est.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── 1 · Les évaluations produites ───────────────────────────────────────────
create table if not exists evaluations (
  id                 uuid primary key default gen_random_uuid(),
  parachutiste_id    uuid not null references profiles(id),
  centre_id          uuid not null references centres(id),
  rotation_id        uuid references rotations(id),
  evalue_le          timestamptz not null default now(),
  verdict            text not null check (verdict in ('vert','orange','rouge','gris')),
  motifs             jsonb not null default '[]'::jsonb,
  version_referentiel text not null,
  regime             text not null check (regime in ('informatif','bloquant')),
  -- P6 : l'heure que le client a vue hors ligne, si différente. Jamais mélangée.
  horodatage_client  timestamptz,
  mode               text not null default 'connecte' check (mode in ('connecte','degrade'))
);

-- ── 2 · Les levées, dérogations, passages outre ─────────────────────────────
create table if not exists levees (
  id                  uuid primary key default gen_random_uuid(),
  evaluation_id       uuid not null references evaluations(id),
  code_regle          text not null,
  type                text not null check (type in ('levee','derogation','passage_outre')),
  auteur_id           uuid not null default auth.uid() references profiles(id),
  auteur_habilitation text not null check (auteur_habilitation in ('DT','moniteur','plieur','aucun')),
  -- Un motif vide n'est pas un motif. NOT NULL ne suffit pas : '' passe.
  motif               text not null check (length(trim(motif)) >= 3),
  portee              text not null check (portee in ('individu','rotation','centre')),
  valide_jusqu_a      timestamptz,
  cree_le             timestamptz not null default now(),
  horodatage_client   timestamptz
);

-- ── 3 · Le journal ──────────────────────────────────────────────────────────
create table if not exists journal_securite (
  id                    uuid primary key default gen_random_uuid(),
  -- Ordre total par centre : c'est lui qui définit « l'entrée précédente ».
  seq                   bigint generated always as identity,
  centre_id             uuid not null references centres(id),
  horodatage_serveur    timestamptz not null default now(),
  horodatage_client     timestamptz,
  type_evenement        text not null check (type_evenement in (
                          'evaluation_produite','levee_accordee','derogation_accordee',
                          'passage_outre_consigne','embarquement_consigne','regime_modifie',
                          'regle_activee','regle_desactivee','export_produit',
                          'instantane_refuse','ecart_verdict_degrade')),
  charge_utile          jsonb not null default '{}'::jsonb,
  -- Formes canoniques STOCKÉES : ce sont elles qu'un tiers re-hache.
  horodatage_canonique  text not null,
  charge_canonique      text not null,
  hash_precedent        text,
  hash                  text not null
);

create index if not exists journal_securite_centre_seq on journal_securite (centre_id, seq);
create index if not exists journal_securite_centre_date on journal_securite (centre_id, horodatage_serveur);

-- ── 4 · La chaîne, dans le trigger ──────────────────────────────────────────
create or replace function journal_securite_chainer()
returns trigger language plpgsql as $$
declare
  v_prec text;
  v_canon text;
begin
  -- Un centre à la fois : deux insertions simultanées ne doivent pas lire
  -- la même « précédente ». Verrou consultatif par centre, tenu jusqu'au
  -- commit de la transaction.
  perform pg_advisory_xact_lock(hashtext('journal_securite:' || new.centre_id::text));

  -- L'heure est celle du serveur, quoi que le client ait envoyé.
  new.horodatage_serveur := now();
  new.horodatage_canonique := to_char(new.horodatage_serveur at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  new.charge_canonique := new.charge_utile::text;

  select j.hash into v_prec from journal_securite j
   where j.centre_id = new.centre_id order by j.seq desc limit 1;
  new.hash_precedent := v_prec;  -- null pour la première entrée du centre

  v_canon := coalesce(new.hash_precedent, '') || '|' || new.centre_id::text || '|'
          || new.horodatage_canonique || '|' || new.type_evenement || '|' || new.charge_canonique;
  new.hash := encode(extensions.digest(convert_to(v_canon, 'UTF8'), 'sha256'), 'hex');
  return new;
end $$;

drop trigger if exists trg_journal_securite_chainer on journal_securite;
create trigger trg_journal_securite_chainer
  before insert on journal_securite
  for each row execute function journal_securite_chainer();

-- ── 5 · Inaltérabilité : pour TOUS les rôles ────────────────────────────────
create or replace function journal_inalterable()
returns trigger language plpgsql as $$
begin
  raise exception 'Table % : aucune modification ni suppression n''est possible, par personne. Une correction est une NOUVELLE entrée.', tg_table_name
    using errcode = '42501';
end $$;

do $$
declare t text;
begin
  foreach t in array array['evaluations','levees','journal_securite'] loop
    execute format('drop trigger if exists trg_%1$s_inalterable_upd on %1$s', t);
    execute format('create trigger trg_%1$s_inalterable_upd before update on %1$s for each row execute function journal_inalterable()', t);
    execute format('drop trigger if exists trg_%1$s_inalterable_del on %1$s', t);
    execute format('create trigger trg_%1$s_inalterable_del before delete on %1$s for each row execute function journal_inalterable()', t);
    -- Et truncate, qui ne passe pas par les triggers de ligne.
    execute format('drop trigger if exists trg_%1$s_inalterable_trunc on %1$s', t);
    execute format('create trigger trg_%1$s_inalterable_trunc before truncate on %1$s for each statement execute function journal_inalterable()', t);
    execute format('revoke update, delete, truncate on %1$s from public, anon, authenticated, service_role', t);
    execute format('alter table %1$s enable row level security', t);
  end loop;
end $$;

-- Lecture : le centre voit ses lignes ; le parachutiste, ses évaluations.
drop policy if exists evaluations_centre_lecture on evaluations;
create policy evaluations_centre_lecture on evaluations for select using (
  centre_id in (select centre_id from admin_centres where profile_id = auth.uid())
  or parachutiste_id = auth.uid());
drop policy if exists evaluations_centre_insert on evaluations;
create policy evaluations_centre_insert on evaluations for insert with check (
  centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

drop policy if exists levees_centre_lecture on levees;
create policy levees_centre_lecture on levees for select using (
  evaluation_id in (select id from evaluations where
    centre_id in (select centre_id from admin_centres where profile_id = auth.uid())
    or parachutiste_id = auth.uid()));
drop policy if exists levees_centre_insert on levees;
create policy levees_centre_insert on levees for insert with check (
  evaluation_id in (select id from evaluations where
    centre_id in (select centre_id from admin_centres where profile_id = auth.uid())));

drop policy if exists journal_centre_lecture on journal_securite;
create policy journal_centre_lecture on journal_securite for select using (
  centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));
-- Pas de policy INSERT directe : on écrit par les triggers ci-dessous et par
-- journaliser(), qui vérifie l'habilitation.

-- ── 6 · Ce qui s'écrit tout seul ────────────────────────────────────────────
create or replace function journal_apres_evaluation()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  insert into journal_securite (centre_id, type_evenement, charge_utile, horodatage_client)
  values (new.centre_id, 'evaluation_produite',
          jsonb_build_object('evaluation_id', new.id, 'parachutiste_id', new.parachutiste_id,
                             'rotation_id', new.rotation_id, 'verdict', new.verdict,
                             'version_referentiel', new.version_referentiel, 'regime', new.regime,
                             'mode', new.mode, 'nb_motifs', jsonb_array_length(new.motifs)),
          new.horodatage_client);
  return new;
end $$;
drop trigger if exists trg_journal_apres_evaluation on evaluations;
create trigger trg_journal_apres_evaluation after insert on evaluations
  for each row execute function journal_apres_evaluation();

create or replace function journal_apres_levee()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_centre uuid; v_para uuid;
begin
  select centre_id, parachutiste_id into v_centre, v_para from evaluations where id = new.evaluation_id;
  insert into journal_securite (centre_id, type_evenement, charge_utile, horodatage_client)
  values (v_centre,
          case new.type when 'levee' then 'levee_accordee'
                        when 'derogation' then 'derogation_accordee'
                        else 'passage_outre_consigne' end,
          jsonb_build_object('levee_id', new.id, 'evaluation_id', new.evaluation_id,
                             'parachutiste_id', v_para, 'code_regle', new.code_regle,
                             'auteur_id', new.auteur_id, 'auteur_habilitation', new.auteur_habilitation,
                             'motif', new.motif, 'portee', new.portee, 'valide_jusqu_a', new.valide_jusqu_a),
          new.horodatage_client);
  return new;
end $$;
drop trigger if exists trg_journal_apres_levee on levees;
create trigger trg_journal_apres_levee after insert on levees
  for each row execute function journal_apres_levee();

-- Le régime (reporté depuis P2, promis dans la migration 119).
create or replace function journal_apres_option()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if tg_op = 'INSERT' or (old.feu_vert_actif, old.feu_vert_bloquant, old.module_avionnage)
     is distinct from (new.feu_vert_actif, new.feu_vert_bloquant, new.module_avionnage) then
    insert into journal_securite (centre_id, type_evenement, charge_utile)
    values (new.centre_id, 'regime_modifie',
            jsonb_build_object('feu_vert_actif', new.feu_vert_actif, 'feu_vert_bloquant', new.feu_vert_bloquant,
                               'module_avionnage', new.module_avionnage, 'par', auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists trg_journal_apres_option on centres_options;
create trigger trg_journal_apres_option after insert or update on centres_options
  for each row execute function journal_apres_option();

-- Activation / désactivation d'une règle par un centre.
create or replace function journal_apres_regle()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if new.centre_id is null then return new; end if;  -- les lignes fédérales ne sont pas des gestes de centre
  if tg_op = 'INSERT' or old.actif is distinct from new.actif then
    insert into journal_securite (centre_id, type_evenement, charge_utile)
    values (new.centre_id, case when new.actif then 'regle_activee' else 'regle_desactivee' end,
            jsonb_build_object('code', new.code, 'version', new.version, 'par', auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists trg_journal_apres_regle on regles_securite;
create trigger trg_journal_apres_regle after insert or update of actif on regles_securite
  for each row execute function journal_apres_regle();

-- Les événements que l'application écrit elle-même (embarquement, export…).
create or replace function journaliser(p_centre_id uuid, p_type text, p_charge jsonb, p_horodatage_client timestamptz default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id uuid;
begin
  if not exists (select 1 from admin_centres a where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;
  insert into journal_securite (centre_id, type_evenement, charge_utile, horodatage_client)
  values (p_centre_id, p_type, coalesce(p_charge, '{}'::jsonb) || jsonb_build_object('par', auth.uid()), p_horodatage_client)
  returning id into v_id;
  return v_id;
end $$;

-- ── 7 · Vérifier la chaîne, en base ─────────────────────────────────────────
-- Recalcule chaque hash à partir des formes canoniques stockées et vérifie
-- le lien avec l'entrée précédente. S'arrête à la PREMIÈRE rupture.
create or replace function verifier_chaine(p_centre_id uuid, p_debut timestamptz default '-infinity', p_fin timestamptz default 'infinity')
returns table (valide boolean, premiere_rupture_id uuid, entrees int)
language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare
  r record; v_prec text := null; v_attendu text; v_n int := 0; v_premiere boolean := true;
begin
  if not exists (select 1 from admin_centres a where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;
  for r in select * from journal_securite j where j.centre_id = p_centre_id
             and j.horodatage_serveur between p_debut and p_fin order by j.seq loop
    v_n := v_n + 1;
    -- Sur une fenêtre partielle, la première entrée n'a pas de précédente
    -- vérifiable : on accepte son hash_precedent tel quel, puis on enchaîne.
    if v_premiere then v_prec := r.hash_precedent; v_premiere := false; end if;
    if r.hash_precedent is distinct from v_prec then
      return query select false, r.id, v_n; return;
    end if;
    v_attendu := encode(extensions.digest(convert_to(
        coalesce(r.hash_precedent, '') || '|' || r.centre_id::text || '|' || r.horodatage_canonique
        || '|' || r.type_evenement || '|' || r.charge_canonique, 'UTF8'), 'sha256'), 'hex');
    if v_attendu <> r.hash then
      return query select false, r.id, v_n; return;
    end if;
    v_prec := r.hash;
  end loop;
  return query select true, null::uuid, v_n;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- PREUVES À JOUER APRÈS APPLICATION
--   update journal_securite set type_evenement = 'x' where true;   → 42501 (tout rôle)
--   delete from evaluations where true;                            → 42501
--   select * from verifier_chaine(<centre>);                       → valide = true
-- La rupture fabriquée ne peut PAS s'obtenir par UPDATE (refusé) : c'est le
-- point. Le test de détection se fait côté TypeScript sur un export altéré
-- (src/lib/journalSecurite.test.ts).
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- APPLIQUÉE LE 06/09/2026 après validation. PREUVES OBTENUES, au rôle
-- postgres — au-dessus de service_role, donc plus fort que ce que P4.3 exige :
--
--   truncate journal_securite;
--   → 42501 Table journal_securite : aucune modification ni suppression n'est
--            possible, par personne. Une correction est une NOUVELLE entrée.
--   truncate levees;
--   → 42501 (même trigger)
--   truncate evaluations;
--   → 0A000 refusé AVANT le trigger, par la clé étrangère de levees — et
--            « truncate … cascade » retomberait sur le trigger de levees.
--
--   Verrous en place (mesurés) sur les trois tables :
--     3 triggers d'inaltérabilité chacune (update, delete, truncate)
--     has_table_privilege(authenticated, UPDATE) = false
--     has_table_privilege(service_role, UPDATE)  = false
--     has_table_privilege(service_role, DELETE)  = false
--     RLS active
--
-- CE QUI N'EST PAS ENCORE PROUVÉ, et pourquoi : l'UPDATE et le DELETE par
-- ligne. Les trois tables sont VIDES — un trigger de ligne ne se déclenche
-- pas sur zéro ligne, et la preuve TRUNCATE (niveau instruction) est la seule
-- possible sans écrire. Le premier événement réel (un changement de régime,
-- une règle basculée depuis l'écran Référentiel) créera la première entrée ;
-- l'UPDATE refusé sera montré à ce moment-là. verifier_chaine() exige une
-- session admin du centre : elle se prouvera depuis l'application.
-- ════════════════════════════════════════════════════════════════════════════
