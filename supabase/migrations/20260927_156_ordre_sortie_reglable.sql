-- Appliquée en base : ordre_sortie_defaut_et_ecriture + ordre_sortie_defaut_complet
--
-- L'ordre de sortie automatique existait en base mais n'était modifiable nulle
-- part. Ce n'est PAS une règle fédérale — ParaPass ne connaît aucun texte qui
-- en fixe un — c'est un réglage du centre.
comment on column centres.ordre_sortie_regle is
  'Ordre de sortie souhaite par le centre, du premier au dernier. REGLAGE, pas une regle federale : ParaPass ne connait aucun texte qui en fixe un. Une discipline absente sort en dernier.';

-- Le défaut cite TOUTES les disciplines du catalogue : une discipline oubliée
-- retombe au rang 99, donc APRÈS le largueur — l'inverse de ce qu'on veut.
update centres set ordre_sortie_regle = to_jsonb(array[
  'ecole','init_pac','premier_pac','post_pac','accompagne',
  'groupe','vr','init_vr','ff','init_ff','solo','track','wingsuit','init_ws','saut_plage',
  'video','suivi_video','tandem',
  'largueur'
]);

create or replace function definir_ordre_sortie(p_centre_id uuid, p_ordre text[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;
  -- Un code fantôme rendrait la règle silencieusement inopérante pour sa discipline.
  if exists (select 1 from unnest(p_ordre) as x(code)
             where not exists (select 1 from disciplines_saut d where d.code = x.code)) then
    raise exception 'Ordre refuse : une discipline citee n''existe pas au referentiel.'
      using errcode = '23514';
  end if;
  update centres set ordre_sortie_regle = to_jsonb(p_ordre) where id = p_centre_id;
  return to_jsonb(p_ordre);
end $$;

revoke all on function definir_ordre_sortie(uuid, text[]) from public;
grant execute on function definir_ordre_sortie(uuid, text[]) to authenticated;
