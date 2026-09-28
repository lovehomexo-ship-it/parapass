-- La demande de validation était clouée à UNE seule DZ.
--
-- L'élève clique « je suis prêt » : le client écrivait `centre_id = dzs[0]`, la
-- PREMIÈRE DZ de sa liste, arbitraire. Les politiques et les écrans du staff
-- filtraient ensuite sur ce centre_id. Conséquence mesurée : Florian PUYBAREAU
-- est licencié actif à Royan ET à BigAir Rochefort, mais sa demande n'était
-- visible que chez l'une des deux — au hasard de l'ordre de chargement.
--
-- Une progression appartient au PARACHUTISTE, pas à une DZ. Toute DZ où il est
-- licencié actif peut la voir et la valider. C'est aussi la réalité fédérale :
-- le brevet est délivré par le centre qui CONSTATE, pas par celui où l'élève
-- s'est inscrit en premier. Le centre_id de la déclaration devient ce qu'il
-- aurait toujours dû être : une information — « déclarée à Royan » — jamais un
-- verrou.

create or replace function peut_suivre_progression(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from licencies_centres lc
    where lc.parachutiste_id = p_user_id
      and lc.statut = 'actif'
      and (is_dz_admin(lc.centre_id) or is_moniteur_dz(lc.centre_id))
  );
$$;

comment on function peut_suivre_progression(uuid) is
  'Le staff de TOUTE DZ où le parachutiste est licencié actif. La progression '
  'suit la personne, pas le centre_id figé au moment de la déclaration.';

drop policy if exists staff_read_progression on progression_epreuves;
create policy staff_read_progression on progression_epreuves
  for select using (peut_suivre_progression(user_id));

drop policy if exists staff_validate_progression on progression_epreuves;
create policy staff_validate_progression on progression_epreuves
  for update
  using      (peut_suivre_progression(user_id))
  with check (peut_suivre_progression(user_id));

drop policy if exists staff_insert_progression on progression_epreuves;
create policy staff_insert_progression on progression_epreuves
  for insert with check (peut_suivre_progression(user_id));

-- Le garde-fou des colonnes du staff doit suivre la MÊME règle, sinon BigAir
-- validant une ligne déclarée à Royan serait pris pour l'élève et verrait son
-- verdict effacé en silence.
create or replace function progression_epreuve_colonnes_du_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Un pratiquant qui administre par ailleurs une DZ reste un élève sur SA
  -- propre progression : il ne se valide pas lui-même.
  v_staff := auth.uid() <> new.user_id and peut_suivre_progression(new.user_id);
  if v_staff then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.valide_par     := null;
    new.valide_at      := null;
    new.note           := null;
    new.saut_id        := null;
    new.quantite_faite := 0;
  else
    new.user_id        := old.user_id;
    new.epreuve_id     := old.epreuve_id;
    new.valide_par     := old.valide_par;
    new.valide_at      := old.valide_at;
    new.note           := old.note;
    new.saut_id        := old.saut_id;
    new.quantite_faite := old.quantite_faite;
  end if;

  return new;
end
$$;

-- La DZ voit aussi les brevets délivrés à ses licenciés par d'AUTRES centres :
-- sans cela elle redélivre un brevet déjà obtenu ailleurs.
drop policy if exists read_validations_brevet on validations_brevet;
create policy read_validations_brevet on validations_brevet
  for select using (user_id = auth.uid() or peut_suivre_progression(user_id));

-- Une seule définition de « la file de validation de ce centre », côté base.
create or replace function progression_des_licencies(p_centre_id uuid)
returns setof progression_epreuves
language sql
stable
security definer
set search_path = public
as $$
  select pe.*
    from progression_epreuves pe
   where (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id))
     and exists (
       select 1 from licencies_centres lc
        where lc.parachutiste_id = pe.user_id
          and lc.centre_id = p_centre_id
          and lc.statut = 'actif'
     )
   order by pe.declare_pret_at nulls last;
$$;

comment on function progression_des_licencies(uuid) is
  'La progression des licenciés actifs de ce centre, quel que soit le centre_id '
  'figé à la déclaration.';

create or replace function brevets_delivres_aux_licencies(p_centre_id uuid)
returns setof validations_brevet
language sql
stable
security definer
set search_path = public
as $$
  select vb.*
    from validations_brevet vb
   where (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id))
     and exists (
       select 1 from licencies_centres lc
        where lc.parachutiste_id = vb.user_id
          and lc.centre_id = p_centre_id
          and lc.statut = 'actif'
     );
$$;

grant execute on function peut_suivre_progression(uuid) to authenticated;
grant execute on function progression_des_licencies(uuid) to authenticated;
grant execute on function brevets_delivres_aux_licencies(uuid) to authenticated;
