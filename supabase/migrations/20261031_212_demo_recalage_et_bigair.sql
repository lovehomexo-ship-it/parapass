-- 1. LES PLANCHES DE DÉMO NE PRENNENT PLUS DE RETARD.
--    Générées le matin, leurs heures prévues restaient figées : l'après-midi,
--    la démo affichait « avion n°4 en retard de 7 h 34 ». Toutes les dix
--    minutes, les planches de démo pas encore parties dont l'heure est passée
--    sont recalées dans l'avenir, aux mêmes écarts que le générateur
--    (dans 12, 50, 90, 130, 170 min), sans dépasser 23 h 45.
create or replace function public.demo_recaler_planches()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_ici timestamp := now() at time zone 'Europe/Paris';
  v_n int := 0;
  v_c record;
begin
  for v_c in select c.id from centres c where c.is_demo and c.demo_quotidienne loop
    -- On ne touche à rien tant que la prochaine planche est encore à l'heure.
    if not exists (select 1 from rotations r
                    where r.centre_id = v_c.id and r.date_jour = current_date and r.demo
                      and r.heure_decollage is null and r.statut <> 'annulee'
                      and r.heure_prevue < v_ici::time) then
      continue;
    end if;
    update rotations r
       set heure_prevue = least(v_ici + make_interval(mins => x.decal),
                                date_trunc('day', v_ici) + interval '23 hours 45 minutes')::time
      from (select id, (array[12, 50, 90, 130, 170])[least(5, row_number() over (order by numero))::int] decal
              from rotations
             where centre_id = v_c.id and date_jour = current_date and demo
               and heure_decollage is null and statut <> 'annulee') x
     where r.id = x.id;
    get diagnostics v_n = row_count;
  end loop;
  return v_n;
end $$;

revoke all on function public.demo_recaler_planches() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'demo-recalage';
select cron.schedule('demo-recalage', '*/10 * * * *', 'select public.demo_recaler_planches()');

-- 2. LE COMPTE DÉMO NE FIGURE PLUS CHEZ BIGAIR ROCHEFORT.
--    BigAir est un vrai centre : le compte de démonstration y apparaissait
--    parmi les présents et dans la file. On retire ses présences et sa file
--    du jour et des jours à venir, et son adhésion passe « inactif ». Son
--    historique (sauts, planches passées) n'est pas réécrit.
with d as (select id from profiles where email = 'demo@parapass.fr'),
     b as (select id from centres where nom = 'BigAir Rochefort' and not coalesce(is_demo, false))
delete from dz_presences p using d, b
 where p.user_id = d.id and p.dz_id = b.id and p.date_presence >= current_date;

with d as (select id from profiles where email = 'demo@parapass.fr'),
     b as (select id from centres where nom = 'BigAir Rochefort' and not coalesce(is_demo, false))
delete from file_avionnage f using d, b
 where f.parachutiste_id = d.id and f.centre_id = b.id and f.date_jour >= current_date
   and f.place_rotation_id is null;

with d as (select id from profiles where email = 'demo@parapass.fr'),
     b as (select id from centres where nom = 'BigAir Rochefort' and not coalesce(is_demo, false))
update licencies_centres lc set statut = 'inactif'
  from d, b
 where lc.parachutiste_id = d.id and lc.centre_id = b.id;
