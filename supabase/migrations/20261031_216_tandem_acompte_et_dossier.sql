-- 1. L'acompte s'arrondit à l'euro, comme l'affiche la page de réservation
--    (119 € et non 119,40 €) : le passager lit le même chiffre partout.
-- 2. Le dossier passager connaît la plage du créneau (« Matin · 9 h – 13 h »)
--    au lieu d'annoncer « à 09:00 » une heure que la DZ n'a pas promise.
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
  v_acompte := round(v_total * coalesce(v_cfg.pct_acompte, 0) / 100.0);
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

create or replace function public.tandem_dossier_get(p_token text)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'booking', (select to_jsonb(x) from (
      select b.id, b.slot_id, b.offreur_nom, b.offreur_email, b.passager_nom, b.passager_email,
             b.avec_video, b.avec_photos, b.prix_total, b.montant_solde, b.statut, b.dossier_complete,
             (select jsonb_build_object('nom', c.nom, 'ville', c.ville) from centres c where c.id = b.centre_id) as centre,
             (select jsonb_build_object('date', s.date, 'heure', s.heure, 'plage', s.plage) from tandem_slots s where s.id = b.slot_id) as slot
      from tandem_bookings b where b.dossier_token = p_token) x),
    'passenger', (select to_jsonb(pp) from tandem_passengers pp
      where pp.booking_id = (select id from tandem_bookings where dossier_token = p_token) limit 1),
    'config', (select jsonb_build_object('poids_min', tc.poids_min, 'poids_max', tc.poids_max, 'plages', tc.plages)
      from tandem_config tc where tc.centre_id = (select centre_id from tandem_bookings where dossier_token = p_token))
  ) into v;
  if v->'booking' is null or v->'booking' = 'null'::jsonb then return null; end if;
  return v;
end $$;
