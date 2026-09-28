-- P11 : une donnee de demonstration se RECONNAIT. Cinq tables la portaient deja
-- (rotations, file_avionnage, pliages, sacs_parachute, sac_assignments) ; les
-- cinq autres se reperaient a des prefixes de texte, ce qui rendait le retrait
-- approximatif -- et bloquant des qu'une cle etrangere s'y opposait.
alter table sauts           add column if not exists demo boolean not null default false;
alter table dz_presences    add column if not exists demo boolean not null default false;
alter table dz_briefings    add column if not exists demo boolean not null default false;
alter table tandem_slots    add column if not exists demo boolean not null default false;
alter table tandem_bookings add column if not exists demo boolean not null default false;

create index if not exists sauts_demo_idx on sauts (centre_id) where demo;

-- Rattrapage : ce que les anciens generateurs avaient pose sans marqueur.
update sauts           set demo = true where lieu = 'Zone de démo' and not demo;
update dz_briefings    set demo = true where consignes like '[DÉMO]%' and not demo;
update tandem_bookings set demo = true where (notes like '[DÉMO]%' or offreur_email like '%@parapass.demo') and not demo;
update tandem_slots ts set demo = true
 where not ts.demo and exists (select 1 from tandem_bookings b where b.slot_id = ts.id and b.demo);
update dz_presences dp set demo = true
 where not dp.demo and exists (select 1 from profiles p where p.id = dp.user_id and p.est_demo);

-- ── LE RETRAIT, EN UN SEUL ENDROIT ET DANS LE BON ORDRE ─────────────────────
-- `retirer_demo_journee` echouait : il supprimait `materiels` avant
-- `dz_presences`, qui les reference par `voile_perso_ref`. Le bouton « Retirer
-- la demo » repondait « Retrait de la demo impossible » et la demo restait.
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

  -- ATTENTION — `profiles.est_demo` ne veut PAS dire « jetable ». Chez Royan,
  -- centre de demonstration, TOUS les licencies le portent, y compris Nadege
  -- COURTOIS dont l'habilitation plieuse est referencee ailleurs. Viser
  -- `est_demo` effacait le casting que la demonstration doit montrer : la
  -- contrainte `plieurs_valides` l'a arrete, sinon 22 licencies partaient.
  --
  -- Les profils VRAIMENT jetables sont les quatre que l'ancien generateur
  -- fabriquait, a identifiants deterministes. On ne vise qu'eux.
  select array_agg(p.id) into v_jetables
    from profiles p
   where p.id in (
           md5(p_centre_id::text || '-demo-para-1')::uuid,
           md5(p_centre_id::text || '-demo-para-2')::uuid,
           md5(p_centre_id::text || '-demo-para-3')::uuid,
           md5(p_centre_id::text || '-demo-para-4')::uuid);

  -- 1. L'avionnage : places, puis file, puis planches.
  delete from places_rotation pr using rotations r
   where pr.rotation_id = r.id and r.centre_id = p_centre_id and r.demo;
  delete from file_avionnage f where f.centre_id = p_centre_id and f.demo;
  delete from rotations r where r.centre_id = p_centre_id and r.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('planches', v_c);

  -- 2. Le pliage : pliages, assignations, sacs.
  delete from pliages p where p.centre_id = p_centre_id and (p.demo or p.note like '[DÉMO]%');
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('pliages', v_c);
  delete from sac_assignments a where a.centre_id = p_centre_id and a.demo;
  delete from sacs_parachute s where s.centre_id = p_centre_id and s.demo;

  -- 3. Les sauts de demonstration.
  delete from sauts s where s.centre_id = p_centre_id and s.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('sauts', v_c);

  -- 4. Le tandem : reservations avant creneaux.
  delete from tandem_bookings b where b.centre_id = p_centre_id and b.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('tandem', v_c);
  delete from tandem_slots t where t.centre_id = p_centre_id and t.demo;

  -- 5. Le briefing : accuses avant briefing.
  delete from briefing_acknowledgements ba using dz_briefings b
   where ba.briefing_id = b.id and b.dz_id = p_centre_id and b.demo;
  delete from dz_briefings b where b.dz_id = p_centre_id and b.demo;

  -- 6. Les presences. AVANT `materiels` : elles referencent la voile perso.
  delete from dz_presences dp where dp.dz_id = p_centre_id and dp.demo;
  get diagnostics v_c = row_count; v_n := v_n || jsonb_build_object('presences', v_c);

  -- 7. La messagerie de demonstration, reperee par identifiants deterministes.
  delete from messages      where conversation_id = md5(p_centre_id::text || '-demo-conv-1')::uuid;
  delete from conversations where id = md5(p_centre_id::text || '-demo-conv-1')::uuid;
  delete from notifications where id = md5(p_centre_id::text || '-demo-notif-1')::uuid;

  -- 8. Enfin les profils jetables, s'il en reste : enfants d'abord.
  if v_jetables is not null then
    delete from briefing_acknowledgements where user_id = any(v_jetables);
    delete from plieurs_valides      where plieur_id = any(v_jetables);
    delete from pliages        where parachutiste_id = any(v_jetables) or plieur_id = any(v_jetables);
    delete from dz_presences   where user_id = any(v_jetables);
    delete from sauts          where parachutiste_id = any(v_jetables);
    delete from places_rotation where parachutiste_id = any(v_jetables);
    delete from file_avionnage where parachutiste_id = any(v_jetables);
    delete from materiels      where parachutiste_id = any(v_jetables);
    delete from licences             where parachutiste_id = any(v_jetables);
    delete from certificats_medicaux where parachutiste_id = any(v_jetables);
    delete from seances_jour   where dz_id = p_centre_id and created_by = any(v_jetables);
    delete from derogations    where parachutiste_id = any(v_jetables);
    delete from conversations  where participant_1_id = any(v_jetables) or participant_2_id = any(v_jetables);
    delete from progression_epreuves where user_id = any(v_jetables);
    delete from licencies_centres where parachutiste_id = any(v_jetables);
    delete from profiles  where id = any(v_jetables);
    delete from auth.users where id = any(v_jetables);
    v_n := v_n || jsonb_build_object('profils_jetables_retires', array_length(v_jetables, 1));
  end if;

  return v_n;
end
$$;

comment on function retirer_demo_dz(uuid) is
  'Retire la demonstration du centre, enfants avant parents. Les presences se suppriment AVANT les materiels : elles referencent la voile perso. Ne touche JAMAIS un licencie du centre.';

-- ── LES SAUTS DU JOUR, TIRES DES PLANCHES ───────────────────────────────────
-- Pas de sauteurs inventes : ceux qui sont EMBARQUES sur les planches du jour.
-- Un carnet credible se lit ainsi -- le saut vient de la rotation, pas d'une
-- table a part.
create or replace function demo_sauts_du_jour(p_centre_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  insert into sauts (parachutiste_id, date_saut, lieu, centre_id, aeronef_immat,
                     nature_saut, categorie, hauteur_m, hauteur_ouverture, fonction,
                     statut, is_tunnel, moniteur_nom_libre, place_rotation_id,
                     observations, demo)
  select pr.parachutiste_id, current_date, c.nom, p_centre_id,
         coalesce(a.immatriculation, 'F-DEMO'),
         case pr.type_saut when 'tandem' then 'tandem'
                           when 'pac'    then 'pac'
                           else 'entrainement' end,
         'OA',
         coalesce(pr.altitude_largage_m, r.altitude_largage_m, 4000),
         case when pr.type_saut = 'pac' then 1500 else 1200 end,
         'largueur',
         -- Deux sauts sur cinq restent a valider : la file de validation du DT
         -- doit avoir quelque chose dedans, sinon la demonstration ne montre rien.
         case when (pr.rang_sortie % 5) < 2 then 'en_attente' else 'valide' end,
         false, 'Moniteur de démonstration', pr.id,
         '[DÉMO] Saut de démonstration', true
    from places_rotation pr
    join rotations r on r.id = pr.rotation_id
    join centres c   on c.id = p_centre_id
    left join aeronefs a on a.id = r.aeronef_id
   where r.centre_id = p_centre_id
     and r.demo
     and r.date_jour = current_date
     and pr.parachutiste_id is not null
     and not exists (select 1 from sauts s where s.place_rotation_id = pr.id);
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ── LE TANDEM COMMERCIAL ────────────────────────────────────────────────────
create or replace function demo_reservations_tandem(p_centre_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int; v_s1 uuid; v_s2 uuid;
begin
  v_s1 := md5(p_centre_id::text || '-demo-tslot-1')::uuid;
  v_s2 := md5(p_centre_id::text || '-demo-tslot-2')::uuid;

  insert into tandem_slots (id, centre_id, date, heure, capacite, statut, demo)
  values (v_s1, p_centre_id, current_date, '10:00', 4, 'ouvert', true),
         (v_s2, p_centre_id, current_date, '14:00', 4, 'ouvert', true)
  on conflict (id) do update set date = excluded.date, demo = true;

  insert into tandem_bookings (id, slot_id, centre_id, offreur_nom, offreur_email, passager_nom,
      prix_total, montant_acompte, montant_solde, statut, statut_paiement_acompte,
      statut_paiement_solde, avec_video, avec_photos, dossier_complete, notes, demo)
  values
    (md5(p_centre_id::text || '-demo-tbook-1')::uuid, v_s1, p_centre_id, 'Marie DÉMO', 'demo-tandem-1@parapass.demo', 'Léa DÉMO', 279, 90, 189, 'confirme',   'paye',     'non_paye', true,  false, true,  '[DÉMO]', true),
    (md5(p_centre_id::text || '-demo-tbook-2')::uuid, v_s1, p_centre_id, 'Paul DÉMO',  'demo-tandem-2@parapass.demo', null,       219, 90, 129, 'en_attente', 'non_paye', 'non_paye', false, false, false, '[DÉMO]', true),
    (md5(p_centre_id::text || '-demo-tbook-3')::uuid, v_s2, p_centre_id, 'Ana DÉMO',   'demo-tandem-3@parapass.demo', 'Ana DÉMO', 309, 90, 219, 'confirme',   'paye',     'non_paye', true,  true,  true,  '[DÉMO]', true)
  on conflict (id) do update set statut = excluded.statut, demo = true;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ── UN ECHANGE AVEC UN LICENCIE DU CENTRE ───────────────────────────────────
create or replace function demo_messages_du_jour(p_centre_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid(); v_licencie uuid; v_conv uuid;
begin
  if v_admin is null then return 0; end if;

  select p.id into v_licencie
    from profiles p
    join licencies_centres lc on lc.parachutiste_id = p.id and lc.centre_id = p_centre_id
   where lc.statut = 'actif' and not p.donnees_reelles and p.id <> v_admin
   order by p.nom limit 1;
  if v_licencie is null then return 0; end if;

  v_conv := md5(p_centre_id::text || '-demo-conv-1')::uuid;
  delete from messages where conversation_id = v_conv;
  delete from conversations where id = v_conv;

  insert into conversations (id, participant_1_id, participant_2_id, dernier_message, dernier_message_at)
  values (v_conv, v_admin, v_licencie, '[DÉMO] Je serai présent demain matin.', now() - interval '1 hour');
  insert into messages (id, conversation_id, expediteur_id, destinataire_id, contenu, lu, created_at)
  values
    (md5(p_centre_id::text || '-demo-msg-1')::uuid, v_conv, v_licencie, v_admin, '[DÉMO] Bonjour, je serai présent demain matin.', false, now() - interval '2 hour'),
    (md5(p_centre_id::text || '-demo-msg-2')::uuid, v_conv, v_admin, v_licencie, '[DÉMO] Parfait, briefing à 9h.', true, now() - interval '1 hour');

  delete from notifications where id = md5(p_centre_id::text || '-demo-notif-1')::uuid;
  insert into notifications (id, user_id, type, titre, message, data, lue)
  values (md5(p_centre_id::text || '-demo-notif-1')::uuid, v_admin, 'validation_demandee',
          'Saut à valider', '[DÉMO] Un saut attend votre validation.', '{"demo":true}'::jsonb, false);
  return 1;
end
$$;

-- ── LE BOUTON UNIQUE ────────────────────────────────────────────────────────
-- Il y avait quatre generateurs, appeles depuis trois ecrans, avec deux jeux de
-- sauteurs differents : les licencies du centre dans l'avionnage, quatre profils
-- fictifs « DEMO » ailleurs. Une demonstration devant un organisme ne peut pas
-- montrer deux populations qui s'ignorent.
--
-- Un seul appel, un seul jeu de sauteurs : les licencies du centre. On repart
-- toujours d'une table rase, donc on peut le rejouer autant de fois qu'on veut,
-- tous les jours, sans empiler.
create or replace function generer_demo_dz(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_pliage jsonb;
  v_sauts int;
  v_tandem int;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_dz(p_centre_id);

  -- L'avionnage pose le decor ET le casting : briefing publie, dossiers a jour,
  -- planches remplies, passagers tandem, voiles declarees, video.
  v_res := generer_demo_avionnage(p_centre_id);

  -- Le reste s'appuie sur ce casting, il n'en invente pas un second.
  v_pliage := generer_demo_pliage(p_centre_id);
  v_sauts  := demo_sauts_du_jour(p_centre_id);
  v_tandem := demo_reservations_tandem(p_centre_id);
  perform demo_messages_du_jour(p_centre_id);

  -- Le briefing de l'avionnage est celui de la journee : il se retire avec elle.
  update dz_briefings set demo = true
   where dz_id = p_centre_id and date_briefing = current_date and not demo;
  update dz_presences set demo = true
   where dz_id = p_centre_id and date_presence = current_date and not demo;

  -- Un bouton qui sous-declare ce qu'il vient de faire fait douter du reste :
  -- le compte des pliages etait jete et l'ecran annoncait « 0 pliages ».
  return v_res || jsonb_build_object(
    'sauts',   v_sauts,
    'tandem',  v_tandem,
    'pliages', coalesce((v_pliage->>'pliages')::int, 0),
    'sacs',    coalesce((v_pliage->>'sacs')::int, 0),
    'presents', (select count(*) from dz_presences
                  where dz_id = p_centre_id and date_presence = current_date));
end
$$;

comment on function generer_demo_dz(uuid) is
  'Le bouton unique : repart d''une table rase puis regenere toute la journee du centre sur les licencies du centre. Rejouable tous les jours.';

grant execute on function generer_demo_dz(uuid) to authenticated;
grant execute on function retirer_demo_dz(uuid) to authenticated;
grant execute on function demo_sauts_du_jour(uuid) to authenticated;
grant execute on function demo_reservations_tandem(uuid) to authenticated;
grant execute on function demo_messages_du_jour(uuid) to authenticated;
