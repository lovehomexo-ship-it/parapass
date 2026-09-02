-- ═══════════════════════════════════════════════════════════════════════════
-- P11.1 — Isolation des données de démonstration.
--
-- Constat : les profils « DÉMO » vivaient dans la base de PRODUCTION, mêlés aux
-- vrais licenciés. Mesuré sur BigAir Rochefort :
--     licenciés du centre : 29 affichés → 25 réels  (4 de démo)
--     carnets à valider   : 25 affichés → 21 réels  (4 de démo)
--
-- Frontière retenue, volontairement explicite :
--   • Vues ADMINISTRATIVES et RÉGLEMENTAIRES (liste des licenciés, conformité,
--     file d'attestation, compteurs du tableau de bord) → données RÉELLES seules.
--   • Vue OPÉRATIONNELLE du jour (présences, aptitude, sauts du jour)
--     → la démonstration reste visible : c'est là qu'elle se joue.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Marqueurs explicites, plutôt que des heuristiques sur le nom ou l'e-mail
--    disséminées dans le code.
alter table public.profiles
  add column if not exists est_demo       boolean not null default false,
  add column if not exists compte_interne boolean not null default false;

create index if not exists idx_profiles_est_demo on public.profiles(id) where est_demo;

update public.profiles set est_demo = true
 where est_demo = false and (email like '%@parapass.demo' or nom = 'DÉMO');
update public.profiles set compte_interne = true
 where compte_interne = false and email like '%@parapass.fr';

comment on column public.profiles.est_demo is
  'Profil créé par le générateur de journée de démonstration. Exclu par défaut '
  'des listes administratives et des compteurs (P11.1).';
comment on column public.profiles.compte_interne is
  'Compte ParaPass interne. Donne accès aux outils de démonstration, masqués '
  'aux administrateurs de DZ clientes (P11.1).';

-- 2) Marquage AUTOMATIQUE : un déclencheur plutôt qu'une ligne dans le
--    générateur, pour qu'une évolution future de celui-ci ne puisse pas
--    l'oublier. Les domaines @parapass.demo et @parapass.fr sont réservés.
create or replace function public.marquer_profil_demo()
returns trigger language plpgsql as $$
begin
  if new.email like '%@parapass.demo' then new.est_demo := true; end if;
  if new.email like '%@parapass.fr'   then new.compte_interne := true; end if;
  return new;
end;
$$;

drop trigger if exists trg_marquer_profil_demo on public.profiles;
create trigger trg_marquer_profil_demo
  before insert or update of email on public.profiles
  for each row execute function public.marquer_profil_demo();

-- 3) get_conformite_licencies et retirer_demo_journee sont redéployées par
--    ailleurs (migrations « p11_exclure_demo_de_la_conformite » et
--    « p11_purge_demo_complete_et_fiable ») :
--    • la conformité joint profiles et filtre est_demo = false ;
--    • la purge supprime enfin licences, certificats, acquittements de
--      briefing, affiliation, profils ET comptes auth — l'ancienne version les
--      laissait, si bien que les « DÉMO » réapparaissaient après un retrait.
--      Elle repérait aussi ses cibles par « numero_licence LIKE 'DEMO-%' »,
--      fragile ; elle s'appuie désormais sur le marqueur est_demo.
--
-- Vérifié en session BigAir, cycle complet :
--   Retirer  → 0 profil, 0 affiliation, 0 licence, 0 certificat, 0 pliage,
--              0 tandem, 0 briefing, 0 présence : aucune trace.
--   Générer  → 4 profils marqués automatiquement par le déclencheur,
--              Chloé médical périmé, David 200 jours d'inactivité.
--   Compteurs: 25 licenciés et 21 carnets — les vrais chiffres.
