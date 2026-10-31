-- LE PLIAGE, CÔTÉ SERVEUR — simple pour la DZ, irréprochable pour la trace.
--
-- Retour du DT de Rochefort : il fait tout (avionnage, gestion, admin) ;
-- chaque clic de trop est un clic qu'il ne fait pas. L'effort passe donc au
-- sauteur (il prend son sac, le dépose au tapis) et au plieur (il scanne, il
-- touche « plié ») ; la DZ ne fait plus que régler les plieurs.
--
-- Chaque geste devient UNE fonction serveur, qui vérifie, écrit tout d'un
-- bloc, et laisse une trace datée. Avant, l'écran enchaînait plusieurs
-- écritures directes ; certaines étaient refusées en silence par les droits :
--   • « Rendre » fermait l'attribution PUIS tentait de libérer le sac — la
--     seconde écriture n'avait plus le droit, le sac restait dans la file ;
--   • le plieur ne pouvait pas attribuer son pliage (aucun droit de mise à
--     jour) : le pliage restait « non attribué », impossible à facturer ;
--   • un auto-pliage s'enregistrait comme pliage « habilité » ;
--   • tout licencié pouvait écrire un pliage à son nom, sans contrôle.

-- Qui a déposé le sac au tapis, et quand : le maillon qui manquait.
alter table public.sacs_parachute
  add column if not exists a_plier_depuis timestamptz,
  add column if not exists a_plier_par uuid references public.profiles(id);

-- ── Prendre un sac de la DZ ────────────────────────────────────────────────
create or replace function public.sac_prendre(p_sac_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_sac sacs_parachute%rowtype; v_porteur text; v_autre uuid;
begin
  select * into v_sac from sacs_parachute where id = p_sac_id for update;
  if v_sac.id is null or not v_sac.actif then raise exception 'Sac introuvable.'; end if;
  if not exists (select 1 from licencies_centres where centre_id = v_sac.centre_id and parachutiste_id = auth.uid() and statut = 'actif')
     and not is_dz_admin(v_sac.centre_id) then
    raise exception 'Réservé aux licenciés de ce centre.' using errcode = '42501';
  end if;
  if v_sac.statut <> 'en_service' then raise exception 'Ce sac n''est pas en service.'; end if;
  select coalesce(p.prenom || ' ', '') || p.nom into v_porteur
    from sac_assignments a join profiles p on p.id = a.licencie_id
   where a.sac_id = p_sac_id and a.end_at is null and a.licencie_id <> auth.uid();
  if v_porteur is not null then raise exception 'Ce sac est déjà pris par %.', v_porteur; end if;
  if v_sac.etat_journee = 'a_plier' then raise exception 'Ce sac attend d''être plié.'; end if;
  select sac_id into v_autre from sac_assignments where licencie_id = auth.uid() and end_at is null and sac_id <> p_sac_id;
  if v_autre is not null then
    raise exception 'Vous avez déjà le sac « % ». Rendez-le ou déposez-le au tapis d''abord.',
      (select coalesce(nom_court, marque || ' ' || modele, 'sac') from sacs_parachute where id = v_autre);
  end if;
  if not exists (select 1 from sac_assignments where sac_id = p_sac_id and licencie_id = auth.uid() and end_at is null) then
    insert into sac_assignments (sac_id, licencie_id, centre_id) values (p_sac_id, auth.uid(), v_sac.centre_id);
  end if;
  update sacs_parachute set etat_journee = 'pris', updated_at = now() where id = p_sac_id;
  -- La présence du jour connaît son sac : la DT 48 et l'avionnage le lisent.
  update dz_presences set sac_ref = p_sac_id, materiel_type = 'location', updated_at = now()
   where user_id = auth.uid() and dz_id = v_sac.centre_id and date_presence = current_date;
  return jsonb_build_object('sac_id', p_sac_id, 'etat', 'pris');
end $$;

-- ── Déposer son sac au tapis (à plier) ─────────────────────────────────────
create or replace function public.sac_deposer(p_sac_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_sac sacs_parachute%rowtype;
begin
  select * into v_sac from sacs_parachute where id = p_sac_id for update;
  if v_sac.id is null then raise exception 'Sac introuvable.'; end if;
  if not exists (select 1 from sac_assignments where sac_id = p_sac_id and licencie_id = auth.uid() and end_at is null)
     and not is_dz_admin(v_sac.centre_id) then
    raise exception 'Seul le porteur du sac peut le déposer au tapis.' using errcode = '42501';
  end if;
  update sacs_parachute set etat_journee = 'a_plier', a_plier_depuis = now(), a_plier_par = auth.uid(), updated_at = now()
   where id = p_sac_id;
  return jsonb_build_object('sac_id', p_sac_id, 'etat', 'a_plier');
end $$;

-- ── Reprendre un sac déposé par erreur ─────────────────────────────────────
create or replace function public.sac_annuler_depot(p_sac_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_sac sacs_parachute%rowtype;
begin
  select * into v_sac from sacs_parachute where id = p_sac_id for update;
  if v_sac.id is null then raise exception 'Sac introuvable.'; end if;
  if v_sac.etat_journee <> 'a_plier' then raise exception 'Ce sac n''est pas au tapis.'; end if;
  if not exists (select 1 from sac_assignments where sac_id = p_sac_id and licencie_id = auth.uid() and end_at is null)
     and not is_dz_admin(v_sac.centre_id) then
    raise exception 'Seul le porteur du sac peut le reprendre.' using errcode = '42501';
  end if;
  update sacs_parachute set etat_journee = 'pris', a_plier_depuis = null, a_plier_par = null, updated_at = now() where id = p_sac_id;
  return jsonb_build_object('sac_id', p_sac_id, 'etat', 'pris');
end $$;

-- ── Rendre un sac (plié ou à plier) ────────────────────────────────────────
create or replace function public.sac_rendre(p_sac_id uuid, p_a_plier boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_sac sacs_parachute%rowtype; v_admin boolean; v_porteur uuid;
begin
  select * into v_sac from sacs_parachute where id = p_sac_id for update;
  if v_sac.id is null then raise exception 'Sac introuvable.'; end if;
  v_admin := is_dz_admin(v_sac.centre_id);
  select licencie_id into v_porteur from sac_assignments where sac_id = p_sac_id and end_at is null;
  if not v_admin and v_porteur is distinct from auth.uid() then
    raise exception 'Seul le porteur du sac, ou la DZ, peut le rendre.' using errcode = '42501';
  end if;
  update sac_assignments set end_at = now(), ended_by = case when v_porteur = auth.uid() then 'user' else 'staff' end
   where sac_id = p_sac_id and end_at is null;
  update sacs_parachute set
    etat_journee = case when p_a_plier then 'a_plier' else 'libre' end,
    a_plier_depuis = case when p_a_plier then now() else null end,
    a_plier_par = case when p_a_plier then coalesce(v_porteur, auth.uid()) else null end,
    updated_at = now()
   where id = p_sac_id;
  return jsonb_build_object('sac_id', p_sac_id, 'etat', case when p_a_plier then 'a_plier' else 'libre' end);
end $$;

-- ── Enregistrer un pliage ──────────────────────────────────────────────────
-- Le plieur scanne, touche « plié ». Le serveur décide de tout le reste :
-- habilitation (registre de la DZ, échéance comprise), carence, destinataire
-- (le porteur du sac, sinon celui qui l'a déposé), montant, état du sac.
create or replace function public.pliage_enregistrer(p_sac_id uuid, p_auto boolean default false, p_hors_file boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_sac sacs_parachute%rowtype; v_porteur uuid; v_dest uuid; v_habilite boolean; v_dernier timestamptz;
  v_id uuid; v_statut text; v_note text; v_nom text;
begin
  select * into v_sac from sacs_parachute where id = p_sac_id for update;
  if v_sac.id is null or not v_sac.actif then raise exception 'Sac introuvable.'; end if;
  if not exists (select 1 from licencies_centres where centre_id = v_sac.centre_id and parachutiste_id = auth.uid() and statut = 'actif')
     and not is_dz_admin(v_sac.centre_id) then
    raise exception 'Réservé aux licenciés de ce centre.' using errcode = '42501';
  end if;
  select max(date_pliage) into v_dernier from pliages where sac_id = p_sac_id;
  if v_dernier is not null and v_dernier > now() - interval '30 minutes' then
    raise exception 'Ce sac a été plié il y a % min : un pliage tous les 30 min au plus.',
      greatest(1, round(extract(epoch from now() - v_dernier) / 60));
  end if;
  select licencie_id into v_porteur from sac_assignments where sac_id = p_sac_id and end_at is null;
  v_dest := coalesce(v_porteur, v_sac.a_plier_par);

  if p_auto then
    if v_porteur is distinct from auth.uid() then raise exception 'Un auto-pliage se fait sur le sac qu''on porte.'; end if;
    insert into pliages (sac_id, plieur_id, centre_id, parachutiste_id, type_pliage, statut_paiement, montant, flag_qualif, note, date_pliage)
    values (p_sac_id, auth.uid(), v_sac.centre_id, auth.uid(), 'auto', 'auto_plie', 0, false, null, now())
    returning id into v_id;
  else
    v_habilite := exists (select 1 from plieurs_valides where centre_id = v_sac.centre_id and plieur_id = auth.uid()
                           and actif and (date_expiration is null or date_expiration >= current_date));
    v_statut := case when v_dest is not null and v_habilite then 'a_regler' else 'non_attribue' end;
    v_note := concat_ws(' · ', case when not v_habilite then 'Plieur non habilité par la DZ' end,
                               case when p_hors_file then 'Plié hors file (« plier quand même »)' end);
    insert into pliages (sac_id, plieur_id, centre_id, parachutiste_id, type_pliage, statut_paiement, montant, flag_qualif, note, date_pliage)
    values (p_sac_id, auth.uid(), v_sac.centre_id, v_dest, 'habilite', v_statut,
            coalesce((select tarif_pliage from centres where id = v_sac.centre_id), 7),
            (not v_habilite) or p_hors_file, nullif(v_note, ''), now())
    returning id into v_id;
  end if;

  update sacs_parachute set etat_journee = case when v_porteur is not null then 'pris' else 'libre' end,
         a_plier_depuis = null, a_plier_par = null, updated_at = now()
   where id = p_sac_id;
  select coalesce(prenom || ' ', '') || nom into v_nom from profiles where id = v_dest;
  return jsonb_build_object('pliage_id', v_id, 'destinataire_id', v_dest, 'destinataire', v_nom,
                            'habilite', coalesce(v_habilite, true), 'auto', p_auto);
end $$;

-- ── Attribuer un pliage (le plieur, le jour même ; ou la DZ) ───────────────
create or replace function public.pliage_attribuer(p_pliage_id uuid, p_parachutiste_id uuid)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_p pliages%rowtype; v_habilite boolean;
begin
  select * into v_p from pliages where id = p_pliage_id for update;
  if v_p.id is null then raise exception 'Pliage introuvable.'; end if;
  if not is_dz_admin(v_p.centre_id)
     and not (v_p.plieur_id = auth.uid() and v_p.date_pliage::date = current_date) then
    raise exception 'Seul le plieur (le jour même) ou la DZ peut attribuer ce pliage.' using errcode = '42501';
  end if;
  if v_p.statut_paiement in ('paye_app', 'paye_comptoir') then raise exception 'Ce pliage est déjà réglé.'; end if;
  v_habilite := not coalesce(v_p.flag_qualif, false);
  update pliages set parachutiste_id = p_parachutiste_id,
    statut_paiement = case when v_p.type_pliage = 'auto' then 'auto_plie'
                           when p_parachutiste_id is null then 'non_attribue'
                           when v_habilite then 'a_regler' else 'non_attribue' end
   where id = p_pliage_id;
end $$;

-- ── Régler les plieurs en une fois ─────────────────────────────────────────
create or replace function public.pliages_regler(p_centre_id uuid, p_ids uuid[])
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_n int;
begin
  if not is_dz_admin(p_centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  update pliages set statut_paiement = 'paye_comptoir'
   where centre_id = p_centre_id and id = any (p_ids) and statut_paiement = 'a_regler';
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform journal_ecrire(p_centre_id, 'autre', format('%s pliage%s réglé%s aux plieurs', v_n,
      case when v_n > 1 then 's' else '' end, case when v_n > 1 then 's' else '' end),
      jsonb_build_object('categorie', 'pliage', 'pliages', p_ids));
  end if;
  return v_n;
end $$;

-- ── Habiliter / retirer un plieur, avec trace au journal ───────────────────
create or replace function public.plieur_habiliter(p_centre_id uuid, p_plieur_id uuid,
  p_date_expiration date default null, p_numero text default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id uuid; v_nom text;
begin
  if not is_dz_admin(p_centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  select id into v_id from plieurs_valides where centre_id = p_centre_id and plieur_id = p_plieur_id and actif for update;
  if v_id is null then
    insert into plieurs_valides (centre_id, plieur_id, validateur_id, actif, date_habilitation, date_expiration, numero_qualif, note)
    values (p_centre_id, p_plieur_id, auth.uid(), true, current_date, p_date_expiration, nullif(p_numero, ''), nullif(p_note, ''))
    returning id into v_id;
  else
    update plieurs_valides set validateur_id = auth.uid(), date_expiration = p_date_expiration,
      numero_qualif = nullif(p_numero, ''), note = nullif(p_note, '') where id = v_id;
  end if;
  select coalesce(prenom || ' ', '') || nom into v_nom from profiles where id = p_plieur_id;
  perform journal_ecrire(p_centre_id, 'autre', format('Habilitation au pliage : %s%s', v_nom,
    case when p_date_expiration is not null then format(' (jusqu''au %s)', to_char(p_date_expiration, 'DD/MM/YYYY')) else '' end),
    jsonb_build_object('categorie', 'pliage', 'plieur_id', p_plieur_id, 'habilitation', v_id));
  return v_id;
end $$;

create or replace function public.plieur_retirer(p_centre_id uuid, p_plieur_id uuid, p_motif text default null)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_nom text;
begin
  if not is_dz_admin(p_centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  update plieurs_valides set actif = false,
    note = concat_ws(' · ', note, 'Retirée le ' || to_char(current_date, 'DD/MM/YYYY') || coalesce(' : ' || nullif(p_motif, ''), ''))
   where centre_id = p_centre_id and plieur_id = p_plieur_id and actif;
  select coalesce(prenom || ' ', '') || nom into v_nom from profiles where id = p_plieur_id;
  perform journal_ecrire(p_centre_id, 'autre', format('Habilitation au pliage retirée : %s%s', v_nom, coalesce(' — ' || nullif(p_motif, ''), '')),
    jsonb_build_object('categorie', 'pliage', 'plieur_id', p_plieur_id));
end $$;

-- ── Fin de journée, automatique ────────────────────────────────────────────
-- À 23 h 30 (Paris), les sacs encore sortis sont rendus d'office. On ne sait
-- pas s'ils ont sauté depuis leur dernier pliage : ils passent « à plier »,
-- jamais « libres » — un sac douteux se vérifie, il ne repart pas.
create or replace function public.pliage_fin_de_journee()
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_n int;
begin
  with fermees as (
    update sac_assignments set end_at = now(), ended_by = 'auto' where end_at is null returning sac_id, licencie_id
  )
  update sacs_parachute s set etat_journee = 'a_plier', a_plier_depuis = now(), a_plier_par = f.licencie_id, updated_at = now()
    from fermees f where s.id = f.sac_id and s.etat_journee = 'pris';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.pliage_fin_de_journee() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'pliage-fin-de-journee';
select cron.schedule('pliage-fin-de-journee', '30 22 * * *', 'select public.pliage_fin_de_journee()');

do $$
declare f text;
begin
  foreach f in array array['sac_prendre(uuid)', 'sac_deposer(uuid)', 'sac_annuler_depot(uuid)', 'sac_rendre(uuid, boolean)',
    'pliage_enregistrer(uuid, boolean, boolean)', 'pliage_attribuer(uuid, uuid)', 'pliages_regler(uuid, uuid[])',
    'plieur_habiliter(uuid, uuid, date, text, text)', 'plieur_retirer(uuid, uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
