-- ═══════════════════════════════════════════════════════════════════════════
-- « violates foreign key constraint "dz_presences_sac_ref_fkey" »
--
-- MÊME FAUTE QUE LA PRÉCÉDENTE, UN CRAN PLUS LOIN. Depuis que la démonstration
-- prête des sacs du centre (migration 200), une présence porte `sac_ref`.
-- `retirer_demo_dz` supprimait les SACS de démonstration avant les PRÉSENCES
-- qui les désignent : la veille au soir, six présences de BigAir pointaient
-- sur DEMO 1 à DEMO 6, et la régénération du lendemain butait dessus. Le
-- bouton ne produisait plus rien.
--
-- On supprime donc les présences AVANT les sacs, comme elles l'étaient déjà
-- avant les matériels pour exactement la même raison (`voile_perso_ref`). Une
-- présence référence du matériel ; le matériel ne référence pas de présence.
-- L'ordre découle du sens des liens, ce n'est pas une convention.
--
-- ET UNE CEINTURE EN PLUS DES BRETELLES : juste avant de supprimer les sacs,
-- on détache ceux que désignerait encore une présence non marquée `demo` — le
-- cas d'un licencié réel à qui la démonstration aurait prêté un sac. L'ordre
-- règle le cas normal, ce détachement règle celui qu'on n'a pas prévu.
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

  -- LES PRESENCES D'ABORD. Elles designent une voile perso (`voile_perso_ref`)
  -- ET un sac du centre (`sac_ref`) : elles doivent partir avant les deux.
  delete from dz_presences dp where dp.dz_id = p_centre_id and dp.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('presences', v_c);

  delete from pliages p where p.centre_id = p_centre_id and (p.demo or p.note like '[DÉMO]%');
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('pliages', v_c);
  delete from sac_assignments a where a.centre_id = p_centre_id and a.demo;

  -- Ceinture : une presence NON marquee demo qui pointerait encore sur un sac
  -- de demonstration le lache, au lieu de bloquer tout le retrait.
  update dz_presences dp set sac_ref = null, materiel_type = 'perso'
   where dp.sac_ref in (select s.id from sacs_parachute s
                         where s.centre_id = p_centre_id and s.demo);
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('sacs_detaches', v_c);

  delete from sacs_parachute s where s.centre_id = p_centre_id and s.demo;

  delete from sauts s where s.centre_id = p_centre_id and s.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('sauts', v_c);

  delete from tandem_bookings b where b.centre_id = p_centre_id and b.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('tandem', v_c);
  delete from tandem_slots t where t.centre_id = p_centre_id and t.demo;

  delete from briefing_acknowledgements ba using dz_briefings b
   where ba.briefing_id = b.id and b.dz_id = p_centre_id and b.demo;
  delete from dz_briefings b where b.dz_id = p_centre_id and b.demo;

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
