-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE AVIONNAGE — option payante, hors pack Studio.
--
-- Deux questions DISTINCTES, deux réglages :
--   • centre_modules('avionnage')  → le centre a-t-il souscrit ? (droit d'usage)
--   • centres.avionnage_actif      → la file est-elle ouverte AUJOURD'HUI ?
-- Un seul drapeau pour les deux nous a déjà coûté un bouton qui refusait de
-- disparaître. On ne recommence pas.
--
-- Cacher un onglet ne ferme pas une porte : l'URL reste tapable et l'API
-- reste appelable. Les garanties sont donc ICI, pas dans l'écran.
--
-- P1 (fail-safe) : PAS DE LIGNE = PAS SOUSCRIT. Un module ne s'ouvre jamais
-- par défaut, ni par une lecture en échec.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

-- ── 1 · La question, posée à un seul endroit ───────────────────────────────
create or replace function centre_module_actif(p_centre_id uuid, p_module text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select cm.active from centre_modules cm
      where cm.centre_id = p_centre_id and cm.module_id = p_module),
    false);
$$;

comment on function centre_module_actif(uuid, text) is
  'Modules — le centre a-t-il souscrit ce module ? Absence de ligne = NON (P1).';

-- ── 2 · La file ne s'ouvre pas sans le module ──────────────────────────────
create or replace function centres_avionnage_exige_module()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.avionnage_actif and not centre_module_actif(new.id, 'avionnage') then
    raise exception 'Le module Avionnage n''est pas souscrit pour ce centre.'
      using errcode = '42501',
            hint = 'Menu « Modules » : ParaPass Avionnage, 49,97 €/mois. Non inclus dans le pack Studio.';
  end if;
  return new;
end $$;

drop trigger if exists trg_centres_avionnage_exige_module on centres;
create trigger trg_centres_avionnage_exige_module
  before insert or update of avionnage_actif on centres
  for each row when (new.avionnage_actif) execute function centres_avionnage_exige_module();

-- ── 3 · Une planche ne se crée pas sans le module ──────────────────────────
create or replace function rotations_exige_module()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not centre_module_actif(new.centre_id, 'avionnage') then
    raise exception 'Le module Avionnage n''est pas souscrit pour ce centre.'
      using errcode = '42501', hint = 'Menu « Modules » : ParaPass Avionnage.';
  end if;
  return new;
end $$;

drop trigger if exists trg_rotations_exige_module on rotations;
create trigger trg_rotations_exige_module
  before insert on rotations
  for each row execute function rotations_exige_module();
-- INSERT seulement : une planche déjà créée reste modifiable et clôturable.
-- Couper un module ne doit pas emprisonner une journée en cours.

-- ── 4 · Le parachutiste non plus ───────────────────────────────────────────
create or replace function rejoindre_file_avionnage(
  p_centre_id uuid, p_type_saut text default 'solo', p_commentaire text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_position int;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour rejoindre la file.' using errcode = '42501';
  end if;
  -- Le droit d'usage AVANT l'ouverture du jour : sans module, la file n'existe
  -- pas, même si un drapeau était resté levé.
  if not centre_module_actif(p_centre_id, 'avionnage') then
    raise exception 'L''avionnage n''est pas proposé par ce centre.' using errcode = '42501';
  end if;
  if not exists (select 1 from centres c where c.id = p_centre_id and c.avionnage_actif) then
    raise exception 'L''avionnage n''est pas ouvert sur ce centre aujourd''hui.'
      using errcode = '42501', hint = 'Le centre ouvre la file depuis l''onglet Rotations.';
  end if;
  if not exists (select 1 from licencies_centres lc
                 where lc.parachutiste_id = v_uid and lc.centre_id = p_centre_id
                   and lc.statut = 'actif') then
    raise exception 'Vous n''etes pas licencie actif de ce centre.' using errcode = '42501';
  end if;

  select id into v_id from file_avionnage
  where centre_id = p_centre_id and date_jour = current_date
    and parachutiste_id = v_uid and statut = 'attente';

  if v_id is null then
    insert into file_avionnage (centre_id, parachutiste_id, type_saut, commentaire)
    values (p_centre_id, v_uid, coalesce(p_type_saut, 'solo'), nullif(trim(p_commentaire), ''))
    returning id into v_id;
  end if;

  select count(*) into v_position
  from file_avionnage f
  where f.centre_id = p_centre_id and f.date_jour = current_date and f.statut = 'attente'
    and f.demande_le <= (select demande_le from file_avionnage where id = v_id);

  return jsonb_build_object('id', v_id, 'position', v_position);
end $$;

-- ── 5 · Résilier ferme la file, sans supprimer la journée ──────────────────
-- Sinon un centre qui se désabonne laisse une file ouverte que plus personne
-- ne relève : les sauteurs continueraient de s'y inscrire dans le vide.
create or replace function centre_modules_ferme_avionnage()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.module_id = 'avionnage' and not new.active then
    update centres set avionnage_actif = false
      where id = new.centre_id and avionnage_actif;
  end if;
  return new;
end $$;

drop trigger if exists trg_centre_modules_ferme_avionnage on centre_modules;
create trigger trg_centre_modules_ferme_avionnage
  after insert or update of active on centre_modules
  for each row execute function centre_modules_ferme_avionnage();

-- ── 6 · Les centres qui s'en servent DÉJÀ ──────────────────────────────────
-- Mesuré avant d'écrire : un seul centre a des planches (BigAir Rochefort, 6).
-- Sans cette ligne, la migration lui coupe l'avionnage du jour au déploiement.
-- C'est une décision COMMERCIALE : je l'écris pour les usages constatés, pas
-- pour tout le monde.
insert into centre_modules (centre_id, module_id, active)
select distinct r.centre_id, 'avionnage', true from rotations r
on conflict (centre_id, module_id) do update set active = true;

commit;
