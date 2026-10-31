-- TANDEM : créneaux par demi-journée, ouverture en série, réservation sûre,
-- et les tandems du jour dans l'avionnage.
--
-- Retour du DT de Rochefort : « des créneaux matin ou après-midi, et lui
-- s'organise » — il remplit ses avions avec les tandems de la demi-journée,
-- au lieu de promettre une heure exacte qu'il ne tiendra pas.

-- ── 1. Les plages du centre ────────────────────────────────────────────────
-- null = heures précises (le fonctionnement d'avant). Sinon une liste de
-- plages : [{"cle":"matin","libelle":"Matin","debut":"09:00","fin":"13:00"}, …]
alter table public.tandem_config add column if not exists plages jsonb;
-- Le créneau porte la clé de sa plage ; `heure` reste son début, pour l'ordre.
alter table public.tandem_slots add column if not exists plage text;

create or replace view public.tandem_slot_availability as
 select s.id as slot_id, s.centre_id, s.date, s.heure, s.capacite, s.statut,
        count(b.id) as booked, s.plage
   from tandem_slots s
   left join tandem_bookings b on b.slot_id = s.id and b.statut = any (array['en_attente', 'confirme'])
  where s.statut = any (array['ouvert', 'complet'])
  group by s.id;
grant select on public.tandem_slot_availability to anon, authenticated;

-- ── 2. Ouvrir des créneaux en série ────────────────────────────────────────
-- Du … au …, certains jours de la semaine (1 = lundi … 7 = dimanche), pour
-- une liste d'heures « HH:MM » ou de clés de plage. Un créneau qui existe
-- déjà (même jour, même heure) n'est pas doublé.
create or replace function public.tandem_ouvrir_creneaux(
  p_centre_id uuid, p_du date, p_au date, p_jours int[], p_creneaux text[], p_capacite int)
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_plages jsonb; v_jour date; v_c text; v_heure time; v_plage text; v_n int := 0;
begin
  if not is_dz_admin(p_centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  if p_au < p_du or p_au > p_du + 366 then raise exception 'Période invalide (un an au plus).'; end if;
  if p_capacite < 1 or p_capacite > 50 then raise exception 'Capacité entre 1 et 50.'; end if;
  select plages into v_plages from tandem_config where centre_id = p_centre_id;
  for v_jour in select d::date from generate_series(p_du, p_au, interval '1 day') d loop
    if v_jour < current_date or not (extract(isodow from v_jour)::int = any (p_jours)) then continue; end if;
    foreach v_c in array p_creneaux loop
      v_plage := null;
      if v_c ~ '^\d{1,2}:\d{2}$' then v_heure := v_c::time;
      else
        select (e->>'debut')::time, e->>'cle' into v_heure, v_plage
          from jsonb_array_elements(coalesce(v_plages, '[]'::jsonb)) e where e->>'cle' = v_c;
        if v_heure is null then raise exception 'Plage inconnue : %', v_c; end if;
      end if;
      if exists (select 1 from tandem_slots where centre_id = p_centre_id and date = v_jour and heure = v_heure) then continue; end if;
      insert into tandem_slots (centre_id, date, heure, capacite, statut, plage)
      values (p_centre_id, v_jour, v_heure, p_capacite, 'ouvert', v_plage);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
revoke all on function public.tandem_ouvrir_creneaux(uuid, date, date, int[], text[], int) from public, anon;
grant execute on function public.tandem_ouvrir_creneaux(uuid, date, date, int[], text[], int) to authenticated;

-- ── 3. Une réservation sûre ────────────────────────────────────────────────
-- Avant : aucune vérification de capacité (un créneau plein acceptait encore
-- des réservations) et des prix fournis par le navigateur. Désormais le
-- créneau est verrouillé le temps de compter, et les prix sont recalculés
-- depuis la configuration du centre.
create or replace function public.tandem_reserver(p jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_booking_id uuid; v_token text; v_slot tandem_slots%rowtype; v_cfg tandem_config%rowtype;
  v_pris int; v_total numeric; v_acompte numeric;
begin
  select * into v_slot from tandem_slots where id = (p->>'slot_id')::uuid for update;
  if v_slot.id is null or v_slot.centre_id <> (p->>'centre_id')::uuid then raise exception 'Créneau invalide'; end if;
  if v_slot.statut <> 'ouvert' or v_slot.date < current_date then raise exception 'Ce créneau n''est plus ouvert à la réservation.'; end if;
  select count(*) into v_pris from tandem_bookings where slot_id = v_slot.id and statut in ('en_attente', 'confirme');
  if v_pris >= v_slot.capacite then raise exception 'Ce créneau est complet. Choisissez-en un autre.'; end if;
  if coalesce(p->>'offreur_nom','') = '' or position('@' in coalesce(p->>'offreur_email','')) = 0 then
    raise exception 'Nom et email requis';
  end if;
  select * into v_cfg from tandem_config where centre_id = v_slot.centre_id and actif;
  if v_cfg.id is null then raise exception 'Les réservations tandem ne sont pas ouvertes dans ce centre.'; end if;
  v_total := coalesce(v_cfg.prix_base, 0)
           + case when coalesce((p->>'avec_video')::boolean, false) then coalesce(v_cfg.prix_video, 0) else 0 end
           + case when coalesce((p->>'avec_photos')::boolean, false) then coalesce(v_cfg.prix_photos, 0) else 0 end;
  v_acompte := round(v_total * coalesce(v_cfg.pct_acompte, 0) / 100.0, 2);

  insert into tandem_bookings (slot_id, centre_id, offreur_nom, offreur_email, offreur_tel, pour_autrui,
    passager_nom, passager_email, passager_tel, avec_video, avec_photos, prix_total, montant_acompte,
    montant_solde, statut, statut_paiement_acompte)
  values (v_slot.id, v_slot.centre_id, p->>'offreur_nom', p->>'offreur_email',
    nullif(p->>'offreur_tel',''), coalesce((p->>'pour_autrui')::boolean, false),
    p->>'passager_nom', p->>'passager_email', nullif(p->>'passager_tel',''),
    coalesce((p->>'avec_video')::boolean, false), coalesce((p->>'avec_photos')::boolean, false),
    v_total, v_acompte, v_total - v_acompte, 'confirme', 'non_paye')
  returning id, dossier_token into v_booking_id, v_token;
  insert into tandem_passengers (booking_id, nom, prenom)
  values (v_booking_id, coalesce(p->>'passager_nom_famille',''), coalesce(p->>'passager_prenom',''));
  return jsonb_build_object('booking_id', v_booking_id, 'dossier_token', v_token,
                            'prix_total', v_total, 'montant_acompte', v_acompte);
end $$;
grant execute on function public.tandem_reserver(jsonb) to anon, authenticated;

-- ── 4. Une place peut être un passager NOMMÉ ET RÉSERVÉ ─────────────────────
-- La contrainte imposait UN seul de : sauteur licencié, réservation tandem,
-- nom de passager. Un passager venu d'une réservation a les deux derniers :
-- son nom (pour la planche) et sa réservation (pour le suivi).
do $$
declare v_nom text;
begin
  for v_nom in select conname from pg_constraint
                where conrelid = 'public.places_rotation'::regclass and contype = 'c'
                  and pg_get_constraintdef(oid) ilike '%num_nonnulls(parachutiste_id, tandem_booking_id, passager_nom)%' loop
    execute format('alter table public.places_rotation drop constraint %I', v_nom);
  end loop;
end $$;
alter table public.places_rotation add constraint places_rotation_qui
  check ((parachutiste_id is not null) <> (passager_nom is not null or tandem_booking_id is not null));

-- ── 5. Les tandems du jour, pour l'avionnage ───────────────────────────────
create or replace function public.tandems_du_jour(p_centre_id uuid, p_date date default current_date)
returns table (booking_id uuid, heure time, plage text, passager text, poids int, avec_video boolean,
               avec_photos boolean, moniteur_id uuid, moniteur text, arrive boolean, dossier_complete boolean,
               statut text, rotation_numero int)
language plpgsql security definer stable set search_path to 'public', 'pg_temp'
as $$
begin
  if not is_dz_admin(p_centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  return query
  select b.id, s.heure, s.plage,
         coalesce(nullif(trim(coalesce(tp.prenom, '') || ' ' || coalesce(tp.nom, '')), ''),
                  case when b.pour_autrui then b.passager_nom else b.offreur_nom end, 'Passager'),
         tp.poids, b.avec_video, b.avec_photos, b.moniteur_id,
         nullif(trim(coalesce(m.prenom, '') || ' ' || coalesce(m.nom, '')), ''),
         coalesce(b.arrive, false), coalesce(b.dossier_complete, false), b.statut,
         (select r.numero from places_rotation pr join rotations r on r.id = pr.rotation_id
           where pr.tandem_booking_id = b.id order by r.numero desc limit 1)
    from tandem_bookings b
    join tandem_slots s on s.id = b.slot_id
    left join lateral (select * from tandem_passengers x where x.booking_id = b.id limit 1) tp on true
    left join profiles m on m.id = b.moniteur_id
   where b.centre_id = p_centre_id and s.date = p_date and b.statut in ('en_attente', 'confirme', 'effectue')
   order by s.heure, b.created_at;
end $$;
revoke all on function public.tandems_du_jour(uuid, date) from public, anon;
grant execute on function public.tandems_du_jour(uuid, date) to authenticated;

-- ── 6. Placer un tandem réservé sur une planche ────────────────────────────
-- Le passager rejoint la planche avec son nom, son poids et l'option vidéo ;
-- son moniteur, s'il est désigné et pas encore à bord, l'y accompagne. Les
-- deux partagent un groupe : ils sortent attachés.
create or replace function public.tandem_placer(p_booking_id uuid, p_rotation_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_b tandem_bookings%rowtype; v_r rotations%rowtype; v_nom text; v_poids int;
  v_groupe uuid; v_rang int; v_place uuid; v_mon uuid;
begin
  select * into v_b from tandem_bookings where id = p_booking_id;
  select * into v_r from rotations where id = p_rotation_id;
  if v_b.id is null or v_r.id is null or v_b.centre_id <> v_r.centre_id then raise exception 'Réservation ou planche introuvable.'; end if;
  if not is_dz_admin(v_r.centre_id) then raise exception 'Réservé à l''administrateur du centre.' using errcode = '42501'; end if;
  if v_r.embarquement_valide_le is not null or v_r.heure_decollage is not null then
    raise exception 'Cette planche est figée : embarquement validé ou avion parti.';
  end if;
  if exists (select 1 from places_rotation where tandem_booking_id = p_booking_id) then
    raise exception 'Ce tandem est déjà sur une planche.';
  end if;
  select coalesce(nullif(trim(coalesce(prenom,'') || ' ' || coalesce(nom,'')), ''),
                  case when v_b.pour_autrui then v_b.passager_nom else v_b.offreur_nom end, 'Passager'), poids
    into v_nom, v_poids from tandem_passengers where booking_id = v_b.id limit 1;
  v_nom := coalesce(v_nom, case when v_b.pour_autrui then v_b.passager_nom else v_b.offreur_nom end, 'Passager');

  -- Le moniteur : sa place sur la planche si elle existe, sinon on l'ajoute.
  if v_b.moniteur_id is not null then
    select id, groupe_id, rang_sortie into v_mon, v_groupe, v_rang from places_rotation
     where rotation_id = v_r.id and parachutiste_id = v_b.moniteur_id limit 1;
    if v_mon is null then
      select coalesce(max(rang_sortie), 0) + 1 into v_rang from places_rotation where rotation_id = v_r.id and coalesce(rang_sortie, 0) < 99;
      v_groupe := gen_random_uuid();
      insert into places_rotation (rotation_id, parachutiste_id, type_saut, groupe_id, rang_sortie)
      values (v_r.id, v_b.moniteur_id, 'tandem', v_groupe, v_rang);
    elsif v_groupe is null then
      v_groupe := gen_random_uuid();
      update places_rotation set groupe_id = v_groupe where id = v_mon;
    end if;
  else
    select coalesce(max(rang_sortie), 0) + 1 into v_rang from places_rotation where rotation_id = v_r.id and coalesce(rang_sortie, 0) < 99;
    v_groupe := gen_random_uuid();
  end if;

  insert into places_rotation (rotation_id, passager_nom, tandem_booking_id, type_saut, groupe_id, rang_sortie, masse_kg, video_option)
  values (v_r.id, v_nom, v_b.id, 'tandem', v_groupe, v_rang, v_poids, coalesce(v_b.avec_video, false))
  returning id into v_place;
  return v_place;
end $$;
revoke all on function public.tandem_placer(uuid, uuid) from public, anon;
grant execute on function public.tandem_placer(uuid, uuid) to authenticated;
