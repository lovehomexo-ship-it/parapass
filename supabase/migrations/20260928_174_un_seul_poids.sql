-- Appliquée en base : un_seul_poids_qui_alimente_tout
--
-- LE POIDS ÉTAIT SAISI À TROIS ENDROITS, ET AUCUN NE PARLAIT AUX AUTRES.
--   • `profils_prives.poids_nu_kg` — dans la carte « charge alaire », elle-même
--     enfouie dans la fiche de CHAQUE matériel. Introuvable, et autant de
--     points de saisie que le sauteur a de sacs.
--   • `profils_prives.poids_tout_equipe_kg` — au même endroit.
--   • `profiles.masse_kg` — saisi au check-in de présence, ou par le DT à
--     l'avionnage.
--
-- Trois nombres pour une seule personne. La DT 48 lisait le premier, l'avion
-- pesait le troisième, et rien ne garantissait qu'ils parlaient du même sauteur
-- du même jour. C'est ainsi qu'on embarque une masse fausse.
--
-- ON EN FAIT UNE CHAÎNE, AVEC UNE SEULE SAISIE :
--   poids nu  +  équipement  =  masse embarquée
--   └─ lu par la DT 48          └─ recopié dans profiles.masse_kg, lu par l'avionnage
--
-- La recopie est un DÉCLENCHEUR, pas une politesse de l'écran : quel que soit
-- l'endroit d'où le poids est écrit, l'avion voit le même nombre.
alter table profils_prives add column if not exists poids_equipement_kg numeric;

comment on column profils_prives.poids_nu_kg is
  'Poids du corps, sans equipement. C''est CE poids que lit la DT 48 : le tableau federal ajoute lui-meme l''equipement.';
comment on column profils_prives.poids_equipement_kg is
  'Masse du sac complet, casque et combinaison. S''ajoute au poids nu pour donner la masse embarquee.';
comment on column profils_prives.poids_tout_equipe_kg is
  'Poids nu + equipement. Recopie dans profiles.masse_kg par declencheur : c''est ce que pese l''avion.';

create or replace function profils_prives_propager_poids()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- On ne l'invente jamais : sans poids nu, pas de total, et la DT 48 reste
  -- grise — ce qui est la vérité, pas un défaut.
  if new.poids_nu_kg is not null then
    new.poids_tout_equipe_kg := new.poids_nu_kg + coalesce(new.poids_equipement_kg, 0);
  end if;

  -- La masse embarquée n'est pas une donnée intime : le chef d'avionnage en a
  -- besoin pour le centrage. Le poids nu, lui, ne sort pas de la table privée.
  if new.poids_tout_equipe_kg is not null then
    update profiles p
       set masse_kg = round(new.poids_tout_equipe_kg)
     where p.id = new.profile_id
       and (p.masse_kg is distinct from round(new.poids_tout_equipe_kg));
  end if;
  return new;
end $$;

drop trigger if exists trg_profils_prives_poids on profils_prives;
create trigger trg_profils_prives_poids
  before insert or update of poids_nu_kg, poids_equipement_kg, poids_tout_equipe_kg
  on profils_prives
  for each row execute function profils_prives_propager_poids();

-- Reprise : on remonte l'équipement déduit quand les deux poids existaient, et
-- on relève la masse d'avionnage comme poids TOUT ÉQUIPÉ — ce qu'elle est. On
-- ne déduit surtout pas un poids nu : ce serait inventer la donnée que la
-- DT 48 exige.
update profils_prives
   set poids_equipement_kg = round(poids_tout_equipe_kg - poids_nu_kg)
 where poids_equipement_kg is null
   and poids_nu_kg is not null and poids_tout_equipe_kg is not null
   and poids_tout_equipe_kg > poids_nu_kg;

insert into profils_prives (profile_id, poids_tout_equipe_kg, updated_at)
select p.id, p.masse_kg, now()
from profiles p
where p.masse_kg is not null
  and not exists (select 1 from profils_prives pp where pp.profile_id = p.id)
on conflict (profile_id) do nothing;
