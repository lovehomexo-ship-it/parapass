-- Le brevet délivré par la DZ n'atteignait jamais la licence.
--
-- Deux tables, aucun pont entre elles : `validations_brevet` porte l'acte du DT,
-- `brevets` porte ce que la carte de licence affiche. Les six délivrances déjà
-- enregistrées étaient TOUTES absentes des licences — dont le brevet A de
-- Florian PUYBAREAU, délivré par Royan, qui restait « BPA » sur sa carte.
--
-- Ce n'était pas un oubli d'écran : aucun écran ne pouvait le rattraper, la
-- donnée n'existait nulle part. La délivrance EST la preuve — c'est donc elle
-- qui écrit la ligne que la licence lit, une seule fois, pour toutes les DZ.
--
-- Les paliers PAC (ordre < 1 au référentiel) restent dans l'Académie : ce sont
-- des étapes de progression, pas des brevets à porter sur une licence.

create unique index if not exists brevets_un_seul_par_personne
  on brevets (parachutiste_id, type_brevet);

create or replace function brevet_delivre_vers_licence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_ordre  int;
  v_centre text;
begin
  select code, ordre into v_code, v_ordre
    from brevets_referentiel where id = new.brevet_id;

  -- Palier PAC ou code inconnu : rien à porter sur la licence.
  if v_code is null or coalesce(v_ordre, 0) < 1 then
    return new;
  end if;

  select nom into v_centre from centres where id = new.centre_id;

  insert into brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance, numero_brevet)
  values (new.user_id, v_code, coalesce(new.valide_at, now())::date,
          coalesce(v_centre, ''), new.numero)
  -- Le parachutiste avait déjà saisi ce brevet : on ne réécrit ni sa date ni
  -- son centre, on complète seulement le numéro s'il manquait.
  on conflict (parachutiste_id, type_brevet) do update
    set numero_brevet = coalesce(brevets.numero_brevet, excluded.numero_brevet);

  return new;
end
$$;

comment on function brevet_delivre_vers_licence() is
  'La délivrance EST la preuve : elle écrit la ligne que la licence lit. '
  'Les paliers PAC (ordre < 1) ne sont pas des brevets de licence.';

drop trigger if exists trg_brevet_delivre_vers_licence on validations_brevet;
create trigger trg_brevet_delivre_vers_licence
  after insert on validations_brevet
  for each row execute function brevet_delivre_vers_licence();

-- Une délivrance annulée retire la ligne qu'elle avait posée — jamais celle que
-- le parachutiste a saisie lui-même avec son scan de diplôme.
create or replace function brevet_annule_retire_de_licence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from brevets_referentiel where id = old.brevet_id;
  if v_code is null then return old; end if;

  delete from brevets
   where parachutiste_id = old.user_id
     and type_brevet = v_code
     and scan_diplome_url is null;
  return old;
end
$$;

drop trigger if exists trg_brevet_annule_retire_de_licence on validations_brevet;
create trigger trg_brevet_annule_retire_de_licence
  after delete on validations_brevet
  for each row execute function brevet_annule_retire_de_licence();

-- Rattrapage des délivrances déjà faites, toutes DZ confondues.
insert into brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance, numero_brevet)
select vb.user_id, br.code, coalesce(vb.valide_at, now())::date,
       coalesce(c.nom, ''), vb.numero
  from validations_brevet vb
  join brevets_referentiel br on br.id = vb.brevet_id
  left join centres c on c.id = vb.centre_id
 where coalesce(br.ordre, 0) >= 1
on conflict (parachutiste_id, type_brevet) do nothing;
