-- ═══════════════════════════════════════════════════════════════════════════
-- PLIAGE — journée de démonstration.
--
-- Mesuré avant d'écrire : BigAir a 6 sacs, 48 pliages et 3 plieurs habilités,
-- mais ZÉRO assignation ouverte. L'historique est plein, la journée est vide —
-- l'écran ne montre donc rien de ce qui fait le module : qui a pris quel sac,
-- lequel est à plier, ce qui reste à régler.
--
-- MÊME DOCTRINE QUE L'AVIONNAGE :
--   • colonne marqueur `demo` sur les trois tables. Le retrait vise `demo`,
--     jamais un nom, jamais une date. Les 48 pliages réels sont hors d'atteinte.
--   • aucun plieur n'est inventé : la démo n'attribue un pliage habilité qu'à
--     quelqu'un de RÉELLEMENT habilité. Sans habilité, elle bascule en
--     auto-pliage, ce qui est la vérité du terrain — un sauteur plie sa voile.
--   • réservée à l'administrateur DU centre, module Pliage souscrit.
--   • idempotente : deux clics ne font pas huit sacs.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table sacs_parachute  add column if not exists demo boolean not null default false;
alter table pliages         add column if not exists demo boolean not null default false;
alter table sac_assignments add column if not exists demo boolean not null default false;

comment on column sacs_parachute.demo is
  'Sac de démonstration. Seule cible de retirer_demo_pliage — jamais un sac réel.';

-- ── Retrait ────────────────────────────────────────────────────────────────
create or replace function retirer_demo_pliage(p_centre_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sacs int; v_pliages int; v_assign int;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  delete from pliages p where p.centre_id = p_centre_id and p.demo;
  get diagnostics v_pliages = row_count;

  delete from sac_assignments a where a.centre_id = p_centre_id and a.demo;
  get diagnostics v_assign = row_count;

  delete from sacs_parachute s where s.centre_id = p_centre_id and s.demo;
  get diagnostics v_sacs = row_count;

  return jsonb_build_object('sacs', v_sacs, 'pliages', v_pliages, 'assignations', v_assign);
end $$;

-- ── Génération ─────────────────────────────────────────────────────────────
create or replace function generer_demo_pliage(p_centre_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_gens uuid[]; v_plieurs uuid[]; v_n int; v_np int;
  v_sac uuid; v_sacs int := 0; v_pliages int := 0; v_assign int := 0;
  v_etats text[] := array['pris','pris','a_plier','libre','pris','a_plier'];
  v_paiements text[] := array['a_regler','paye_comptoir','paye_app','a_regler','paye_comptoir','a_regler'];
  i int;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;
  if not centre_module_actif(p_centre_id, 'pliage') then
    raise exception 'Le module Pliage n''est pas souscrit pour ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_pliage(p_centre_id);

  select array_agg(x.id) into v_gens from (
    select lc.parachutiste_id as id
    from licencies_centres lc join profiles p on p.id = lc.parachutiste_id
    where lc.centre_id = p_centre_id and lc.statut = 'actif'
    order by p.nom, p.prenom limit 6
  ) x;
  v_n := coalesce(array_length(v_gens, 1), 0);
  if v_n < 3 then
    raise exception 'Pas assez de licencies actifs (%) pour une demo.', v_n using errcode = 'P0002';
  end if;

  -- Les plieurs HABILITÉS du centre, et eux seuls. Aucune habilitation créée.
  select array_agg(v.plieur_id) into v_plieurs
  from plieurs_valides v
  where v.centre_id = p_centre_id and v.actif
    and (v.date_expiration is null or v.date_expiration >= now());
  v_np := coalesce(array_length(v_plieurs, 1), 0);

  for i in 1..6 loop
    insert into sacs_parachute (centre_id, qr_code_token, nom_court, marque, modele,
                                numero_serie, actif, statut, etat_journee, demo)
    values (p_centre_id, 'demo-' || gen_random_uuid()::text,
            'DÉMO ' || i,
            (array['Vector','Javelin','Mirage','Icon','Wings','Talon'])[i],
            'Sport ' || (180 + i * 10),
            'DEMO-' || lpad(i::text, 3, '0'),
            true, 'en_service', v_etats[i], true)
    returning id into v_sac;
    v_sacs := v_sacs + 1;

    -- Un sac « pris » a forcément quelqu'un dessous : sans l'assignation, la
    -- journée afficherait un état sans personne, ce qui ne veut rien dire.
    if v_etats[i] = 'pris' then
      insert into sac_assignments (sac_id, licencie_id, centre_id, start_at, demo)
      values (v_sac, v_gens[1 + ((i - 1) % v_n)], p_centre_id,
              now() - (i * interval '25 minutes'), true);
      v_assign := v_assign + 1;
    end if;

    insert into pliages (sac_id, plieur_id, centre_id, parachutiste_id,
                         statut_paiement, montant, flag_qualif, type_pliage,
                         date_pliage, note, demo)
    values (v_sac,
            case when v_np > 0 then v_plieurs[1 + ((i - 1) % v_np)] end,
            p_centre_id, v_gens[1 + ((i - 1) % v_n)],
            case when v_np > 0 then v_paiements[i] else 'auto_plie' end,
            case when v_np > 0 then 12.00 else null end,
            i = 3,                       -- un seul signalé : le cas doit se voir
            case when v_np > 0 then 'habilite' else 'auto' end,
            now() - (i * interval '40 minutes'),
            case when i = 3 then 'Élévateur gauche à revoir' end,
            true);
    v_pliages := v_pliages + 1;
  end loop;

  return jsonb_build_object('sacs', v_sacs, 'pliages', v_pliages,
                            'assignations', v_assign, 'plieurs_habilites', v_np);
end $$;

comment on function generer_demo_pliage(uuid) is
  'Pliage — remplit la journee de 6 sacs de demonstration, leurs assignations et leurs pliages. Idempotente.';

revoke all on function generer_demo_pliage(uuid) from public;
revoke all on function retirer_demo_pliage(uuid) from public;
grant execute on function generer_demo_pliage(uuid) to authenticated;
grant execute on function retirer_demo_pliage(uuid) to authenticated;

commit;

-- APPLIQUEE LE 10/09/2026 apres validation.
-- Prouve sur BigAir : 6 sacs, 3 pris, 6 pliages, 2 plieurs habilites employes.
-- Second appel identique (idempotente). Reel intact : 6 sacs, 48 pliages.
