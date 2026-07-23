-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO — Modules Tandem & Pliage de BigAir Rochefort
-- ═══════════════════════════════════════════════════════════════════════════
-- Peuple les modules Tandem (réservations, créneaux) et Pliage (sacs, pliages)
-- pour une démo vivante. IDEMPOTENT (marqueurs 'DEMO' / 'DEMO-SAC-').
-- Cantonné à BigAir, données fictives, aucun compte réel touché.
--   psql "$SUPABASE_DB_URL" -f scripts/seed_modules_bigair.sql   (ou SQL Editor)

do $$
declare
  dz constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  julien constant uuid := 'de111111-0000-0000-0000-000000000102';   -- moniteur tandem (démo)
  paul constant uuid := 'de111111-0000-0000-0000-000000000106';     -- plieur
  lea constant uuid := 'de111111-0000-0000-0000-000000000107';      -- plieur
  kevin constant uuid := 'a73d3889-18b4-441e-bda5-20ca0cd9942e';    -- plieur
  eleves constant uuid[] := array[
    'd0d00001-0000-0000-0000-000000000003','d0d00001-0000-0000-0000-000000000004',
    'd0d00001-0000-0000-0000-000000000006','d0d00001-0000-0000-0000-000000000009',
    'f0822f3b-54a1-45d8-a273-9b6cdd5e1e39']::uuid[];
  s_today uuid; s_j1 uuid; s_j2 uuid; sac uuid; i int;
begin
  -- Qualif TANDEM au moniteur Julien (cohérence séance tandem + moniteur des réservations)
  if not exists (select 1 from moniteurs_qualifications where user_id=julien and centre_id=dz and qualification_code='TANDEM') then
    insert into moniteurs_qualifications (user_id, centre_id, qualification_code, numero, date_obtention, date_expiration, actif)
    values (julien, dz, 'TANDEM', 'TANDEM-11002', current_date-600, current_date+400, true);
  end if;

  -- ── TANDEM : créneaux (aujourd'hui + J+2) ──
  delete from tandem_bookings where centre_id=dz and notes='DEMO';
  delete from tandem_slots where centre_id=dz and date >= current_date and statut in ('ouvert','complet')
    and not exists (select 1 from tandem_bookings b where b.slot_id=tandem_slots.id);
  insert into tandem_slots (centre_id, date, heure, capacite, statut) values (dz, current_date, time '10:00', 4, 'ouvert') returning id into s_today;
  insert into tandem_slots (centre_id, date, heure, capacite, statut) values (dz, current_date, time '14:00', 4, 'complet') returning id into s_j1;
  insert into tandem_slots (centre_id, date, heure, capacite, statut) values (dz, current_date+2, time '10:00', 4, 'ouvert') returning id into s_j2;

  -- Réservations (états variés : effectué / confirmé / en attente, vidéo/photos, un cadeau)
  insert into tandem_bookings (slot_id, centre_id, offreur_nom, offreur_email, offreur_tel, passager_nom, passager_email, passager_tel, pour_autrui, avec_video, avec_photos, prix_total, montant_acompte, montant_solde, statut, statut_paiement_acompte, statut_paiement_solde, dossier_token, dossier_complete, arrive, moniteur_id, notes) values
    (s_today, dz, 'Julie Moreau','julie.moreau@example.com','0612345678','Julie Moreau','julie.moreau@example.com','0612345678', false, true, false, 280, 84, 196, 'effectue', 'paye', 'paye_comptoir', encode(gen_random_bytes(12),'hex'), true, true, julien, 'DEMO'),
    (s_today, dz, 'Thomas Petit','thomas.petit@example.com','0623456789','Thomas Petit','thomas.petit@example.com','0623456789', false, false, false, 220, 66, 154, 'confirme', 'paye', 'non_paye', encode(gen_random_bytes(12),'hex'), true, false, julien, 'DEMO'),
    (s_j1, dz, 'Paul Girard','paul.girard@example.com','0634567890','Emma Girard','emma.girard@example.com','0634567899', true, true, true, 310, 93, 217, 'confirme', 'paye', 'non_paye', encode(gen_random_bytes(12),'hex'), true, false, julien, 'DEMO'),
    (s_j1, dz, 'Lucas Bernard','lucas.bernard@example.com','0645678901','Lucas Bernard','lucas.bernard@example.com','0645678901', false, false, false, 220, 66, 154, 'confirme', 'paye', 'non_paye', encode(gen_random_bytes(12),'hex'), false, false, julien, 'DEMO'),
    (s_j2, dz, 'Chloé Robert','chloe.robert@example.com','0656789012','Chloé Robert','chloe.robert@example.com','0656789012', false, true, false, 280, 84, 196, 'en_attente', 'non_paye', 'non_paye', encode(gen_random_bytes(12),'hex'), false, false, null, 'DEMO'),
    (s_j2, dz, 'Hugo Lefevre','hugo.lefevre@example.com','0667890123','Hugo Lefevre','hugo.lefevre@example.com','0667890123', false, false, false, 220, 66, 154, 'en_attente', 'paye', 'non_paye', encode(gen_random_bytes(12),'hex'), true, false, julien, 'DEMO');

  -- ── PLIAGE : sacs + pliages (par les plieurs habilités, statuts de paiement variés) ──
  delete from pliages where centre_id=dz and note='DEMO';
  delete from sacs_parachute where centre_id=dz and numero_serie like 'DEMO-SAC-%';
  for i in 1..array_length(eleves,1) loop
    insert into sacs_parachute (user_id, centre_id, qr_code_token, marque, modele, numero_serie, nom_court, statut, actif)
    values (eleves[i], dz, encode(gen_random_bytes(10),'hex'), (array['Vector','Javelin','Mirage','Wings','Icon'])[i], 'Student', 'DEMO-SAC-'||i, (array['Vector 1','Javelin 2','Mirage 3','Wings 4','Icon 5'])[i], 'en_service', true)
    returning id into sac;
    insert into pliages (sac_id, plieur_id, centre_id, parachutiste_id, statut_paiement, montant, type_pliage, date_pliage, note) values
      (sac, (array[paul,lea,kevin])[1+(i%3)], dz, eleves[i], (array['paye_app','a_regler','paye_comptoir'])[1+(i%3)], 15, 'habilite', now() - (i||' hours')::interval, 'DEMO'),
      (sac, (array[lea,kevin,paul])[1+(i%3)], dz, eleves[i], 'paye_app', 15, 'habilite', now() - ((i+3)||' days')::interval, 'DEMO');
  end loop;

  raise notice 'Seed modules Tandem & Pliage BigAir terminé.';
end $$;
