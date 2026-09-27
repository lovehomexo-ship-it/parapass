-- Appliquée en base : aeronefs_places_sens_explicite
--
-- Devant « 9/10 », impossible de savoir si le pilote était dans le 10 — et
-- selon la réponse on embarque un sauteur de trop, ou on laisse un siège vide.
comment on column aeronefs.places is
  'Sieges occupables par des parachutistes (largueur et passager tandem compris). EQUIPAGE EXCLU : le pilote ne s''inscrit pas sur une planche.';
comment on column aeronefs.altitude_max_m is
  'Plafond de largage de cet aeronef, en metres. Plafonne l''altitude demandee sur une planche.';
comment on column aeronefs.masse_max_kg is
  'Masse embarquee maximale, en kg, telle que la fiche de pesee de l''avion la donne. Non renseignee = ParaPass n''affiche aucun maximum plutot que d''en inventer un.';

-- Une capacité nulle rendrait toute planche « complète » dès la 1re inscription.
alter table aeronefs drop constraint if exists aeronefs_places_positif;
alter table aeronefs add constraint aeronefs_places_positif
  check (places between 1 and 40) not valid;
alter table aeronefs validate constraint aeronefs_places_positif;
