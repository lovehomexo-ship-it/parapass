-- ════════════════════════════════════════════════════════════════════════════
-- FEU VERT · P5 — Le scan à l'embarquement : résoudre un QR en une personne.
--
-- Le QR de la licence existe déjà, en DEUX formes (PasseportCardView) :
--   https://parapass.fr/verify/<token>        — jeton de qr_tokens (récent)
--   https://parapass.fr/verify/<profile.id>   — id de profil (ancienne carte)
-- On ne crée pas un troisième format : cette fonction accepte les deux.
--
-- Ce qu'elle rend est le MINIMUM du geste (P6, une seconde au pied de
-- l'avion) : l'id, le nom, le prénom, la photo. Pas de document, pas de
-- verdict — le verdict, c'est le moteur qui le rend, et il est journalisé.
-- Réservée aux admins du centre, et seulement pour SES licenciés actifs :
-- scanner la carte d'un inconnu ne révèle rien.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function resoudre_scan(p_centre_id uuid, p_valeur text)
returns table (parachutiste_id uuid, nom text, prenom text, photo_url text, numero_licence text)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_id uuid;
begin
  if not exists (select 1 from admin_centres a where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  -- 1 · un jeton de qr_tokens ?
  select q.parachutiste_id into v_id from qr_tokens q where q.token = p_valeur limit 1;

  -- 2 · sinon, un id de profil (ancienne carte) ?
  if v_id is null and p_valeur ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := p_valeur::uuid;
  end if;

  if v_id is null then
    raise exception 'QR non reconnu : ce n''est pas une carte ParaPass.' using errcode = 'P0002';
  end if;

  -- 3 · et un licencié ACTIF de ce centre — sinon on ne dit rien de lui.
  if not exists (select 1 from licencies_centres lc
                 where lc.parachutiste_id = v_id and lc.centre_id = p_centre_id and lc.statut = 'actif') then
    raise exception 'Cette personne n''est pas licenciée active de ce centre.'
      using errcode = '42501', hint = 'Vérifiez son rattachement dans Mes licenciés.';
  end if;

  return query
  select p.id, p.nom, p.prenom, coalesce(p.photo_identite_url, p.photo_profil_url), p.numero_licence
  from profiles p where p.id = v_id;
end $$;

comment on function resoudre_scan(uuid, text) is
  'Feu Vert · P5 — un QR de licence (jeton ou id) → le licencié du centre. Le minimum du geste : id, nom, prénom, photo. Rien sur un inconnu.';

commit;
