-- Remet BigAir dans un état NEUTRE : supprime l'activité de démo du jour
-- créée par scripts/seed_demo_bigair.sql. Ne touche à rien d'autre.
do $$
declare
  dz constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
begin
  delete from dz_briefings where dz_id = dz and date_briefing = current_date;
  delete from dz_presences where dz_id = dz and date_presence = current_date;
  delete from seances_jour where dz_id = dz and date_seance = current_date;
  delete from sauts where lieu = 'BigAir Rochefort' and observations = 'Saut démo';
  delete from quiz_attempts where session_id::text like 'de111111-%';
  delete from quiz_xp where raison = 'seed-demo';
  delete from moniteurs_qualifications where centre_id = dz and numero = 'DEMO-BEES1-NG';
  raise notice 'BigAir remis à neutre (les licences/certificats des comptes fictifs sont conservés).';
end $$;
