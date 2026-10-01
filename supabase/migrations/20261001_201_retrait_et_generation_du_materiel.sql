-- ═══════════════════════════════════════════════════════════════════════════
-- LE PARC NE RENTRAIT PAS AU RACK, ET LE GÉNÉRATEUR NE PRÊTAIT RIEN.
--
-- `retirer_demo_dz` supprimait les présences mais laissait les sacs du centre
-- marqués « pris » ou « à plier », attribués à des présences qui n'existaient
-- plus : un parc qui se croit dehors indéfiniment. On le libère.
--
-- `generer_demo_dz` appelle désormais `demo_materiel_dz_du_jour` (migration
-- 200), APRÈS les présences qu'elle modifie, et rend compte du prêt.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.retirer_demo_dz(p_centre_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
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
  -- de demonstration, TOUS les licencies le portent. Seuls les profils a
  -- identifiant deterministe fabriques par les generateurs sont jetables.
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

  -- AVANT `materiels` : les presences referencent la voile perso.
  delete from dz_presences dp where dp.dz_id = p_centre_id and dp.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('presences', v_c);

  -- LE PARC RENTRE AU RACK. Les sacs du centre pretes par la demonstration
  -- restaient « pris » alors que la presence qui les tenait vient d'etre
  -- supprimee : le parc se serait cru dehors indefiniment.
  update sacs_parachute s set etat_journee = 'libre'
   where s.centre_id = p_centre_id and s.etat_journee is distinct from 'libre';
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('sacs_liberes', v_c);

  -- Les attestations remises en attente par la demo redeviennent valides.
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
$function$;

create or replace function public.generer_demo_dz(p_centre_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_res jsonb := '{}'::jsonb;
  v_pliage jsonb := '{}'::jsonb;
  v_demandes jsonb;
  v_equipe jsonb;
  v_materiel jsonb := '{}'::jsonb;
  v_sauts int := 0;
  v_tandem int := 0;
  v_ignores text[] := '{}';
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_dz(p_centre_id);

  -- L'ENCADREMENT D'ABORD : les regles de securite lisent les qualifications
  -- (largueur, tandem, referent mineurs). Composer des planches avant de savoir
  -- qui encadre donnerait des verdicts faux.
  v_equipe := demo_equipe_encadrante(p_centre_id);

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

  -- APRES les presences, qu'elle modifie : une partie du monde saute avec le
  -- materiel du centre, et le parc doit le dire. Sans module de pliage, le
  -- pret reste vrai : le centre prete des sacs qu'il n'a pas plies lui-meme.
  v_materiel := demo_materiel_dz_du_jour(p_centre_id);

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
    'qualifications', coalesce((v_equipe->>'qualifications')::int, 0),
    'delegations', coalesce((v_equipe->>'delegations')::int, 0),
    'materiel_prete', coalesce((v_materiel->>'materiel_prete')::int, 0),
    'sacs_a_plier', coalesce((v_materiel->>'sacs_a_plier')::int, 0),
    'arrivees_tardives', coalesce((v_materiel->>'arrivees_tardives')::int, 0),
    'modules_non_souscrits', to_jsonb(v_ignores),
    'presents', (select count(*) from dz_presences
                  where dz_id = p_centre_id and date_presence = current_date));
end $function$;
