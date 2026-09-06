-- ════════════════════════════════════════════════════════════════════════════
-- FEU VERT · P3 — Les FAITS en base, le VERDICT dans le moteur.
--           · P5 — Aucune donnée de santé.
--
-- ARCHITECTURE, et pourquoi
--   Le moteur TypeScript (src/lib/feuVert.ts) est pur : il reçoit les règles
--   en vigueur et une liste de faits, il rend un verdict. Il ne connaît AUCUN
--   code de règle — c'est le critère P2.3. Les codes vivent ici, dans
--   faits_conformite(), qui sait lire pour chaque règle LE fait qui la
--   concerne : une date d'expiration, une présence d'acquittement, une date
--   de dernier saut. Trois états seulement : conforme, non_conforme,
--   indisponible.
--
--   INDISPONIBLE est le mot central. Il signifie « je n'ai pas pu lire la
--   donnée » — jamais « c'est bon par défaut ». Le moteur le transforme en
--   GRIS, et le gris est un rouge partout en aval (P1). Une règle en vigueur
--   pour laquelle cette fonction ne rend AUCUNE ligne est traitée de même :
--   ajouter une quinzième règle sans lui donner de fait la rend grise, pas
--   verte. C'est exactement ce qu'on veut.
--
-- CE QUE LE MOTEUR NE LIT PAS (P5)
--   Pour MED-001 : certificats_medicaux.date_expiration, et rien d'autre.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 0 · Seuils de reprise : une DONNÉE, lue par REP-001 ─────────────────────
-- Le seuil n'a pas sa place dans la table des règles (pas de colonne
-- paramètres en P2, et c'est voulu : une règle n'est pas un réglage). Il vit
-- dans compliance_rules, la table de réglages existante. Absent → REP-001 est
-- indisponible, pas conforme.
-- (Première application refusée : compliance_rules.label est NOT NULL. Corrigé.)
insert into compliance_rules (rule_key, value_int, label)
select v.k, v.n, v.l from (values
  ('reprise_conseil_jours',  90,  'Reprise — saut d''accompagnement conseillé à partir de (jours)'),
  ('reprise_moniteur_jours', 180, 'Reprise — saut avec moniteur à partir de (jours)'),
  ('reprise_complete_jours', 365, 'Reprise — reprise complète à partir de (jours)')) v(k, n, l)
where not exists (select 1 from compliance_rules c where c.rule_key = v.k);

-- ── 1 · Les faits ───────────────────────────────────────────────────────────
create or replace function faits_conformite(
  p_parachutiste_id uuid,
  p_centre_id uuid,
  p_date date default current_date,
  p_type_saut text default 'solo'
) returns table (code text, etat text, detail text)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_lic date; v_med date; v_dernier_saut date; v_naissance date;
  v_briefing uuid; v_ack boolean;
  v_secours_ech date; v_a_secours boolean; v_a_principal boolean; v_dernier_pliage date;
  v_brevete boolean;
  v_reprise_conseil int; v_reprise_moniteur int; v_reprise_complete int;
  v_pliage_mois int;
  v_qualif_ws boolean; v_qualif_video boolean; v_ref_ws boolean; v_ref_video boolean;
begin
  -- Un centre ne lit les faits que de ses licenciés ; un parachutiste, les siens.
  if not (
    p_parachutiste_id = auth.uid()
    or exists (select 1 from admin_centres a where a.profile_id = auth.uid() and a.centre_id = p_centre_id)
  ) then
    raise exception 'Accès refusé aux faits de conformité' using errcode = '42501';
  end if;

  select max(l.date_expiration) into v_lic from licences l
   where l.parachutiste_id = p_parachutiste_id and l.statut = 'actif';
  -- P5 : la date de validité, et RIEN d'autre, n'est lue de cette table.
  select max(c.date_expiration) into v_med from certificats_medicaux c
   where c.parachutiste_id = p_parachutiste_id;
  select max(s.date_saut) into v_dernier_saut from sauts s
   where s.parachutiste_id = p_parachutiste_id and s.is_tunnel = false;
  select p.date_naissance into v_naissance from profiles p where p.id = p_parachutiste_id;
  select exists (select 1 from brevets b where b.parachutiste_id = p_parachutiste_id) into v_brevete;

  select b.id into v_briefing from dz_briefings b
   where b.dz_id = p_centre_id and b.date_briefing = p_date and b.published_at is not null
   order by b.revision desc limit 1;
  v_ack := v_briefing is not null and exists (
    select 1 from briefing_acknowledgements ba where ba.briefing_id = v_briefing and ba.user_id = p_parachutiste_id);

  select coalesce((select value_int from compliance_rules where rule_key = 'pliage_secours_mois'), 12) into v_pliage_mois;
  select exists (select 1 from materiels m where m.parachutiste_id = p_parachutiste_id and m.statut = 'actif' and m.type = 'parachute_secours') into v_a_secours;
  select exists (select 1 from materiels m where m.parachutiste_id = p_parachutiste_id and m.statut = 'actif' and m.type = 'parachute_principal') into v_a_principal;
  select min(coalesce(d.prochain_echeance, (d.date_maintenance + make_interval(months => coalesce(d.periodicite_mois, v_pliage_mois)))::date))
    into v_secours_ech
    from materiels m
    left join lateral (select mt.* from maintenances mt where mt.materiel_id = m.id order by mt.date_maintenance desc limit 1) d on true
   where m.parachutiste_id = p_parachutiste_id and m.statut = 'actif' and m.type = 'parachute_secours';
  select max(pl.date_pliage)::date into v_dernier_pliage from pliages pl
   where pl.parachutiste_id = p_parachutiste_id;

  select value_int into v_reprise_conseil  from compliance_rules where rule_key = 'reprise_conseil_jours';
  select value_int into v_reprise_moniteur from compliance_rules where rule_key = 'reprise_moniteur_jours';
  select value_int into v_reprise_complete from compliance_rules where rule_key = 'reprise_complete_jours';

  select exists (select 1 from qualifications_ref q where q.actif and q.code = 'WINGSUIT') into v_ref_ws;
  select exists (select 1 from qualifications_ref q where q.actif and q.code = 'VIDEO')    into v_ref_video;
  select exists (select 1 from qualifications q where q.parachutiste_id = p_parachutiste_id and q.type = 'WINGSUIT'
                   and (q.date_expiration is null or q.date_expiration >= p_date)) into v_qualif_ws;
  select exists (select 1 from qualifications q where q.parachutiste_id = p_parachutiste_id and q.type = 'VIDEO'
                   and (q.date_expiration is null or q.date_expiration >= p_date)) into v_qualif_video;

  return query
  -- LIC-001 ────────────────────────────────────────────────────────────────
  select 'LIC-001'::text,
         case when v_lic is null then 'indisponible' when v_lic < p_date then 'non_conforme' else 'conforme' end,
         case when v_lic is null then 'aucune licence active enregistrée'
              else 'licence valable jusqu''au ' || to_char(v_lic, 'DD/MM/YYYY') end
  union all
  -- MED-001 ────────────────────────────────────────────────────────────────
  select 'MED-001',
         case when v_med is null then 'indisponible' when v_med < p_date then 'non_conforme' else 'conforme' end,
         case when v_med is null then 'aucun certificat enregistré'
              else 'certificat valable jusqu''au ' || to_char(v_med, 'DD/MM/YYYY') end
  union all
  -- BRF-001 — pas de briefing publié = pas de donnée, pas « c'est bon » ───
  select 'BRF-001',
         case when v_briefing is null then 'indisponible' when v_ack then 'conforme' else 'non_conforme' end,
         case when v_briefing is null then 'aucun briefing publié ce jour'
              when v_ack then 'briefing du jour acquitté' else 'briefing du jour non acquitté' end
  union all
  -- REP-001 — seuils lus en base ; absents → indisponible ─────────────────
  select 'REP-001',
         case when v_reprise_conseil is null or v_reprise_moniteur is null or v_reprise_complete is null then 'indisponible'
              when v_dernier_saut is null then 'indisponible'
              when (p_date - v_dernier_saut) >= v_reprise_conseil then 'non_conforme'
              else 'conforme' end,
         case when v_reprise_conseil is null then 'seuils de reprise non paramétrés'
              when v_dernier_saut is null then 'aucun saut enregistré'
              when (p_date - v_dernier_saut) >= v_reprise_complete then 'interruption ' || (p_date - v_dernier_saut) || ' j — reprise complète'
              when (p_date - v_dernier_saut) >= v_reprise_moniteur then 'interruption ' || (p_date - v_dernier_saut) || ' j — reprise avec moniteur'
              when (p_date - v_dernier_saut) >= v_reprise_conseil then 'interruption ' || (p_date - v_dernier_saut) || ' j — saut d''accompagnement conseillé'
              else 'dernier saut il y a ' || (p_date - v_dernier_saut) || ' j' end
  union all
  -- MAT-001 — secours : pas de secours enregistré = pas de donnée ─────────
  select 'MAT-001',
         case when not v_a_secours then 'indisponible' when v_secours_ech is null then 'indisponible'
              when v_secours_ech < p_date then 'non_conforme' else 'conforme' end,
         case when not v_a_secours then 'aucun parachute de secours enregistré'
              when v_secours_ech is null then 'aucun pliage de secours tracé'
              else 'pliage de secours valable jusqu''au ' || to_char(v_secours_ech, 'DD/MM/YYYY') end
  union all
  -- MAT-002 — principal tracé : un pliage après le dernier saut ───────────
  select 'MAT-002',
         case when not v_a_principal then 'indisponible'
              when v_dernier_pliage is null then 'non_conforme'
              when v_dernier_saut is not null and v_dernier_pliage < v_dernier_saut then 'non_conforme'
              else 'conforme' end,
         case when not v_a_principal then 'aucun parachute principal enregistré'
              when v_dernier_pliage is null then 'aucun pliage tracé'
              when v_dernier_saut is not null and v_dernier_pliage < v_dernier_saut then 'dernier pliage tracé antérieur au dernier saut'
              else 'pliage tracé le ' || to_char(v_dernier_pliage, 'DD/MM/YYYY') end
  union all
  -- MAT-003 — vérification du principal : un CONSTAT physique, aucune
  -- donnée ne le porte aujourd'hui. Indisponible, et dit tel quel. ────────
  select 'MAT-003', 'indisponible', 'vérification du principal : aucune trace en base — à constater à l''embarquement'
  union all
  -- VOI-001 — voile / expérience : aucun seuil paramétré → indisponible ───
  select 'VOI-001', 'indisponible', 'adéquation voile / expérience : aucun seuil paramétré'
  union all
  -- QUA-001 — ne s'applique qu'au wingsuit ; sans code de référence, gris ─
  select 'QUA-001',
         case when p_type_saut <> 'wingsuit' then 'conforme'
              when not v_ref_ws then 'indisponible'
              when v_qualif_ws then 'conforme' else 'non_conforme' end,
         case when p_type_saut <> 'wingsuit' then 'sans objet pour ce type de saut'
              when not v_ref_ws then 'qualification WINGSUIT absente du référentiel des qualifications'
              when v_qualif_ws then 'qualification wingsuit valide' else 'qualification wingsuit absente' end
  union all
  -- QUA-002 — idem pour la prise de vue ───────────────────────────────────
  select 'QUA-002',
         case when p_type_saut <> 'video' then 'conforme'
              when not v_ref_video then 'indisponible'
              when v_qualif_video then 'conforme' else 'non_conforme' end,
         case when p_type_saut <> 'video' then 'sans objet pour ce type de saut'
              when not v_ref_video then 'qualification VIDEO absente du référentiel des qualifications'
              when v_qualif_video then 'qualification vidéo valide' else 'qualification vidéo absente' end
  union all
  -- EQP-001 — casque : sans objet pour un breveté ; sinon constat physique ─
  select 'EQP-001',
         case when v_brevete then 'conforme' else 'indisponible' end,
         case when v_brevete then 'breveté : sans objet' else 'non breveté : port du casque à constater à l''embarquement' end
  union all
  -- MIN-001 — sans date de naissance, on ne SAIT pas s'il est mineur ──────
  select 'MIN-001',
         case when v_naissance is null then 'indisponible'
              when v_naissance > p_date - interval '18 years' then 'indisponible'
              else 'conforme' end,
         case when v_naissance is null then 'date de naissance absente du profil'
              when v_naissance > p_date - interval '18 years' then 'mineur : autorisation parentale non tracée en base'
              else 'majeur' end
  union all
  -- BRV-001 — limites météo par brevet : la météo est lue côté client
  -- (Open-Meteo, cache d'une heure). Le fait n'est pas calculable ici sans
  -- dupliquer meteoPublics.ts. Indisponible, et c'est le tableau BigAir qui
  -- dira si cette règle doit vivre à l'embarquement plutôt qu'en base. ───
  select 'BRV-001', 'indisponible', 'limites météo par brevet : évaluées à l''embarquement, pas en base';
  -- ENC-001 : portée ROTATION, jamais de fait individuel — volontairement absent.
end $$;

comment on function faits_conformite(uuid, uuid, date, text) is
  'Feu Vert — un fait par règle individuelle : conforme / non_conforme / indisponible. Indisponible = « je n''ai pas pu lire », jamais « c''est bon ». Le verdict se calcule dans le moteur (src/lib/feuVert.ts).';

-- ── 2 · Le verdict, en SQL, pour le passage sur les données réelles ────────
-- Même règle que le moteur TypeScript, verrouillée par ses tests. Deux
-- endroits pour trois lignes : c'est le compromis déjà pris avec
-- evaluerAptitude + signalerDivergence, et il est dit.
create or replace function verdict_conformite(p_parachutiste_id uuid, p_centre_id uuid, p_date date default current_date, p_type_saut text default 'solo')
returns table (verdict text, nb_bloquants int, nb_vigilances int, nb_gris int, codes_gris text, codes_rouges text)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  with r as (select * from regles_en_vigueur(p_centre_id) where portee = 'individu'),
       f as (select * from faits_conformite(p_parachutiste_id, p_centre_id, p_date, p_type_saut)),
       j as (select r.code, r.gravite, coalesce(f.etat, 'indisponible') as etat
             from r left join f on f.code = r.code)
  select case when count(*) filter (where etat = 'non_conforme' and gravite = 'bloquant') > 0 then 'rouge'
              when count(*) filter (where etat = 'indisponible') > 0 then 'gris'
              when count(*) filter (where etat = 'non_conforme' and gravite = 'vigilance') > 0 then 'orange'
              else 'vert' end,
         count(*) filter (where etat = 'non_conforme' and gravite = 'bloquant')::int,
         count(*) filter (where etat = 'non_conforme' and gravite = 'vigilance')::int,
         count(*) filter (where etat = 'indisponible')::int,
         string_agg(code, ' ' order by code) filter (where etat = 'indisponible'),
         string_agg(code, ' ' order by code) filter (where etat = 'non_conforme' and gravite = 'bloquant')
  from j
$$;

-- ── 3 · P5 — Aucune donnée de santé ────────────────────────────────────────
-- ÉTAT MESURÉ : 33 certificats, tous 'aptitude_totale', restrictions_medicales
-- vide partout. Mais le formulaire proposait « Aptitude restrictive » et
-- « Inapte », et la page PUBLIQUE du QR les affichait. Un tiers pouvait lire
-- un état de santé. Le CACI fédéral est un certificat de non contre-
-- indication : il n'existe pas d'aptitude restrictive sur ce document.
-- On ne garde que la date, le médecin et la pièce.
alter table certificats_medicaux drop column if exists restrictions_medicales;
alter table certificats_medicaux drop column if exists type;

comment on table certificats_medicaux is
  'P5 — dates de visite et de validité, médecin, pièce. Aucun contenu médical, aucun motif, aucun type d''aptitude : un CACI est valide ou ne l''est pas.';

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- À JOUER APRÈS APPLICATION — le passage sur les données réelles (P3.6) :
--
--   select v.verdict, count(*) from licencies_centres lc
--   cross join lateral verdict_conformite(lc.parachutiste_id, lc.centre_id) v
--   where lc.centre_id = (select id from centres where nom = 'BigAir Rochefort')
--     and lc.statut = 'actif'
--   group by v.verdict;
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- APPLIQUÉE LE 06/09/2026 après validation.
--
-- P5 — PREUVE : colonnes restantes de certificats_medicaux =
--   id, parachutiste_id, medecin, date_visite, date_expiration,
--   scan_certificat_url, created_at.  Ni type, ni restrictions.
--
-- P3.6 — PASSAGE SUR LES DONNÉES RÉELLES · BigAir Rochefort · 25 licenciés
-- actifs hors démo · saut solo · 06/09/2026 :
--
--   vert 0 · orange 0 · rouge 4 · gris 21        (8,5 règles grises / personne)
--
-- Motifs, par fréquence (personnes sur 25) :
--   indisponible  BRF-001 25  aucun briefing publié ce jour (dimanche)
--   indisponible  BRV-001 25  météo par brevet : pas de fait en base
--   indisponible  MAT-003 25  vérification du principal : constat physique
--   indisponible  VOI-001 25  voile / expérience : aucun seuil paramétré
--   indisponible  MAT-001 24  aucun parachute de secours ENREGISTRÉ
--   indisponible  MAT-002 23  aucun parachute principal ENREGISTRÉ
--   indisponible  MIN-001 17  date de naissance absente du profil
--   indisponible  EQP-001 13  non breveté : casque à constater
--   indisponible  LIC-001  9  aucune licence active enregistrée
--   indisponible  MED-001  9  aucun certificat enregistré
--   indisponible  REP-001  8  aucun saut enregistré
--   non_conforme  REP-001  5  interruption > 90 j
--   non_conforme  LIC-001  2  licence expirée
--   non_conforme  MED-001  2  certificat expiré
--   non_conforme  MAT-001  1  pliage de secours dépassé
--   non_conforme  MAT-002  1  pliage antérieur au dernier saut
--
-- LECTURE : les 4 rouges sont de VRAIS refus (licence, certificat, secours).
-- Le gris n'est pas un bug du moteur : c'est la mesure exacte de ce que la
-- base ne sait pas. Quatre règles sont grises pour TOUT LE MONDE parce
-- qu'aucune donnée ne les porte (BRV, MAT-003, VOI) ou qu'il n'y a pas de
-- briefing un dimanche (BRF). Deux le sont pour presque tous parce que le
-- matériel n'est pas enregistré (MAT-001/002). Le DT arbitre : renseigner,
-- désactiver chez lui, ou faire vivre la règle à l'embarquement.
-- ════════════════════════════════════════════════════════════════════════════
