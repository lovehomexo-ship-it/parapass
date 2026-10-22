-- ═══════════════════════════════════════════════════════════════════════════
-- UNE PLANCHE DE DÉMONSTRATION VALIDÉE BLOQUAIT TOUTE LA DÉMONSTRATION.
--
-- Symptôme : sur BigAir Rochefort, « Générer la journée de démonstration »
-- répondait « Embarquement valide : cette planche ne se modifie plus ». Aucune
-- donnée n'était produite — le bouton était là, il ne servait à rien.
--
-- Cause. Valider un embarquement FIGE la planche : un déclencheur refuse toute
-- écriture sur ses places, suppression comprise. C'est une bonne règle — ce
-- qui a été annoncé à l'équipage ne se réécrit pas. Mais `retirer_demo_dz`
-- commence par supprimer les places des rotations de démonstration : il se
-- heurtait au déclencheur et levait, et comme le générateur appelle le retrait
-- en premier, c'est la journée entière qui n'était pas générée. Royan ne l'a
-- jamais rencontré : aucune de ses planches de démonstration n'avait été
-- validée. BigAir en gardait une, du 27 septembre.
--
-- Correction. On ROUVRE l'embarquement des planches de démonstration avant de
-- les supprimer — et d'elles seules (`demo` vrai, et le centre demandé). La
-- règle n'est pas affaiblie : une démonstration n'est pas une histoire, elle
-- n'a jamais été annoncée à un équipage. Aucune planche réelle n'est touchée,
-- et le déclencheur continue de les protéger exactement comme avant.
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

  -- LES PLANCHES DE DEMONSTRATION SE ROUVRENT AVANT D'ETRE SUPPRIMEES.
  -- Sans cela le declencheur « planche figee » refuse la suppression de leurs
  -- places, et c'est toute la generation qui echoue. Seules les planches
  -- marquees `demo` de CE centre sont concernees.
  update rotations r set embarquement_valide_le = null
   where r.centre_id = p_centre_id and r.demo and r.embarquement_valide_le is not null;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('planches_rouvertes', v_c);

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
