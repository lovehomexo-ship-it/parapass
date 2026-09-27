-- Appliquée en base : verification_materiel_et_referentiel_qualifs,
--   brv001_et_mat003_reellement_evaluees, demo_dossiers_a_jour,
--   demo_avionnage_met_les_dossiers_a_jour,
--   demo_dossiers_poids_nu_et_qualifications
--
-- TROIS RÈGLES NE POUVAIENT JAMAIS PASSER AU VERT.
--
-- MAT-003 (DT 54, vérification du matériel) renvoyait 'indisponible' EN DUR :
-- aucune saisie ne pouvait la satisfaire, faute d'une table où l'écrire. D'où
-- la nouvelle table `verifications_materiel`.
--
-- QUA-001 et QUA-002 cherchaient les codes WINGSUIT et VIDEO. Ils n'existaient
-- ni au référentiel, ni dans la contrainte de `qualifications.type` : on ne
-- pouvait même pas enregistrer la qualification que la règle réclame.
--
-- BRV-001 disait elle-même où lire ses seuils — « seuils météo par public
-- paramétrés par le DT » — et ces seuils existent (meteo_seuils_public). Le
-- tableau de bord les lisait déjà pour annoncer « 2/5 publics praticables ».
-- La règle individuelle ignorait ce que l'écran d'à côté savait. Elle compare
-- désormais le vent SIGNÉ AU BRIEFING (l'observation du DT, pas une prévision)
-- au seuil du public concerné — le saut prime sur le brevet, un tandem se juge
-- comme un tandem.
--
-- Corps complets des fonctions en base : `faits_conformite_base`,
-- `demo_dossiers_a_jour`, `demo_briefing_du_jour`, `generer_demo_avionnage`.

create table if not exists verifications_materiel (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references centres(id) on delete cascade,
  parachutiste_id uuid not null references profiles(id) on delete cascade,
  materiel_id uuid references materiels(id) on delete set null,
  date_verification date not null default current_date,
  verifie_par uuid references profiles(id) on delete set null,
  verifie_par_nom text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table verifications_materiel is
  'Trace de la verification du parachute principal avant embarquement (DT 54). Une ligne par personne et par jour suffit : MAT-003 la cherche a la date du saut.';

create unique index if not exists verifications_materiel_unique_jour
  on verifications_materiel (centre_id, parachutiste_id, date_verification);

alter table verifications_materiel enable row level security;

drop policy if exists verif_materiel_lecture on verifications_materiel;
create policy verif_materiel_lecture on verifications_materiel for select
  using (parachutiste_id = auth.uid()
         or exists (select 1 from admin_centres a
                    where a.profile_id = auth.uid() and a.centre_id = verifications_materiel.centre_id));

drop policy if exists verif_materiel_ecriture on verifications_materiel;
create policy verif_materiel_ecriture on verifications_materiel for insert
  with check (parachutiste_id = auth.uid()
              or exists (select 1 from admin_centres a
                         where a.profile_id = auth.uid() and a.centre_id = verifications_materiel.centre_id));

alter table qualifications drop constraint if exists qualifications_type_check;
alter table qualifications add constraint qualifications_type_check
  check (type = any (array['moniteur_tandem','directeur_technique','initiateur_VR',
                           'initiateur_freestyle','formateur_PAC','largueur',
                           'pilote_planeur','WINGSUIT','VIDEO']));

insert into qualifications_ref (code, libelle, categorie, actif)
select v.code, v.libelle, v.categorie, true from (values
  ('WINGSUIT', 'Qualification wingsuit (DT 59)',             'qualif_federale'),
  ('VIDEO',    'Emport d''appareil de prise de vue (DT 52)', 'qualif_federale')
) as v(code, libelle, categorie)
where not exists (select 1 from qualifications_ref q where q.code = v.code);
