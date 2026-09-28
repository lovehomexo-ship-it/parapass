-- Deux défauts du bouton unique, découverts en le regardant tourner.
--
-- 1. La démonstration ne produisait AUCUNE demande en attente : ni adhésion, ni
--    attestation de carnet. Les pastilles du menu restaient donc à zéro et il
--    n'y avait rien à montrer sur les deux écrans du guichet.
--
-- 2. UN SEUL module non souscrit faisait échouer TOUTE la génération.
--    `generer_demo_pliage` lève « Le module Pliage n'est pas souscrit » — c'est
--    juste pour un appel direct depuis l'écran Pliage, où l'utilisateur a
--    demandé ce module-là. Mais le bouton unique génère la journée entière : il
--    ne doit pas s'arrêter parce qu'une DZ n'a pas pris le pliage. Mesuré sur
--    Royan, qui n'a ni pliage ni tandem : le bouton ne générait RIEN, pas même
--    les planches. Il génère désormais ce que le centre a souscrit, et nomme ce
--    qu'il a sauté.

create or replace function demo_demandes_en_attente(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prenoms text[] := array['Camille','Jonas'];
  v_i int;
  v_carnets int;
begin
  -- Des candidats, pas des licenciés : c'est ce que veut dire « demande
  -- d'adhésion ». Identifiants déterministes, donc retirables sans ambiguïté.
  for v_i in 1..2 loop
    v_id := md5(p_centre_id::text || '-demo-candidat-' || v_i)::uuid;

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'demo-candidat-' || v_i || '-' || left(p_centre_id::text, 8) || '@parapass.demo', '',
        now(), now(), now(), '{"provider":"demo"}', '{}')
    on conflict (id) do nothing;

    insert into profiles (id, role, prenom, nom, email, numero_licence, est_demo)
    values (v_id, 'parachutiste', v_prenoms[v_i], 'CANDIDAT',
        'demo-candidat-' || v_i || '-' || left(p_centre_id::text, 8) || '@parapass.demo',
        'DEMO-CAND-' || v_i, true)
    on conflict (id) do update
      set prenom = excluded.prenom, nom = excluded.nom, est_demo = true;

    insert into licencies_centres (parachutiste_id, centre_id, statut)
    values (v_id, p_centre_id, 'en_attente')
    on conflict (parachutiste_id, centre_id) do update set statut = 'en_attente';
  end loop;

  -- Deux licenciés actifs redemandent l'attestation de leur carnet. Jamais un
  -- dossier réel : `donnees_reelles` protège les profils que la DZ tient à jour.
  with cibles as (
    select lc.id from licencies_centres lc
      join profiles p on p.id = lc.parachutiste_id
     where lc.centre_id = p_centre_id and lc.statut = 'actif'
       and not p.donnees_reelles
     order by p.nom limit 2
  )
  update licencies_centres lc
     set carnet_statut = 'en_attente', carnet_valide_par = null,
         carnet_date_validation = null, carnet_motif_refus = null
    from cibles where lc.id = cibles.id;
  get diagnostics v_carnets = row_count;

  return jsonb_build_object('adhesions', 2, 'carnets', v_carnets);
end
$$;

create or replace function generer_demo_dz(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb := '{}'::jsonb;
  v_pliage jsonb := '{}'::jsonb;
  v_demandes jsonb;
  v_sauts int := 0;
  v_tandem int := 0;
  v_ignores text[] := '{}';
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_dz(p_centre_id);

  -- L'avionnage pose le décor ET le casting. Sans lui, pas de planches ni de
  -- sauts — mais le reste de la journée se génère quand même.
  if centre_module_actif(p_centre_id, 'avionnage') then
    v_res   := generer_demo_avionnage(p_centre_id);
    v_sauts := demo_sauts_du_jour(p_centre_id);
  else
    perform demo_briefing_du_jour(p_centre_id);
    v_res := jsonb_build_object('dossiers', demo_dossiers_a_jour(p_centre_id));
    v_ignores := array_append(v_ignores, 'Avionnage');
  end if;

  if centre_module_actif(p_centre_id, 'pliage') then
    v_pliage := generer_demo_pliage(p_centre_id);
  else
    v_ignores := array_append(v_ignores, 'Pliage');
  end if;

  if centre_module_actif(p_centre_id, 'tandem') then
    v_tandem := demo_reservations_tandem(p_centre_id);
  else
    v_ignores := array_append(v_ignores, 'Tandem');
  end if;

  v_demandes := demo_demandes_en_attente(p_centre_id);
  perform demo_messages_du_jour(p_centre_id);

  update dz_briefings set demo = true
   where dz_id = p_centre_id and date_briefing = current_date and not demo;
  update dz_presences set demo = true
   where dz_id = p_centre_id and date_presence = current_date and not demo;

  return v_res || jsonb_build_object(
    'sauts', v_sauts, 'tandem', v_tandem,
    'pliages', coalesce((v_pliage->>'pliages')::int, 0),
    'sacs', coalesce((v_pliage->>'sacs')::int, 0),
    'adhesions', coalesce((v_demandes->>'adhesions')::int, 0),
    'carnets', coalesce((v_demandes->>'carnets')::int, 0),
    'modules_non_souscrits', to_jsonb(v_ignores),
    'presents', (select count(*) from dz_presences
                  where dz_id = p_centre_id and date_presence = current_date));
end
$$;

-- Le retrait doit défaire AUSSI les demandes : rendre les carnets à leur état
-- valide et supprimer les candidats à l'adhésion, qui ne sont pas des licenciés.
create or replace function retirer_demo_dz(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jetables uuid[];
  v_n jsonb := '{}'::jsonb;
  v_c int;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  -- ATTENTION : `profiles.est_demo` ne veut PAS dire « jetable ». Sur un centre
  -- de démonstration, TOUS les licenciés le portent. Seuls les profils à
  -- identifiant déterministe fabriqués par les générateurs sont jetables.
  select array_agg(p.id) into v_jetables
    from profiles p
   where p.id in (
           md5(p_centre_id::text || '-demo-para-1')::uuid,
           md5(p_centre_id::text || '-demo-para-2')::uuid,
           md5(p_centre_id::text || '-demo-para-3')::uuid,
           md5(p_centre_id::text || '-demo-para-4')::uuid,
           md5(p_centre_id::text || '-demo-candidat-1')::uuid,
           md5(p_centre_id::text || '-demo-candidat-2')::uuid);

  delete from places_rotation pr using rotations r
   where pr.rotation_id = r.id and r.centre_id = p_centre_id and r.demo;
  delete from file_avionnage f where f.centre_id = p_centre_id and f.demo;
  delete from rotations r where r.centre_id = p_centre_id and r.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('planches', v_c);

  delete from pliages p where p.centre_id = p_centre_id and (p.demo or p.note like '[DÉMO]%');
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('pliages', v_c);
  delete from sac_assignments a where a.centre_id = p_centre_id and a.demo;
  delete from sacs_parachute s where s.centre_id = p_centre_id and s.demo;

  delete from sauts s where s.centre_id = p_centre_id and s.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('sauts', v_c);

  delete from tandem_bookings b where b.centre_id = p_centre_id and b.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('tandem', v_c);
  delete from tandem_slots t where t.centre_id = p_centre_id and t.demo;

  delete from briefing_acknowledgements ba using dz_briefings b
   where ba.briefing_id = b.id and b.dz_id = p_centre_id and b.demo;
  delete from dz_briefings b where b.dz_id = p_centre_id and b.demo;

  -- AVANT `materiels` : les présences référencent la voile perso.
  delete from dz_presences dp where dp.dz_id = p_centre_id and dp.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('presences', v_c);

  -- Les attestations remises en attente par la démo redeviennent valides.
  update licencies_centres lc
     set carnet_statut = 'valide'
    from profiles p
   where p.id = lc.parachutiste_id and lc.centre_id = p_centre_id
     and lc.statut = 'actif' and lc.carnet_statut = 'en_attente'
     and not p.donnees_reelles;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('carnets_rendus', v_c);

  delete from messages      where conversation_id = md5(p_centre_id::text || '-demo-conv-1')::uuid;
  delete from conversations where id = md5(p_centre_id::text || '-demo-conv-1')::uuid;
  delete from notifications where id = md5(p_centre_id::text || '-demo-notif-1')::uuid;

  if v_jetables is not null then
    delete from briefing_acknowledgements where user_id = any(v_jetables);
    delete from plieurs_valides      where plieur_id = any(v_jetables);
    delete from pliages              where parachutiste_id = any(v_jetables) or plieur_id = any(v_jetables);
    delete from dz_presences         where user_id = any(v_jetables);
    delete from sauts                where parachutiste_id = any(v_jetables);
    delete from places_rotation      where parachutiste_id = any(v_jetables);
    delete from file_avionnage       where parachutiste_id = any(v_jetables);
    delete from materiels            where parachutiste_id = any(v_jetables);
    delete from licences             where parachutiste_id = any(v_jetables);
    delete from certificats_medicaux where parachutiste_id = any(v_jetables);
    delete from seances_jour         where dz_id = p_centre_id and created_by = any(v_jetables);
    delete from derogations          where parachutiste_id = any(v_jetables);
    delete from conversations        where participant_1_id = any(v_jetables) or participant_2_id = any(v_jetables);
    delete from progression_epreuves where user_id = any(v_jetables);
    delete from licencies_centres    where parachutiste_id = any(v_jetables);
    delete from profiles             where id = any(v_jetables);
    delete from auth.users           where id = any(v_jetables);
    v_n := v_n || jsonb_build_object('profils_jetables_retires', array_length(v_jetables, 1));
  end if;

  return v_n;
end
$$;

grant execute on function demo_demandes_en_attente(uuid) to authenticated;
